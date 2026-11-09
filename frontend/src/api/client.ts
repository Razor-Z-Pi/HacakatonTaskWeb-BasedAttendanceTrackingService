import type {
  AnalyticsFilters,
  AttendanceRecord,
  AttendanceStat,
  AttendanceStatus,
  CheckInInfo,
  CheckInResult,
  ImportResult,
  JournalEntry,
  JournalFilters,
  Lesson,
  Meta,
  Student,
  User,
} from '../types';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

interface LessonAttendanceResponse {
  lesson_id: number;
  records: AttendanceRecord[];
}

interface SaveAttendanceResponse extends LessonAttendanceResponse {
  saved: number;
}

interface RequestOptions extends RequestInit {
  body?: BodyInit | null;
}

function buildQuery(params: object): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object') {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    const parts = Object.entries(payload as Record<string, unknown>)
      .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
      .filter(Boolean);
    if (parts.length) return parts.join('; ');
  }
  return `Ошибка запроса (${status})`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = localStorage.getItem('access_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/login/')) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    throw new ApiError(errorMessage(payload, response.status), response.status);
  }

  return payload as T;
}

async function download(path: string, fallbackName: string): Promise<void> {
  const headers = new Headers();
  const token = localStorage.getItem('access_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, { headers });
  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    throw new ApiError(errorMessage(payload, response.status), response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const asciiName = disposition.match(/filename="?([^";]+)"?/i);
  const filename = utf8Name
    ? decodeURIComponent(utf8Name[1])
    : asciiName
      ? asciiName[1]
      : fallbackName;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export const api = {
  login: (login: string, password: string) =>
    request<LoginResponse>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),

  getMe: () => request<User>('/auth/me/'),

  getMeta: () => request<Meta>('/meta/'),

  getStudents: (group?: string) =>
    request<Student[]>(`/students/${buildQuery({ group })}`),

  getLessons: (filters: {
    date_from?: string;
    date_to?: string;
    group?: string;
    subject?: string;
    teacher_id?: number;
  } = {}) => request<Lesson[]>(`/lessons/${buildQuery(filters)}`),

  getLesson: (lessonId: number) => request<Lesson>(`/lessons/${lessonId}/`),

  getLessonStudents: (lessonId: number) =>
    request<Student[]>(`/lessons/${lessonId}/students/`),

  getLessonAttendance: (lessonId: number) =>
    request<LessonAttendanceResponse>(`/lessons/${lessonId}/attendance/`),

  importSchedule: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<ImportResult>('/lessons/import/', {
      method: 'POST',
      body: formData,
    });
  },

  getCheckinToken: (lessonId: number) =>
    request<{ lesson_id: number; token: string }>(`/lessons/${lessonId}/checkin/`),

  getCheckInInfo: (token: string) =>
    request<CheckInInfo>(`/check-in/${token}/`),

  checkIn: (token: string, studentId: string) =>
    request<CheckInResult>(`/check-in/${token}/`, {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId }),
    }),

  saveAttendance: (
    lessonId: number,
    records: Array<{ student_id: string; status: AttendanceStatus }>,
  ) =>
    request<SaveAttendanceResponse>(`/lessons/${lessonId}/attendance/`, {
      method: 'POST',
      body: JSON.stringify({ records }),
    }),

  downloadAnalyticsReport: (format: 'xlsx' | 'pdf', filters: AnalyticsFilters = {}) =>
    download(
      `/reports/analytics.${format}${buildQuery(filters)}`,
      `analytics_report.${format}`,
    ),

  downloadLessonReport: (lessonId: number, format: 'xlsx' | 'pdf') =>
    download(
      `/reports/lessons/${lessonId}.${format}`,
      `lesson_${lessonId}_report.${format}`,
    ),

  downloadCertificate: (fio: string, date: string) =>
    download(`/reports/certificate.pdf${buildQuery({ fio, date })}`, 'Справка.pdf'),

  getAnalytics: (filters: AnalyticsFilters = {}) =>
    request<AttendanceStat[]>(`/analytics/${buildQuery(filters)}`),

  getJournal: (filters: JournalFilters = {}) =>
    request<JournalEntry[]>(`/journal/${buildQuery(filters)}`),
};

export type { LoginResponse, LessonAttendanceResponse, SaveAttendanceResponse };
