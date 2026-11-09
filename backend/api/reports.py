from datetime import date
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from django.conf import settings
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import Attendance

FONT_NAME = "Helvetica"
_FONT_REGISTERED = False


def _ensure_font() -> str:
    global FONT_NAME, _FONT_REGISTERED
    if _FONT_REGISTERED:
        return FONT_NAME

    candidates = [
        settings.BASE_DIR / "assets" / "DejaVuSans.ttf",
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/usr/share/fonts/dejavu/DejaVuSans.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/Arial.ttf"),
    ]
    for path in candidates:
        if path.exists():
            try:
                pdfmetrics.registerFont(TTFont("AttendanceFont", str(path)))
                FONT_NAME = "AttendanceFont"
                break
            except Exception:
                continue
    _FONT_REGISTERED = True
    return FONT_NAME


def _today() -> str:
    return date.today().strftime("%d.%m.%Y")


def _analytics_rows(rows: list[dict]) -> list[list]:
    return [
        [
            index,
            row["fio"],
            row["group_name"],
            row["total_lessons"],
            row["present"],
            row["absent"],
            row["late"],
            row["excused"],
            row["percent"],
        ]
        for index, row in enumerate(rows, start=1)
    ]


def _lesson_rows(students, status_map: dict[str, str]) -> list[list]:
    labels = dict(Attendance.STATUS_CHOICES)
    return [
        [
            index,
            student.fio,
            student.group_id,
            labels.get(status_map.get(student.student_id), "—"),
        ]
        for index, student in enumerate(students, start=1)
    ]


def _workbook(title: str, headers: list[str], rows: list[list], widths: list[int]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Отчёт"
    last_column = get_column_letter(len(headers))

    sheet.merge_cells(f"A1:{last_column}1")
    sheet["A1"] = title
    sheet["A1"].font = Font(name="Arial", size=14, bold=True)
    sheet["A1"].alignment = Alignment(horizontal="center")
    sheet["A2"] = f"Дата формирования: {_today()}"
    sheet["A2"].font = Font(name="Arial", size=10, color="666666")

    header_row = 4
    header_fill = PatternFill("solid", fgColor="2563EB")
    for column, header in enumerate(headers, start=1):
        cell = sheet.cell(row=header_row, column=column, value=header)
        cell.font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for row_index, row in enumerate(rows, start=header_row + 1):
        for column, value in enumerate(row, start=1):
            cell = sheet.cell(row=row_index, column=column, value=value)
            cell.font = Font(name="Arial", size=10)
            cell.alignment = Alignment(vertical="center", wrap_text=True)
        if row_index % 2 == 0:
            for column in range(1, len(headers) + 1):
                sheet.cell(row=row_index, column=column).fill = PatternFill(
                    "solid", fgColor="F8FAFC"
                )

    for index, width in enumerate(widths, start=1):
        sheet.column_dimensions[get_column_letter(index)].width = width

    sheet.freeze_panes = f"A{header_row + 1}"
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _pdf(
    title: str,
    headers: list[str],
    rows: list[list],
    *,
    landscape_mode: bool = True,
    column_widths: list[float] | None = None,
) -> bytes:
    font = _ensure_font()
    buffer = BytesIO()
    pagesize = landscape(A4) if landscape_mode else A4
    document = SimpleDocTemplate(
        buffer,
        pagesize=pagesize,
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title=title,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontName=font,
        fontSize=16,
        leading=20,
        spaceAfter=4,
    )
    meta_style = ParagraphStyle(
        "ReportMeta",
        parent=styles["Normal"],
        fontName=font,
        fontSize=9,
        textColor=colors.HexColor("#555555"),
        spaceAfter=10,
    )
    cell_style = ParagraphStyle(
        "ReportCell",
        parent=styles["Normal"],
        fontName=font,
        fontSize=7,
        leading=9,
    )
    header_style = ParagraphStyle(
        "ReportHeader",
        parent=cell_style,
        textColor=colors.white,
    )

    story = [
        Paragraph(title, title_style),
        Paragraph(f"Дата формирования: {_today()}", meta_style),
    ]

    table_data = [[Paragraph(str(header), header_style) for header in headers]]
    for row in rows:
        table_data.append([Paragraph(str(value), cell_style) for value in row])

    table = Table(
        table_data,
        colWidths=column_widths,
        repeatRows=1,
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), font),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5E1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(table)
    document.build(story)
    return buffer.getvalue()


def analytics_workbook(rows: list[dict], title: str) -> bytes:
    headers = [
        "№",
        "ФИО",
        "Группа",
        "Всего",
        "Присут.",
        "Отсут.",
        "Опоздал",
        "Уваж.",
        "%",
    ]
    return _workbook(
        title,
        headers,
        _analytics_rows(rows),
        [6, 30, 12, 10, 12, 12, 12, 12, 10],
    )


def analytics_pdf(rows: list[dict], title: str) -> bytes:
    headers = [
        "№",
        "ФИО",
        "Группа",
        "Всего",
        "Присут.",
        "Отсут.",
        "Опоздал",
        "Уваж.",
        "%",
    ]
    return _pdf(
        title,
        headers,
        _analytics_rows(rows),
        column_widths=[10 * mm, 62 * mm, 22 * mm, 18 * mm, 20 * mm, 20 * mm, 20 * mm, 20 * mm, 16 * mm],
    )


def lesson_workbook(lesson, students, status_map: dict[str, str]) -> bytes:
    title = f"Отчёт по паре: {lesson.subject} ({lesson.lesson_date.strftime('%d.%m.%Y')})"
    headers = ["№", "ФИО", "Группа", "Статус"]
    return _workbook(
        title,
        headers,
        _lesson_rows(students, status_map),
        [6, 38, 16, 20],
    )


def lesson_pdf(lesson, students, status_map: dict[str, str]) -> bytes:
    title = f"Отчёт по паре: {lesson.subject} ({lesson.lesson_date.strftime('%d.%m.%Y')})"
    headers = ["№", "ФИО", "Группа", "Статус"]
    return _pdf(
        title,
        headers,
        _lesson_rows(students, status_map),
        landscape_mode=False,
        column_widths=[12 * mm, 80 * mm, 30 * mm, 40 * mm],
    )


def certificate_pdf(student_name: str, date_text: str) -> bytes:
    font = _ensure_font()
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title="Справка об отсутствии",
    )

    styles = getSampleStyleSheet()
    header_style = ParagraphStyle(
        "CertificateHeader",
        parent=styles["Normal"],
        fontName=font,
        fontSize=13,
        leading=18,
        alignment=1,
        spaceAfter=24,
    )
    title_style = ParagraphStyle(
        "CertificateTitle",
        parent=styles["Title"],
        fontName=font,
        fontSize=18,
        leading=24,
        alignment=1,
        spaceAfter=24,
    )
    body_style = ParagraphStyle(
        "CertificateBody",
        parent=styles["Normal"],
        fontName=font,
        fontSize=12,
        leading=20,
        spaceAfter=10,
    )
    stamp_style = ParagraphStyle(
        "CertificateStamp",
        parent=styles["Normal"],
        fontName=font,
        fontSize=11,
        leading=16,
        alignment=1,
        textColor=colors.HexColor("#B91C1C"),
    )

    stamp = Table(
        [[Paragraph("ПЕЧАТЬ", stamp_style)]],
        colWidths=[40 * mm],
        rowHeights=[40 * mm],
    )
    stamp.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 2, colors.HexColor("#B91C1C")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )

    story = [
        Paragraph("МИНИСТЕРСТВО НАУКИ И ВЫСШЕГО ОБРАЗОВАНИЯ РФ", header_style),
        Paragraph("СПРАВКА ОБ ОТСУТСТВИИ", title_style),
        Paragraph(f"Студент: {escape(student_name)}", body_style),
        Paragraph(f"Дата: {escape(date_text)}", body_style),
        Paragraph(
            "Основание: уважительная причина (документально подтверждено)",
            body_style,
        ),
        Spacer(1, 18 * mm),
        stamp,
    ]
    document.build(story)
    return buffer.getvalue()
