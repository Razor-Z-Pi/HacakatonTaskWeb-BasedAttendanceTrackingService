from datetime import date, timedelta
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Attendance, Group, Lesson, LessonGroup, Slot, Student, Teacher, User
from .naming import make_teacher_login


class AttendanceApiTests(APITestCase):
    def setUp(self):
        self.group = Group.objects.create(group_name="TEST-1")
        self.student_one = Student.objects.create(
            student_id="S1",
            fio="Иванов Иван",
            gender="м",
            group=self.group,
        )
        self.student_two = Student.objects.create(
            student_id="S2",
            fio="Петрова Мария",
            gender="ж",
            group=self.group,
        )
        self.slot = Slot.objects.create(slot_no=1, time_range="08:30-10:00")
        self.teacher = Teacher.objects.create(fio="Соснин Е.А.")
        self.lessons = []
        for index in range(4):
            lesson = Lesson.objects.create(
                id=100 + index,
                lesson_date=date(2026, 11, 2) + timedelta(days=index),
                week_number=10,
                weekday=index + 1,
                slot=self.slot,
                subject="Информатика",
                teacher=self.teacher,
                auditory="2-423",
                type_lesson="л.",
            )
            LessonGroup.objects.create(lesson=lesson, group=self.group)
            self.lessons.append(lesson)

        self.user = User.objects.create_user(
            username="teacher",
            password="1234",
            role=User.ROLE_TEACHER,
            teacher=self.teacher,
        )
        self.token = Token.objects.create(user=self.user)

    def auth(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token.key}")

    def test_login(self):
        response = self.client.post(
            "/api/auth/login/",
            {"login": "teacher", "password": "1234"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["token_type"], "Bearer")
        self.assertEqual(response.data["user"]["role"], "teacher")
        self.assertTrue(response.data["access_token"])

    def test_teacher_login_format(self):
        self.assertEqual(make_teacher_login("Соснин Е.А."), "sosnin.ea")
        self.assertEqual(make_teacher_login("Кравченко О.В."), "kravchenko.ov")
        self.assertEqual(make_teacher_login("Щербаков О.С."), "scherbakov.os")

    def test_lessons_list(self):
        response = self.client.get("/api/lessons/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 4)
        self.assertEqual(response.data[0]["groups"], ["TEST-1"])
        self.assertEqual(response.data[0]["time_range"], "08:30-10:00")

    def test_lessons_filter_by_teacher(self):
        other_teacher = Teacher.objects.create(fio="Другой П.П.")
        other_lesson = Lesson.objects.create(
            id=200,
            lesson_date=date(2026, 11, 2),
            week_number=10,
            weekday=1,
            slot=self.slot,
            subject="Физика",
            teacher=other_teacher,
            auditory="1-100",
            type_lesson="л.",
        )
        LessonGroup.objects.create(lesson=other_lesson, group=self.group)

        response = self.client.get("/api/lessons/", {"teacher_id": other_teacher.id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [200])

        response = self.client.get("/api/lessons/", {"teacher_id": self.teacher.id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 4)
        self.assertTrue(all(item["teacher_name"] == self.teacher.fio for item in response.data))

    def test_attendance_requires_auth(self):
        response = self.client.post(
            f"/api/lessons/{self.lessons[0].id}/attendance/",
            {"records": [{"student_id": "S1", "status": "present"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_stale_token_does_not_break_public_reads(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer stale-token")
        response = self.client.get("/api/lessons/")
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/lessons/{self.lessons[0].id}/attendance/",
            {"records": [{"student_id": "S1", "status": "present"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_attendance_saves_and_returns_after_reload(self):
        self.auth()
        response = self.client.post(
            f"/api/lessons/{self.lessons[0].id}/attendance/",
            {
                "records": [
                    {"student_id": "S1", "status": "present"},
                    {"student_id": "S2", "status": "late"},
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["saved"], 2)

        reload = self.client.get(f"/api/lessons/{self.lessons[0].id}/attendance/")
        self.assertEqual(reload.status_code, 200)
        statuses = {item["student_id"]: item["status"] for item in reload.data["records"]}
        self.assertEqual(statuses, {"S1": "present", "S2": "late"})

    def test_unmarked_students_are_stored_as_absent(self):
        self.auth()
        self.client.post(
            f"/api/lessons/{self.lessons[0].id}/attendance/",
            {"records": [{"student_id": "S1", "status": "present"}]},
            format="json",
        )
        response = self.client.get(f"/api/lessons/{self.lessons[0].id}/attendance/")
        statuses = {item["student_id"]: item["status"] for item in response.data["records"]}
        self.assertEqual(statuses, {"S1": "present", "S2": "absent"})

    def test_attendance_preserves_existing_qr_checkin(self):
        Attendance.objects.create(
            lesson=self.lessons[0],
            student=self.student_two,
            status=Attendance.STATUS_PRESENT,
        )
        self.auth()
        self.client.post(
            f"/api/lessons/{self.lessons[0].id}/attendance/",
            {"records": [{"student_id": "S1", "status": "present"}]},
            format="json",
        )
        response = self.client.get(f"/api/lessons/{self.lessons[0].id}/attendance/")
        statuses = {item["student_id"]: item["status"] for item in response.data["records"]}
        self.assertEqual(statuses, {"S1": "present", "S2": "present"})

    def test_empty_attendance_preserves_existing_records(self):
        Attendance.objects.create(
            lesson=self.lessons[0],
            student=self.student_two,
            status=Attendance.STATUS_LATE,
        )
        self.auth()
        response = self.client.post(
            f"/api/lessons/{self.lessons[0].id}/attendance/",
            {"records": []},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        statuses = {item["student_id"]: item["status"] for item in response.data["records"]}
        self.assertEqual(statuses, {"S1": "absent", "S2": "late"})

    def test_analytics_percentages(self):
        statuses = {
            "S1": ["present", "present", "absent", "late"],
            "S2": ["present", "present", "present", "present"],
        }
        for student_id, values in statuses.items():
            for lesson, value in zip(self.lessons, values):
                Attendance.objects.create(
                    lesson=lesson,
                    student_id=student_id,
                    status=value,
                )

        response = self.client.get("/api/analytics/", {"group": "TEST-1"})
        self.assertEqual(response.status_code, 200)
        rows = {row["student_id"]: row for row in response.data}

        self.assertEqual(rows["S1"]["total_lessons"], 4)
        self.assertEqual(rows["S1"]["present"], 2)
        self.assertEqual(rows["S1"]["absent"], 1)
        self.assertEqual(rows["S1"]["late"], 1)
        self.assertEqual(rows["S1"]["percent"], 75.0)

        self.assertEqual(rows["S2"]["total_lessons"], 4)
        self.assertEqual(rows["S2"]["present"], 4)
        self.assertEqual(rows["S2"]["percent"], 100.0)

    def test_analytics_subject_filter(self):
        for lesson in self.lessons[:2]:
            Attendance.objects.create(lesson=lesson, student=self.student_one, status="present")
        response = self.client.get(
            "/api/analytics/",
            {"group": "TEST-1", "student_id": "S1", "subject": "Информатика"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["total_lessons"], 2)
        self.assertEqual(response.data[0]["percent"], 100.0)

    def test_journal(self):
        Attendance.objects.create(
            lesson=self.lessons[0], student=self.student_one, status="present"
        )
        response = self.client.get("/api/journal/", {"group": "TEST-1"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["student_fio"], "Иванов Иван")
        self.assertEqual(response.data[0]["date"], "2026-11-02")

    def test_import_schedule_from_xlsx(self):
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(
            [
                "Дата",
                "Время",
                "Предмет",
                "Преподаватель",
                "Аудитория",
                "Группа",
                "Тип",
            ]
        )
        sheet.append(
            [
                "10.11.2026",
                "10:10-11:40",
                "Физика",
                "Новиков Н.Н.",
                "1-100",
                "TEST-1",
                "л.",
            ]
        )
        buffer = BytesIO()
        workbook.save(buffer)
        upload = SimpleUploadedFile(
            "schedule.xlsx",
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        self.auth()
        response = self.client.post(
            "/api/lessons/import/", {"file": upload}, format="multipart"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created"], 1)

        lesson = Lesson.objects.get(subject="Физика")
        self.assertEqual(lesson.lesson_date, date(2026, 11, 10))
        self.assertEqual(lesson.groups.first().group_name, "TEST-1")
        self.assertIsNotNone(Teacher.objects.get(fio="Новиков Н.Н.").login)

    def test_checkin_by_token(self):
        token = str(self.lessons[0].checkin_token)

        info = self.client.get(f"/api/check-in/{token}/")
        self.assertEqual(info.status_code, 200)
        self.assertEqual(info.data["lesson"]["id"], self.lessons[0].id)
        self.assertEqual(len(info.data["students"]), 2)

        response = self.client.post(
            f"/api/check-in/{token}/",
            {"student_id": "S1"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "present")
        self.assertTrue(
            Attendance.objects.filter(
                lesson=self.lessons[0],
                student=self.student_one,
                status="present",
            ).exists()
        )

        other_group = Group.objects.create(group_name="TEST-3")
        Student.objects.create(student_id="S9", fio="Чужой", group=other_group)
        response = self.client.post(
            f"/api/check-in/{token}/",
            {"student_id": "S9"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_reports_xlsx_and_pdf(self):
        for lesson in self.lessons:
            Attendance.objects.create(
                lesson=lesson, student=self.student_one, status="present"
            )
            Attendance.objects.create(
                lesson=lesson, student=self.student_two, status="absent"
            )

        response = self.client.get("/api/reports/analytics.xlsx", {"group": "TEST-1"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("spreadsheetml", response["Content-Type"])
        self.assertTrue(b"".join(response.streaming_content).startswith(b"PK"))

        response = self.client.get("/api/reports/analytics.pdf", {"group": "TEST-1"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(b"".join(response.streaming_content).startswith(b"%PDF"))

        response = self.client.get(f"/api/reports/lessons/{self.lessons[0].id}.xlsx")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(b"".join(response.streaming_content).startswith(b"PK"))

        response = self.client.get(f"/api/reports/lessons/{self.lessons[0].id}.pdf")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(b"".join(response.streaming_content).startswith(b"%PDF"))

    def test_invalid_status_and_foreign_student(self):
        self.auth()
        response = self.client.post(
            f"/api/lessons/{self.lessons[0].id}/attendance/",
            {"records": [{"student_id": "S1", "status": "unknown"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        other_group = Group.objects.create(group_name="TEST-2")
        Student.objects.create(
            student_id="S3", fio="Чужой Студент", group=other_group
        )
        response = self.client.post(
            f"/api/lessons/{self.lessons[0].id}/attendance/",
            {"records": [{"student_id": "S3", "status": "present"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_cors_preflight(self):
        response = self.client.options(
            "/api/lessons/",
            HTTP_ORIGIN="http://localhost:5173",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            "http://localhost:5173",
        )

    def test_meta_and_students(self):
        response = self.client.get("/api/meta/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["groups"], ["TEST-1"])
        self.assertEqual(response.data["subjects"], ["Информатика"])
        self.assertEqual(response.data["min_date"], "2026-11-02")

        response = self.client.get("/api/students/", {"group": "TEST-1"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual({item["student_id"] for item in response.data}, {"S1", "S2"})

    def test_health_aliases(self):
        for path in ("/health", "/health/", "/api/health/"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["status"], "ok")
