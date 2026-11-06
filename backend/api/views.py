from datetime import datetime
from io import BytesIO

from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Max, Min
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .importers import import_schedule
from .models import Attendance, Group, Lesson, Student, Teacher
from .reports import analytics_pdf, analytics_workbook, lesson_pdf, lesson_workbook
from .serializers import (
    AttendanceRecordSerializer,
    AttendanceSubmitSerializer,
    CheckInSerializer,
    LessonSerializer,
    LoginSerializer,
    StudentSerializer,
    TeacherSerializer,
    UserSerializer,
)
from .services import (
    get_analytics_rows,
    get_lesson_attendance_map,
    get_lesson_students,
)


def parse_date_param(value: str | None, field_name: str):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValidationError({field_name: "Ожидается дата в формате YYYY-MM-DD."}) from exc


def parse_int_param(value: str | None, field_name: str):
    if not value:
        return None
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError({field_name: "Ожидается целое число."}) from exc


def lesson_queryset():
    return Lesson.objects.select_related("teacher", "slot").prefetch_related("groups")


def apply_lesson_filters(queryset, request):
    subject = request.query_params.get("subject")
    group = request.query_params.get("group")
    teacher_id = parse_int_param(request.query_params.get("teacher_id"), "teacher_id")
    date_from = parse_date_param(request.query_params.get("date_from"), "date_from")
    date_to = parse_date_param(request.query_params.get("date_to"), "date_to")

    if date_from and date_to and date_from > date_to:
        raise ValidationError({"date_to": "Дата окончания не может быть раньше даты начала."})

    if group:
        queryset = queryset.filter(groups__group_name=group)
    if subject:
        queryset = queryset.filter(subject=subject)
    if teacher_id is not None:
        queryset = queryset.filter(teacher_id=teacher_id)
    if date_from:
        queryset = queryset.filter(lesson_date__gte=date_from)
    if date_to:
        queryset = queryset.filter(lesson_date__lte=date_to)

    return queryset.distinct()


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data["login"],
            password=serializer.validated_data["password"],
        )
        if user is None or not user.is_active:
            return Response(
                {"detail": "Неверный логин или пароль."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "access_token": token.key,
                "token_type": "Bearer",
                "user": UserSerializer(user).data,
            }
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class MetaView(APIView):
    def get(self, request):
        date_bounds = Lesson.objects.aggregate(
            min_date=Min("lesson_date"),
            max_date=Max("lesson_date"),
        )
        subjects = (
            Lesson.objects.order_by("subject")
            .values_list("subject", flat=True)
            .distinct()
        )
        groups = Group.objects.values_list("group_name", flat=True)
        teachers = Teacher.objects.all()

        return Response(
            {
                "groups": list(groups),
                "subjects": list(subjects),
                "teachers": TeacherSerializer(teachers, many=True).data,
                "min_date": date_bounds["min_date"].isoformat()
                if date_bounds["min_date"]
                else None,
                "max_date": date_bounds["max_date"].isoformat()
                if date_bounds["max_date"]
                else None,
            }
        )


class StudentListView(APIView):
    def get(self, request):
        queryset = Student.objects.select_related("group")
        group = request.query_params.get("group")
        if group:
            queryset = queryset.filter(group_id=group)
        return Response(StudentSerializer(queryset, many=True).data)


class LessonListView(APIView):
    def get(self, request):
        queryset = apply_lesson_filters(lesson_queryset(), request)
        return Response(LessonSerializer(queryset, many=True).data)


class LessonDetailView(APIView):
    def get(self, request, pk: int):
        lesson = get_object_or_404(lesson_queryset(), pk=pk)
        return Response(LessonSerializer(lesson).data)


class LessonStudentsView(APIView):
    def get(self, request, pk: int):
        lesson = get_object_or_404(lesson_queryset(), pk=pk)
        return Response(StudentSerializer(get_lesson_students(lesson), many=True).data)


class LessonAttendanceView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request, pk: int):
        lesson = get_object_or_404(Lesson, pk=pk)
        records = (
            Attendance.objects.filter(lesson=lesson)
            .select_related("student")
            .order_by("student__fio")
        )
        return Response(
            {
                "lesson_id": lesson.id,
                "records": AttendanceRecordSerializer(records, many=True).data,
            }
        )

    def post(self, request, pk: int):
        lesson = get_object_or_404(lesson_queryset(), pk=pk)
        serializer = AttendanceSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        roster = {
            student.student_id: student
            for student in get_lesson_students(lesson)
        }
        if not roster:
            raise ValidationError({"detail": "У занятия нет студентов."})

        submitted = {}
        for item in serializer.validated_data["records"]:
            student_id = item["student_id"]
            if student_id in submitted:
                raise ValidationError(
                    {"records": f"Студент {student_id} указан несколько раз."}
                )
            if student_id not in roster:
                raise ValidationError(
                    {"records": f"Студент {student_id} не относится к группам занятия."}
                )
            submitted[student_id] = item["status"]

        # Unmarked students of a conducted lesson are stored as absent, but an
        # existing record is preserved. This keeps QR check-ins made while the
        # teacher's page was open.
        existing = dict(
            Attendance.objects.filter(lesson=lesson).values_list(
                "student_id", "status"
            )
        )
        records = [
            Attendance(
                lesson=lesson,
                student=student,
                status=submitted.get(
                    student_id,
                    existing.get(student_id, Attendance.STATUS_ABSENT),
                ),
            )
            for student_id, student in roster.items()
        ]

        with transaction.atomic():
            Attendance.objects.filter(lesson=lesson).delete()
            Attendance.objects.bulk_create(records)

        saved = (
            Attendance.objects.filter(lesson=lesson)
            .select_related("student")
            .order_by("student__fio")
        )
        return Response(
            {
                "lesson_id": lesson.id,
                "saved": len(records),
                "records": AttendanceRecordSerializer(saved, many=True).data,
            }
        )


class AnalyticsView(APIView):
    def get(self, request):
        group = request.query_params.get("group")
        student_id = request.query_params.get("student_id")
        subject = request.query_params.get("subject")
        date_from = parse_date_param(request.query_params.get("date_from"), "date_from")
        date_to = parse_date_param(request.query_params.get("date_to"), "date_to")

        if date_from and date_to and date_from > date_to:
            raise ValidationError({"date_to": "Дата окончания не может быть раньше даты начала."})

        return Response(
            get_analytics_rows(
                group=group,
                student_id=student_id,
                subject=subject,
                date_from=date_from,
                date_to=date_to,
            )
        )


class JournalView(APIView):
    def get(self, request):
        queryset = Attendance.objects.select_related(
            "lesson", "student", "student__group"
        )
        group = request.query_params.get("group")
        student_id = request.query_params.get("student_id")
        subject = request.query_params.get("subject")
        date_from = parse_date_param(request.query_params.get("date_from"), "date_from")
        date_to = parse_date_param(request.query_params.get("date_to"), "date_to")

        if group:
            queryset = queryset.filter(student__group_id=group)
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if subject:
            queryset = queryset.filter(lesson__subject=subject)
        if date_from:
            queryset = queryset.filter(lesson__lesson_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(lesson__lesson_date__lte=date_to)
        if date_from and date_to and date_from > date_to:
            raise ValidationError({"date_to": "Дата окончания не может быть раньше даты начала."})

        queryset = queryset.order_by(
            "lesson__lesson_date", "lesson_id", "student__fio"
        )
        return Response(
            [
                {
                    "date": item.lesson.lesson_date.isoformat(),
                    "subject": item.lesson.subject,
                    "student_id": item.student_id,
                    "student_fio": item.student.fio,
                    "group_name": item.student.group_id,
                    "lesson_id": item.lesson_id,
                    "status": item.status,
                }
                for item in queryset
            ]
        )


class LessonImportView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "Выберите Excel-файл."})
        try:
            result = import_schedule(upload)
        except ValueError as exc:
            raise ValidationError({"file": str(exc)}) from exc
        result["errors"] = result["errors"][:50]
        return Response(result)


class LessonCheckinTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        lesson = get_object_or_404(Lesson, pk=pk)
        return Response(
            {
                "lesson_id": lesson.id,
                "token": str(lesson.checkin_token),
            }
        )


class CheckInView(APIView):
    def get(self, request, token):
        lesson = get_object_or_404(lesson_queryset(), checkin_token=token)
        students = get_lesson_students(lesson)
        return Response(
            {
                "lesson": LessonSerializer(lesson).data,
                "students": StudentSerializer(students, many=True).data,
            }
        )

    def post(self, request, token):
        lesson = get_object_or_404(lesson_queryset(), checkin_token=token)
        serializer = CheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student_id = serializer.validated_data["student_id"]

        roster = {
            student.student_id: student for student in get_lesson_students(lesson)
        }
        student = roster.get(student_id)
        if student is None:
            raise ValidationError(
                {"student_id": "Студент не относится к группам занятия."}
            )

        record, created = Attendance.objects.update_or_create(
            lesson=lesson,
            student=student,
            defaults={"status": Attendance.STATUS_PRESENT},
        )
        return Response(
            {
                "lesson_id": lesson.id,
                "student_id": student.student_id,
                "status": record.status,
                "created": created,
            }
        )


def _report_response(content: bytes, filename: str, content_type: str) -> FileResponse:
    return FileResponse(
        BytesIO(content),
        as_attachment=True,
        filename=filename,
        content_type=content_type,
    )


class AnalyticsReportView(APIView):
    def get(self, request, fmt: str):
        if fmt not in {"xlsx", "pdf"}:
            return Response({"detail": "Неизвестный формат."}, status=status.HTTP_404_NOT_FOUND)

        group = request.query_params.get("group")
        student_id = request.query_params.get("student_id")
        subject = request.query_params.get("subject")
        date_from = parse_date_param(request.query_params.get("date_from"), "date_from")
        date_to = parse_date_param(request.query_params.get("date_to"), "date_to")
        if date_from and date_to and date_from > date_to:
            raise ValidationError({"date_to": "Дата окончания не может быть раньше даты начала."})

        rows = get_analytics_rows(
            group=group,
            student_id=student_id,
            subject=subject,
            date_from=date_from,
            date_to=date_to,
        )
        title = "Отчёт по посещаемости"
        if group:
            title += f" · группа {group}"
        if subject:
            title += f" · {subject}"

        if fmt == "xlsx":
            content = analytics_workbook(rows, title)
            return _report_response(
                content,
                "analytics_report.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

        content = analytics_pdf(rows, title)
        return _report_response(content, "analytics_report.pdf", "application/pdf")


class LessonReportView(APIView):
    def get(self, request, pk: int, fmt: str):
        if fmt not in {"xlsx", "pdf"}:
            return Response({"detail": "Неизвестный формат."}, status=status.HTTP_404_NOT_FOUND)

        lesson = get_object_or_404(lesson_queryset(), pk=pk)
        students = list(get_lesson_students(lesson))
        status_map = get_lesson_attendance_map(lesson)

        if fmt == "xlsx":
            content = lesson_workbook(lesson, students, status_map)
            return _report_response(
                content,
                f"lesson_{lesson.id}_report.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

        content = lesson_pdf(lesson, students, status_map)
        return _report_response(
            content,
            f"lesson_{lesson.id}_report.pdf",
            "application/pdf",
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"})
