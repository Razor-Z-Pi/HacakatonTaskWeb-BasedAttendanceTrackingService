import re
from datetime import date, datetime, time
from io import BytesIO

from django.db import transaction
from django.db.models import Max
from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException

from .models import Group, Lesson, LessonGroup, Slot, Teacher, User
from .naming import make_teacher_login

HEADER_ALIASES = {
    "date": {"дата", "date"},
    "time": {"время", "пара", "time", "slot"},
    "subject": {"предмет", "дисциплина", "subject"},
    "teacher": {"преподаватель", "учитель", "teacher"},
    "auditory": {"аудитория", "кабинет", "auditory", "room"},
    "group": {"группа", "group"},
    "type": {"тип", "вид", "type", "type_lesson"},
}


def _normalize(value) -> str:
    return str(value).strip().lower() if value is not None else ""


def _find_columns(rows: list[tuple]) -> tuple[int, dict[str, int]]:
    for row_index, row in enumerate(rows):
        values = [_normalize(value) for value in row]
        mapping: dict[str, int] = {}
        for key, aliases in HEADER_ALIASES.items():
            for index, value in enumerate(values):
                if value in aliases:
                    mapping[key] = index
                    break
        if "date" in mapping and "subject" in mapping:
            return row_index, mapping
    raise ValueError(
        "Не найдена строка заголовков. Нужны колонки «Дата» и «Предмет»."
    )


def _cell(row: tuple, mapping: dict[str, int], key: str):
    index = mapping.get(key)
    if index is None or index >= len(row):
        return None
    return row[index]


def _parse_date(value) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        # Excel serial date (e.g. 46327 for 2026-11-10).
        from openpyxl.utils.datetime import from_excel

        try:
            return from_excel(value).date()
        except (TypeError, ValueError, OverflowError):
            return None
    text = str(value).strip()
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y", "%d.%m.%y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _resolve_slot(value) -> Slot | None:
    if value is None or str(value).strip() == "":
        return None

    if isinstance(value, time):
        value = value.strftime("%H:%M")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        slot_no = int(value)
        slot = Slot.objects.filter(slot_no=slot_no).first()
        if slot:
            return slot
        return Slot.objects.create(slot_no=slot_no, time_range=f"Пара {slot_no}")

    text = str(value).strip()
    if text.isdigit():
        slot_no = int(text)
        slot = Slot.objects.filter(slot_no=slot_no).first()
        if slot:
            return slot
        return Slot.objects.create(slot_no=slot_no, time_range=f"Пара {slot_no}")

    slot = Slot.objects.filter(time_range=text).first()
    if slot:
        return slot

    start = text.split("-")[0].strip()
    if start:
        slot = Slot.objects.filter(time_range__startswith=start).first()
        if slot:
            return slot

    next_no = (Slot.objects.aggregate(max_no=Max("slot_no"))["max_no"] or 0) + 1
    return Slot.objects.create(slot_no=next_no, time_range=text)


def _get_teacher(fio: str | None) -> Teacher | None:
    if not fio:
        return None
    teacher, _ = Teacher.objects.get_or_create(fio=fio.strip())
    if not teacher.login:
        base = make_teacher_login(teacher.fio)
        candidate = base
        counter = 2
        while (
            Teacher.objects.filter(login=candidate).exclude(pk=teacher.pk).exists()
            or User.objects.filter(username=candidate).exists()
        ):
            candidate = f"{base}{counter}"
            counter += 1
        teacher.login = candidate
        teacher.save(update_fields=["login"])

    user, created = User.objects.get_or_create(username=teacher.login)
    User.objects.filter(teacher=teacher).exclude(pk=user.pk).update(teacher=None)
    user.role = User.ROLE_TEACHER
    user.teacher = teacher
    user.student = None
    if created or not user.password:
        user.set_password("1234")
    user.save()
    return teacher


def _parse_groups(value) -> list[Group]:
    if value is None:
        return []
    names = [item.strip() for item in re.split(r"[,;/]", str(value)) if item.strip()]
    groups = []
    for name in names:
        group, _ = Group.objects.get_or_create(group_name=name)
        groups.append(group)
    return groups


@transaction.atomic
def import_schedule(upload) -> dict:
    try:
        workbook = load_workbook(BytesIO(upload.read()), data_only=True)
    except (InvalidFileException, OSError, ValueError) as exc:
        raise ValueError("Не удалось прочитать Excel-файл. Нужен формат .xlsx.") from exc

    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        raise ValueError("Файл пустой.")

    header_index, mapping = _find_columns(rows)
    created = 0
    skipped = 0
    errors = []
    next_lesson_id = (Lesson.objects.aggregate(max_id=Max("id"))["max_id"] or 0) + 1

    for row_number, row in enumerate(rows[header_index + 1 :], start=header_index + 2):
        subject = _cell(row, mapping, "subject")
        date_value = _cell(row, mapping, "date")
        if not subject and not date_value:
            continue

        if not subject:
            errors.append(f"Строка {row_number}: не указан предмет.")
            continue
        lesson_date = _parse_date(date_value)
        if lesson_date is None:
            errors.append(f"Строка {row_number}: неверная дата.")
            continue

        groups = _parse_groups(_cell(row, mapping, "group"))
        if not groups:
            errors.append(f"Строка {row_number}: не указана группа.")
            continue

        slot = _resolve_slot(_cell(row, mapping, "time"))
        if slot is None:
            errors.append(f"Строка {row_number}: не указано время/пара.")
            continue

        teacher = _get_teacher(_cell(row, mapping, "teacher"))
        subject_text = str(subject).strip()

        lesson = Lesson.objects.filter(
            lesson_date=lesson_date,
            slot=slot,
            subject=subject_text,
            teacher=teacher,
        ).first()

        if lesson is None:
            lesson = Lesson.objects.create(
                id=next_lesson_id,
                lesson_date=lesson_date,
                week_number=lesson_date.isocalendar().week,
                weekday=lesson_date.isoweekday(),
                slot=slot,
                subject=subject_text,
                teacher=teacher,
                auditory=str(_cell(row, mapping, "auditory") or "").strip(),
                type_lesson=str(_cell(row, mapping, "type") or "л.").strip(),
            )
            next_lesson_id += 1
            created += 1
        else:
            skipped += 1

        for group in groups:
            LessonGroup.objects.get_or_create(lesson=lesson, group=group)

    return {"created": created, "skipped": skipped, "errors": errors}
