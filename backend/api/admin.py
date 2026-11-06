from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Attendance, Group, Lesson, LessonGroup, Slot, Student, Teacher, User


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    search_fields = ["group_name"]


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ["student_id", "fio", "group", "is_head"]
    list_filter = ["group", "is_head"]
    search_fields = ["student_id", "fio"]


@admin.register(Slot)
class SlotAdmin(admin.ModelAdmin):
    list_display = ["slot_no", "time_range"]


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ["fio", "login"]
    search_fields = ["fio", "login"]


class LessonGroupInline(admin.TabularInline):
    model = LessonGroup
    extra = 1


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ["id", "lesson_date", "slot", "subject", "teacher", "auditory"]
    list_filter = ["lesson_date", "subject", "teacher"]
    search_fields = ["subject", "auditory"]
    inlines = [LessonGroupInline]


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ["lesson", "student", "status", "marked_at"]
    list_filter = ["status", "lesson__lesson_date"]
    search_fields = ["student__fio", "student_id"]


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Учёт посещаемости", {"fields": ("role", "student", "teacher")}),
    )
    list_display = ["username", "role", "student", "teacher", "is_staff"]
    list_filter = ["role", "is_staff", "is_superuser"]
