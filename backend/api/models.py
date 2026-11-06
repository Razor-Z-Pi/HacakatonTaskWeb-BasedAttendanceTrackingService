import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class Group(models.Model):
    group_name = models.CharField(max_length=32, primary_key=True)

    class Meta:
        ordering = ["group_name"]

    def __str__(self) -> str:
        return self.group_name


class Student(models.Model):
    GENDER_CHOICES = [("м", "мужской"), ("ж", "женский")]

    student_id = models.CharField(max_length=32, primary_key=True)
    fio = models.CharField(max_length=255)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="students")
    is_head = models.BooleanField(default=False)

    class Meta:
        ordering = ["fio"]

    def __str__(self) -> str:
        return f"{self.fio} ({self.student_id})"


class Slot(models.Model):
    slot_no = models.PositiveSmallIntegerField(primary_key=True)
    time_range = models.CharField(max_length=32)

    class Meta:
        ordering = ["slot_no"]

    def __str__(self) -> str:
        return f"{self.slot_no}: {self.time_range}"


class Teacher(models.Model):
    fio = models.CharField(max_length=255, unique=True)
    login = models.CharField(max_length=64, unique=True, null=True, blank=True)

    class Meta:
        ordering = ["fio"]

    def __str__(self) -> str:
        return self.fio


class Lesson(models.Model):
    id = models.PositiveIntegerField(primary_key=True)
    lesson_date = models.DateField(db_index=True)
    week_number = models.PositiveSmallIntegerField()
    weekday = models.PositiveSmallIntegerField()
    slot = models.ForeignKey(Slot, on_delete=models.PROTECT, related_name="lessons")
    subject = models.CharField(max_length=255, db_index=True)
    teacher = models.ForeignKey(
        Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name="lessons"
    )
    auditory = models.CharField(max_length=64, blank=True)
    type_lesson = models.CharField(max_length=64, blank=True)
    checkin_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    groups = models.ManyToManyField(Group, through="LessonGroup", related_name="lessons")

    class Meta:
        ordering = ["lesson_date", "slot__slot_no", "id"]

    def __str__(self) -> str:
        return f"{self.lesson_date} {self.subject}"


class LessonGroup(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="lesson_groups")
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="lesson_groups")

    class Meta:
        unique_together = [("lesson", "group")]
        ordering = ["lesson_id", "group_id"]

    def __str__(self) -> str:
        return f"{self.lesson_id} / {self.group_id}"


class Attendance(models.Model):
    STATUS_PRESENT = "present"
    STATUS_ABSENT = "absent"
    STATUS_LATE = "late"
    STATUS_EXCUSED = "excused"
    STATUS_CHOICES = [
        (STATUS_PRESENT, "Присутствовал"),
        (STATUS_ABSENT, "Отсутствовал"),
        (STATUS_LATE, "Опоздал"),
        (STATUS_EXCUSED, "Уважительная"),
    ]

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="attendance")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="attendance")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES)
    marked_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("lesson", "student")]
        ordering = ["lesson_id", "student_id"]
        indexes = [
            models.Index(fields=["student", "lesson"]),
            models.Index(fields=["lesson", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.lesson_id} / {self.student_id}: {self.status}"


class User(AbstractUser):
    ROLE_ADMIN = "admin"
    ROLE_TEACHER = "teacher"
    ROLE_HEAD = "head"
    ROLE_STUDENT = "student"
    ROLE_CHOICES = [
        (ROLE_ADMIN, "Администратор"),
        (ROLE_TEACHER, "Преподаватель"),
        (ROLE_HEAD, "Староста"),
        (ROLE_STUDENT, "Студент"),
    ]

    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default=ROLE_STUDENT)
    student = models.OneToOneField(
        Student,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user",
    )
    teacher = models.OneToOneField(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user",
    )

    @property
    def full_name(self) -> str:
        if self.teacher_id:
            return self.teacher.fio
        if self.student_id:
            return self.student.fio
        return f"{self.first_name} {self.last_name}".strip() or self.username

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"
