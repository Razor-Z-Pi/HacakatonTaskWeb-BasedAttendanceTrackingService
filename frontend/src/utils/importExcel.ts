import * as XLSX from 'xlsx';

// Формат строки, которую мы ожидаем от Excel
export interface ImportedLesson {
  date: string;
  time: string;
  subject: string;
  teacher: string;
  auditory: string;
  group: string;
  type: string;
}

export const parseScheduleExcel = (file: File): Promise<ImportedLesson[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Превращаем в JSON
        const rawData = XLSX.utils.sheet_to_json(worksheet);

        // Маппим под наш формат (предполагаем, что в Excel колонки называются так)
        const parsedData: ImportedLesson[] = rawData.map((row: any) => ({
          date: row['Дата'] || '',
          time: row['Время'] || '',
          subject: row['Предмет'] || '',
          teacher: row['Преподаватель'] || '',
          auditory: row['Аудитория'] || '',
          group: row['Группа'] || '',
          type: row['Тип'] || 'л.'
        })).filter(l => l.subject && l.date); // Отсеиваем пустые строки

        resolve(parsedData);
      } catch (err) {
        reject(new Error('Ошибка чтения файла. Убедитесь, что это Excel-файл.'));
      }
    };

    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsBinaryString(file);
  });
};