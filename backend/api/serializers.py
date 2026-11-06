from rest_framework import serializers

from .models import Attendance, Group, Lesson, Student, Teacher


class UserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    login = serializers.CharField(source="username")
    role = serializers.CharField()
    full_name = serializers.CharField()
    teacher_id = serializers.IntegerField(allow_null=True)
    student_id = serializers.CharField(allow_null=True)


class LoginSerializer(serializers.Serializer):
    login = serializers.CharField()
    password = serializers.CharField(trim_whitespace=False)


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ["group_name"]


class StudentSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.group_name")

    class Meta:
        model = Student
        fields = ["student_id", "fio", "gender", "group_name", "is_head"]


class TeacherSerializer(serializers.ModelSerializer):
    class Meta:
        model = Teacher
        fields = ["id", "fio", "login"]


class LessonSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    groups = serializers.SerializerMethodField()
    time_range = serializers.CharField(source="slot.time_range")
    slot_no = serializers.IntegerField(source="slot.slot_no")

    class Meta:
        model = Lesson
        fields = [
            "id",
            "lesson_date",
            "week_number",
            "weekday",
            "slot_no",
            "subject",
            "teacher_name",
            "auditory",
            "type_lesson",
            "groups",
            "time_range",
        ]

    def get_teacher_name(self, obj: Lesson) -> str | None:
        return obj.teacher.fio if obj.teacher_id else None

    def get_groups(self, obj: Lesson) -> list[str]:
        return [group.group_name for group in obj.groups.all()]


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_fio = serializers.CharField(source="student.fio")

    class Meta:
        model = Attendance
        fields = ["student_id", "student_fio", "status", "marked_at"]


class AttendanceItemSerializer(serializers.Serializer):
    student_id = serializers.CharField()
    status = serializers.ChoiceField(choices=Attendance.STATUS_CHOICES)


class AttendanceSubmitSerializer(serializers.Serializer):
    records = AttendanceItemSerializer(many=True, allow_empty=True)


class CheckInSerializer(serializers.Serializer):
    student_id = serializers.CharField()
