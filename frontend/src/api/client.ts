// Это заготовка для интеграции с Django Rest Framework

const BASE_URL = 'http://localhost:8000/api'; // Адрес Django

export const api = {
  // Получить список пар на сегодня/неделю
  getSchedule: async (date?: string) => {
    // const res = await fetch(`${BASE_URL}/schedule/?date=${date}`);
    // return res.json();
    return []; // Заглушка
  },

  // Получить студентов для конкретной пары
  getStudentsForLesson: async (lessonId: number) => {
    // const res = await fetch(`${BASE_URL}/lessons/${lessonId}/students/`);
    // return res.json();
    return [];
  },

  // Отправить посещаемость
  submitAttendance: async (lessonId: number, records: Record<string, string>) => {
    /* 
    const payload = Object.entries(records).map(([student_id, status]) => ({
      student_id,
      status
    }));
    
    const res = await fetch(`${BASE_URL}/lessons/${lessonId}/attendance/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: payload })
    });
    return res.json();
    */
    console.log("Sending to backend:", records);
    return { success: true };
  }
};