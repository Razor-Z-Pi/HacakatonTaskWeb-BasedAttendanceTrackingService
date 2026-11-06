import jsPDF from 'jspdf';

export const generateMedicalCertificate = (studentName: string, date: string) => {
  const doc = new jsPDF();
  
  // Мок шапки
  doc.setFontSize(14);
  doc.text('МИНИСТЕРСТВО НАУКИ И ВЫСШЕГО ОБРАЗОВАНИЯ РФ', 105, 20, { align: 'center' });
  doc.setFontSize(16);
  doc.text('СПРАВКА ОБ ОТСУТСТВИИ', 105, 40, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(`Студент: ${studentName}`, 20, 60);
  doc.text(`Дата: ${date}`, 20, 70);
  doc.text(`Основание: Уважительная причина (документально подтверждено)`, 20, 80);
  
  // Мок печати
  doc.setDrawColor(200, 0, 0);
  doc.setLineWidth(2);
  doc.circle(160, 100, 15);
  doc.text('ПЕЧАТЬ', 153, 102);
  
  doc.save(`Справка_${studentName}.pdf`);
};