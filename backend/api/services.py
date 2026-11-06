from django.db.models import Count

from .models import Attendance, Lesson, Student


def get_analytics_rows(
    *,
    group: str | None = None,
    student_id: str | None = None,
    subject: str | None = None,
    date_from=None,
    date_to=None,
) -> list[dict]:
    students = Student.objects.select_related("group")
    if group:
        students = students.filter(group_id=group)
    if student_id:
        students = students.filter(student_id=student_id)

    result = []
    for student in students:
        lessons = Lesson.objects.filter(
            groups__group_name=student.group_id,
            attendance__isnull=False,
        )
        if subject:
            lessons = lessons.filter(subject=subject)
        if date_from:
            lessons = lessons.filter(lesson_date__gte=date_from)
        if date_to:
            lessons = lessons.filter(lesson_date__lte=date_to)
        lessons = lessons.distinct()

        total_lessons = lessons.count()
        status_counts = {
            row["status"]: row["count"]
            for row in Attendance.objects.filter(
                lesson__in=lessons,
                student=student,
            )
            .values("status")
            .annotate(count=Count("id"))
        }
        recorded = sum(status_counts.values())
        present = status_counts.get(Attendance.STATUS_PRESENT, 0)
        late = status_counts.get(Attendance.STATUS_LATE, 0)
        excused = status_counts.get(Attendance.STATUS_EXCUSED, 0)
        absent = status_counts.get(Attendance.STATUS_ABSENT, 0) + max(
            0, total_lessons - recorded
        )
        percent = (
            round((present + late) * 100 / total_lessons, 1) if total_lessons else 0.0
        )

        result.append(
            {
                "student_id": student.student_id,
                "fio": student.fio,
                "group_name": student.group_id,
                "total_lessons": total_lessons,
                "present": present,
                "absent": absent,
                "late": late,
                "excused": excused,
                "percent": percent,
            }
        )

    result.sort(key=lambda row: row["fio"])
    return result


def get_lesson_students(lesson: Lesson):
    group_names = list(lesson.groups.values_list("group_name", flat=True))
    return (
        Student.objects.select_related("group")
        .filter(group_id__in=group_names)
        .order_by("fio")
    )


def get_lesson_attendance_map(lesson: Lesson) -> dict[str, str]:
    return {
        record.student_id: record.status
        for record in Attendance.objects.filter(lesson=lesson)
    }
