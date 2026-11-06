export type UserRole = 'admin' | 'teacher' | 'head' | 'student';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface User {
  id: number;
  login: string;
  role: UserRole;
  full_name: string;
  teacher_id?: number;
  student_id?: string;
}

export interface Student {
  student_id: string;
  fio: string;
  gender: 'м' | 'ж';
  group_name: string;
  is_head: boolean;
}

export interface Lesson {
  id: number;
  lesson_date: string;
  week_number: number;
  weekday: number;
  slot_no: number;
  subject: string;
  teacher_name: string;
  auditory: string;
  type_lesson: string;
  groups: string[];
  time_range: string;
}

export interface AttendanceStat {
  student_id: string;
  fio: string;
  group_name: string;
  total_lessons: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percent: number;
}

export interface JournalEntry {
  date: string; // 'YYYY-MM-DD'
  subject: string;
  student_id: string;
  student_fio: string;
  status: AttendanceStatus;
}

// --- МОКОВЫЕ ДАННЫЕ ---

export const MOCK_STUDENTS: Student[] = [
  { student_id: "STU-5001", fio: "Смирнов Артём Олегович", gender: "м", group_name: "526-1", is_head: false },
  { student_id: "STU-5002", fio: "Иванов Даниил Сергеевич", gender: "м", group_name: "526-1", is_head: false },
  { student_id: "STU-5013", fio: "Павлова Мария Николаевна", gender: "ж", group_name: "526-1", is_head: true },
  { student_id: "STU-5014", fio: "Козлова Анна Дмитриевна", gender: "ж", group_name: "526-1", is_head: false },
];

export const MOCK_LESSON: Lesson = {
  id: 8456,
  lesson_date: "2026-11-02",
  week_number: 10,
  weekday: 1,
  slot_no: 2,
  subject: "Теоретическая информатика",
  teacher_name: "Соснин Е.А.",
  auditory: "2-423",
  type_lesson: "л.",
  groups: ["526-1"],
  time_range: "10:10-11:40"
};