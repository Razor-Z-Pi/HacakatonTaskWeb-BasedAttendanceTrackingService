import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AttendanceStat } from '../types';

export const exportToExcel = (data: AttendanceStat[], title: string = 'Отчет по посещаемости') => {
  const worksheetData = data.map((row, idx) => ({
    '№': idx + 1,
    'ФИО': row.fio,
    'Группа': row.group_name,
    'Всего занятий': row.total_lessons,
    'Присутствовал': row.present,
    'Отсутствовал': row.absent,
    'Опоздал': row.late,
    'Уважительная': row.excused,
    'Процент': `${row.percent}%`,
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  
  // Добавляем заголовок над таблицей (опционально)
  XLSX.utils.sheet_add_aoa(worksheet, [[title], []], { origin: 'A1' });
  
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Посещаемость');
  XLSX.writeFile(workbook, `${title.replace(/ /g, '_')}.xlsx`);
};

export const exportToPDF = (
  data: AttendanceStat[],
  title = 'Отчёт по посещаемости',
  filename = 'attendance_report',
) => {
  const doc = new jsPDF('landscape');

  // Заголовок
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Дата формирования: ${new Date().toLocaleDateString('ru-RU')}`, 14, 22);

  const tableData = data.map((row, idx) => [
    idx + 1,
    row.fio,
    row.group_name,
    row.total_lessons,
    row.present,
    row.absent,
    row.late,
    row.excused,
    `${row.percent}%`,
  ]);

  autoTable(doc, {
    head: [['№', 'ФИО', 'Группа', 'Всего', 'Присут.', 'Отсут.', 'Опоздал', 'Уваж.', '%']],
    body: tableData,
    startY: 28,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 8: { halign: 'center', fontStyle: 'bold' } },
  });

  doc.save(`${filename}.pdf`);
};