import hashlib
import json
import os
from datetime import date, datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import (
    Attendance,
    Group,
    Lesson,
    LessonGroup,
    Slot,
    Student,
    Teacher,
    User,
)
from api.naming import make_teacher_login


class Command(BaseCommand):
    help = "Загружает мок-данные из data/*.json и создаёт демо-пользователей."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Удалить существующие данные посещаемости и расписания перед загрузкой.",
        )
        parser.add_argument(
            "--no-demo-attendance",
            action="store_true",
            help="Не создавать демонстрационную посещаемость для прошедших занятий.",
        )

    def handle(self, *args, **options):
        data_dir = Path(
            os.getenv("ATTENDANCE_DATA_DIR", settings.BASE_DIR.parent / "data")
        )
        groups_path = data_dir / "526group.json"
        schedule_path = data_dir / "526sched.json"

        if not groups_path.exists() or not schedule_path.exists():
            raise CommandError(f"Не найдены файлы данных в {data_dir}")

        with groups_path.open(encoding="utf-8") as file:
            groups_payload = json.load(file)
        with schedule_path.open(encoding="utf-8") as file:
            schedule_payload = json.load(file)

        with transaction.atomic():
            if options["reset"]:
                Attendance.objects.all().delete()
                LessonGroup.objects.all().delete()
                Lesson.objects.all().delete()
                Student.objects.all().delete()
                Group.objects.all().delete()
                Teacher.objects.all().delete()
                Slot.objects.all().delete()

            self._load_groups_and_students(groups_payload)
            self._load_slots(schedule_payload)
            teacher_by_fio = self._load_teachers(schedule_payload)
            self._load_lessons(schedule_payload, teacher_by_fio)
            self._assign_teacher_logins()
            self._create_teacher_users()
            self._create_demo_users()
            if not options["no_demo_attendance"]:
                self._create_demo_attendance()

        self.stdout.write(self.style.SUCCESS("Данные успешно загружены."))
        self.stdout.write(
            "Групп: {groups}, студентов: {students}, занятий: {lessons}, "
            "отметок: {attendance}".format(
                groups=Group.objects.count(),
                students=Student.objects.count(),
                lessons=Lesson.objects.count(),
                attendance=Attendance.objects.count(),
            )
        )
        self.stdout.write("Демо-доступ: head / student / admin — пароль 1234.")
        self.stdout.write("Логины преподавателей (пароль 1234):")
        for teacher in Teacher.objects.exclude(login__isnull=True).order_by("fio"):
            self.stdout.write(f"  {teacher.login:20} {teacher.fio}")

    def _load_groups_and_students(self, payload):
        for group_name in payload.get("groups", []):
            Group.objects.get_or_create(group_name=group_name)

        for item in payload.get("students", []):
            Student.objects.update_or_create(
                student_id=item["student_id"],
                defaults={
                    "fio": item["fio"],
                    "gender": item.get("gender", ""),
                    "group_id": item["group"],
                    "is_head": bool(item.get("is_head", False)),
                },
            )

    def _load_slots(self, payload):
        for slot_no, time_range in payload.get("slots", {}).items():
            Slot.objects.update_or_create(
                slot_no=int(slot_no),
                defaults={"time_range": time_range},
            )

    def _load_teachers(self, payload):
        fio_set = {
            lesson["teacher"]
            for week in payload.get("schedule", [])
            for day in week.get("days", [])
            for lesson in (day.get("lessons") or [])
            if lesson.get("teacher")
        }
        for fio in sorted(fio_set):
            Teacher.objects.get_or_create(fio=fio)
        return {teacher.fio: teacher for teacher in Teacher.objects.all()}

    def _load_lessons(self, payload, teacher_by_fio):
        for week in payload.get("schedule", []):
            date_by_weekday = {
                item["weekday"]: datetime.strptime(item["date"], "%d.%m.%Y").date()
                for item in week.get("dates", {}).get("dates", [])
            }
            for day in week.get("days", []):
                lesson_date = date_by_weekday.get(day.get("weekday"))
                if lesson_date is None:
                    continue
                for item in day.get("lessons") or []:
                    lesson, _ = Lesson.objects.update_or_create(
                        id=item["id"],
                        defaults={
                            "lesson_date": lesson_date,
                            "week_number": day.get(
                                "week_number", week.get("week_number", 0)
                            ),
                            "weekday": day.get("weekday", 0),
                            "slot_id": item["time"],
                            "subject": item["subject"],
                            "teacher": teacher_by_fio.get(item.get("teacher")),
                            "auditory": item.get("auditory", ""),
                            "type_lesson": item.get("type_lesson", ""),
                        },
                    )
                    group_names = item.get("group", [])
                    lesson.groups.set(
                        Group.objects.filter(group_name__in=group_names)
                    )

    def _assign_teacher_logins(self):
        used = set(User.objects.values_list("username", flat=True))
        for teacher in Teacher.objects.order_by("id"):
            base = make_teacher_login(teacher.fio)
            candidate = teacher.login or base
            counter = 2
            while candidate in used and candidate != teacher.login:
                candidate = f"{base}{counter}"
                counter += 1
            if teacher.login != candidate:
                teacher.login = candidate
                teacher.save(update_fields=["login"])
            used.add(candidate)

    def _create_teacher_users(self):
        # The old generic demo account conflicts with the one-to-one teacher
        # relation now that every teacher has a personal login.
        User.objects.filter(username="teacher", role=User.ROLE_TEACHER).delete()

        for teacher in Teacher.objects.exclude(login__isnull=True):
            User.objects.filter(teacher=teacher).exclude(
                username=teacher.login
            ).update(teacher=None)

            user, created = User.objects.get_or_create(username=teacher.login)
            user.role = User.ROLE_TEACHER
            user.teacher = teacher
            user.student = None
            if created or not user.password:
                user.set_password("1234")
            user.save()

    def _create_demo_users(self):
        head = Student.objects.filter(is_head=True).order_by("group_id").first()
        student = (
            Student.objects.filter(student_id="STU-5001").first()
            or Student.objects.exclude(student_id=head.student_id if head else "").first()
        )

        demo_users = [
            ("head", User.ROLE_HEAD, None, head),
            ("student", User.ROLE_STUDENT, None, student),
            ("admin", User.ROLE_ADMIN, None, None),
        ]

        for username, role, teacher_obj, student_obj in demo_users:
            user, created = User.objects.get_or_create(username=username)
            user.role = role
            user.teacher = teacher_obj
            user.student = student_obj
            if username == "admin":
                user.is_staff = True
                user.is_superuser = True
                user.first_name = "Администратор"
            if created or not user.password:
                user.set_password("1234")
            user.save()

    def _create_demo_attendance(self):
        if Attendance.objects.exists():
            return

        today = date.today()
        lessons = list(
            Lesson.objects.filter(lesson_date__lte=today).prefetch_related("groups")
        )
        if not lessons:
            return

        records = []
        for lesson in lessons:
            group_names = list(lesson.groups.values_list("group_name", flat=True))
            student_ids = Student.objects.filter(
                group_id__in=group_names
            ).values_list("student_id", flat=True)
            for student_id in student_ids:
                bucket = int(
                    hashlib.md5(
                        f"{student_id}:{lesson.id}".encode("utf-8")
                    ).hexdigest(),
                    16,
                ) % 100
                if bucket < 80:
                    status = Attendance.STATUS_PRESENT
                elif bucket < 88:
                    status = Attendance.STATUS_ABSENT
                elif bucket < 95:
                    status = Attendance.STATUS_LATE
                else:
                    status = Attendance.STATUS_EXCUSED
                records.append(
                    Attendance(
                        lesson=lesson,
                        student_id=student_id,
                        status=status,
                    )
                )

        Attendance.objects.bulk_create(records, batch_size=500)
