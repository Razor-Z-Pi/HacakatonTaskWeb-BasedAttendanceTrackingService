from django.contrib import admin
from django.urls import path

from api.views import (
    AnalyticsReportView,
    AnalyticsView,
    CheckInView,
    JournalView,
    LessonAttendanceView,
    LessonCheckinTokenView,
    LessonDetailView,
    LessonImportView,
    LessonListView,
    LessonReportView,
    LessonStudentsView,
    LoginView,
    MeView,
    MetaView,
    StudentListView,
    health,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", health, name="health-root"),
    path("health/", health, name="health-root-slash"),
    path("api/health/", health, name="health"),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    path("api/auth/me/", MeView.as_view(), name="me"),
    path("api/meta/", MetaView.as_view(), name="meta"),
    path("api/students/", StudentListView.as_view(), name="students"),
    path("api/lessons/", LessonListView.as_view(), name="lessons"),
    path("api/lessons/import/", LessonImportView.as_view(), name="lessons-import"),
    path("api/lessons/<int:pk>/", LessonDetailView.as_view(), name="lesson-detail"),
    path(
        "api/lessons/<int:pk>/students/",
        LessonStudentsView.as_view(),
        name="lesson-students",
    ),
    path(
        "api/lessons/<int:pk>/attendance/",
        LessonAttendanceView.as_view(),
        name="lesson-attendance",
    ),
    path(
        "api/lessons/<int:pk>/checkin/",
        LessonCheckinTokenView.as_view(),
        name="lesson-checkin",
    ),
    path("api/check-in/<uuid:token>/", CheckInView.as_view(), name="check-in"),
    path("api/analytics/", AnalyticsView.as_view(), name="analytics"),
    path("api/journal/", JournalView.as_view(), name="journal"),
    path(
        "api/reports/analytics.<str:fmt>",
        AnalyticsReportView.as_view(),
        name="analytics-report",
    ),
    path(
        "api/reports/lessons/<int:pk>.<str:fmt>",
        LessonReportView.as_view(),
        name="lesson-report",
    ),
]
