export type UserRole = 'admin' | 'teacher' | 'head' | 'student';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface User {
  id: number;
  login: string;
  role: UserRole;
  full_name: string;
  teacher_id?: number | null;
  student_id?: string | null;
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
  teacher_name: string | null;
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
  group_name?: string;
  lesson_id?: number;
}

export interface AttendanceRecord {
  student_id: string;
  student_fio: string;
  status: AttendanceStatus;
  marked_at: string;
}

export interface CheckInInfo {
  lesson: Lesson;
  students: Student[];
}

export interface CheckInResult {
  lesson_id: number;
  student_id: string;
  status: AttendanceStatus;
  created: boolean;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

export interface Meta {
  groups: string[];
  subjects: string[];
  teachers: Array<{ id: number; fio: string; login?: string | null }>;
  min_date: string | null;
  max_date: string | null;
}

export interface AnalyticsFilters {
  group?: string;
  student_id?: string;
  subject?: string;
  date_from?: string;
  date_to?: string;
}

export type JournalFilters = AnalyticsFilters;
