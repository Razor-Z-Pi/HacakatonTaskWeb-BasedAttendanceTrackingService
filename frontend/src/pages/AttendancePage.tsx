import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Avatar,
  ToggleButton, ToggleButtonGroup, Stack, Paper,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Snackbar, Alert, Chip, IconButton, Tooltip,
  LinearProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import QrCodeIcon from '@mui/icons-material/QrCode';
import { QRCodeSVG } from 'qrcode.react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

import type { Student, AttendanceStatus, Lesson } from '../types';
import { api, ApiError } from '../api/client';

const AttendancePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const DRAFT_KEY = `draft_attendance_v2_${id}`;

  const handleBack = () => {
    if (location.key !== 'default') {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [checkinToken, setCheckinToken] = useState<string | null>(null);
  const dirtyRef = useRef<Set<string>>(new Set());

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    const lessonId = Number(id);
    if (!Number.isFinite(lessonId)) {
      setError('Некорректный идентификатор занятия.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    dirtyRef.current = new Set();
    setCheckinToken(null);
    setIsSaved(false);

    Promise.all([
      api.getLesson(lessonId),
      api.getLessonStudents(lessonId),
      api.getLessonAttendance(lessonId),
    ])
      .then(([lessonData, studentsData, attendanceData]) => {
        if (cancelled) return;
        setLesson(lessonData);
        setStudents(studentsData);

        const serverSaved: Record<string, AttendanceStatus> = {};
        attendanceData.records.forEach((record) => {
          serverSaved[record.student_id] = record.status;
        });
        const saved: Record<string, AttendanceStatus> = { ...serverSaved };

        const draft = localStorage.getItem(DRAFT_KEY);
        if (draft) {
          try {
            Object.assign(saved, JSON.parse(draft));
          } catch {
            // Ignore broken drafts.
          }
        }

        const roster = new Set(studentsData.map((student) => student.student_id));
        Object.keys(saved).forEach((studentId) => {
          if (!roster.has(studentId)) delete saved[studentId];
        });

        dirtyRef.current = new Set(
          Object.entries(saved)
            .filter(([studentId, status]) => serverSaved[studentId] !== status)
            .map(([studentId]) => studentId),
        );
        setAttendance(saved);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Не удалось загрузить занятие.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, DRAFT_KEY]);

  useEffect(() => {
    if (isSaved) return;
    const draft: Record<string, AttendanceStatus> = {};
    dirtyRef.current.forEach((studentId) => {
      const status = attendance[studentId];
      if (status) draft[studentId] = status;
    });
    if (Object.keys(draft).length > 0) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [attendance, DRAFT_KEY, isSaved]);

  // Горячие клавиши (P, A, L)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (focusMode) return;

      if (['p', 'a', 'l', 'у', 'ф', 'д'].includes(e.key.toLowerCase())) {
        const newStatus = e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 'у' ? 'present'
          : e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'ф' ? 'absent' : 'late';

        setAttendance((prev) => {
          const next = { ...prev };
          students.forEach((s) => {
            if (!next[s.student_id]) {
              next[s.student_id] = newStatus as AttendanceStatus;
              dirtyRef.current.add(s.student_id);
            }
          });
          return next;
        });
        setIsSaved(false);

        setSnackbar({ open: true, message: `Горячая клавиша: отмечено "${newStatus}"`, severity: 'success' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [students, focusMode]);

  const handleStatusChange = (studentId: string, newStatus: AttendanceStatus | null) => {
    if (!newStatus) return;
    dirtyRef.current.add(studentId);
    setAttendance((prev) => ({ ...prev, [studentId]: newStatus }));
    setIsSaved(false);
  };

  const markAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach((s) => {
      next[s.student_id] = status;
      dirtyRef.current.add(s.student_id);
    });
    setAttendance(next);
    setIsSaved(false);
  };

  const handleSubmit = async () => {
    if (!lesson) return;
    setSaving(true);
    setError('');

    try {
      const roster = new Set(students.map((student) => student.student_id));
      const records = Object.entries(attendance)
        .filter(([studentId]) => roster.has(studentId) && dirtyRef.current.has(studentId))
        .map(([studentId, status]) => ({
          student_id: studentId,
          status,
        }));
      const response = await api.saveAttendance(lesson.id, records);

      const saved: Record<string, AttendanceStatus> = {};
      response.records.forEach((record) => {
        saved[record.student_id] = record.status;
      });
      setAttendance(saved);
      dirtyRef.current.clear();
      localStorage.removeItem(DRAFT_KEY);
      setIsSaved(true);
      setOpenConfirm(false);

      setSnackbar({
        open: true,
        message: `Посещаемость сохранена. Записей: ${response.saved}.`,
        severity: 'success',
      });
    } catch (err) {
      setOpenConfirm(false);
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить посещаемость.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenQr = async () => {
    if (!lesson) return;
    setQrOpen(true);
    if (checkinToken) return;
    setQrLoading(true);
    try {
      const data = await api.getCheckinToken(lesson.id);
      setCheckinToken(data.token);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof ApiError ? err.message : 'Не удалось получить QR-код.',
        severity: 'error',
      });
      setQrOpen(false);
    } finally {
      setQrLoading(false);
    }
  };

  const handleReport = (format: 'xlsx' | 'pdf') => {
    if (!lesson) return;
    window.location.assign(api.lessonReportUrl(lesson.id, format));
  };

  const markedCount = Object.keys(attendance).length;
  const totalCount = students.length;
  const lessonTitle = lesson?.subject ?? 'Занятие';
  const checkinUrl = checkinToken
    ? `${window.location.origin}/check-in/${checkinToken}`
    : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {loading && <LinearProgress />}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      {!focusMode && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button startIcon={<ArrowBackIcon />} onClick={handleBack} variant="outlined" color="inherit">
            Назад
          </Button>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{lessonTitle}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {lesson
                ? `${lesson.lesson_date} · ${lesson.time_range} · Ауд. ${lesson.auditory} · ${lesson.teacher_name ?? '—'}`
                : 'Загрузка данных занятия...'}
            </Typography>
          </Box>
          <Tooltip title={focusMode ? 'Выйти из режима фокуса' : 'Режим фокуса'}>
            <IconButton onClick={() => setFocusMode(!focusMode)} color="primary">
              {focusMode ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {!focusMode && (
        <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => markAll('present')}>
              Все присутствуют
            </Button>
            <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={() => markAll('absent')}>
              Все отсутствуют
            </Button>
            <Button variant="outlined" startIcon={<QrCodeIcon />} onClick={handleOpenQr}>
              QR-код
            </Button>
          </Stack>

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip label={isSaved ? 'Сохранено на сервере' : 'Черновик сохраняется'} size="small" color={isSaved ? 'success' : 'info'} variant="outlined" />
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              Отмечено: <Box component="span" sx={{ color: 'primary.main' }}>{markedCount}</Box> / {totalCount}
            </Typography>
          </Stack>
        </Paper>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {!loading && students.length === 0 && (
          <Typography color="text.secondary">У занятия нет студентов.</Typography>
        )}
        {students.map((student) => {
          const currentStatus = attendance[student.student_id];
          return (
            <Card key={student.student_id} variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2, p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: { xs: '100%', md: 'auto' } }}>
                  <Avatar sx={{ bgcolor: student.gender === 'ж' ? '#f472b6' : '#60a5fa', width: 44, height: 44, fontWeight: 600 }}>
                    {student.fio.charAt(0)}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{student.fio}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{student.student_id} · {student.group_name}</Typography>
                  </Box>
                </Box>

                <ToggleButtonGroup value={currentStatus || null} exclusive onChange={(_, value) => handleStatusChange(student.student_id, value)} size={focusMode ? 'large' : 'small'} sx={{ width: { xs: '100%', md: 'auto' }, display: 'flex', justifyContent: { xs: 'space-between', md: 'flex-end' } }}>
                  <ToggleButton value="present" sx={{ flex: { xs: 1, md: 'initial' }, gap: 1, color: 'success.main', '&.Mui-selected': { bgcolor: 'success.light', color: 'success.dark' } }}><CheckCircleIcon fontSize={focusMode ? 'medium' : 'small'} /><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Присутствует</Box></ToggleButton>
                  <ToggleButton value="late" sx={{ flex: { xs: 1, md: 'initial' }, gap: 1, color: 'warning.main', '&.Mui-selected': { bgcolor: 'warning.light', color: 'warning.dark' } }}><WatchLaterIcon fontSize={focusMode ? 'medium' : 'small'} /><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Опоздал</Box></ToggleButton>
                  <ToggleButton value="excused" sx={{ flex: { xs: 1, md: 'initial' }, gap: 1, color: 'info.main', '&.Mui-selected': { bgcolor: 'info.light', color: 'info.dark' } }}><DescriptionIcon fontSize={focusMode ? 'medium' : 'small'} /><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Уважительная</Box></ToggleButton>
                  <ToggleButton value="absent" sx={{ flex: { xs: 1, md: 'initial' }, gap: 1, color: 'error.main', '&.Mui-selected': { bgcolor: 'error.light', color: 'error.dark' } }}><CancelIcon fontSize={focusMode ? 'medium' : 'small'} /><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Отсутствует</Box></ToggleButton>
                </ToggleButtonGroup>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Paper elevation={4} sx={{ position: 'sticky', bottom: 16, p: 2, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 2, border: 1, borderColor: 'divider', zIndex: 10 }}>
        {isSaved && (
          <>
            <Button variant="outlined" color="success" startIcon={<FileDownloadIcon />} onClick={() => handleReport('xlsx')}>
              Excel
            </Button>
            <Button variant="outlined" color="error" startIcon={<FileDownloadIcon />} onClick={() => handleReport('pdf')}>
              PDF
            </Button>
          </>
        )}
        {isSaved ? (
          <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} disabled>
            Отправлено
          </Button>
        ) : (
          <Button
            variant="contained"
            size="large"
            endIcon={<SendIcon />}
            disabled={markedCount === 0 || saving || loading}
            onClick={() => setOpenConfirm(true)}
          >
            {saving ? 'Сохранение...' : 'Сохранить и отправить'}
          </Button>
        )}
      </Paper>

      <Dialog open={openConfirm} onClose={() => setOpenConfirm(false)}>
        <DialogTitle>Подтверждение отправки</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы отметили {markedCount} из {totalCount} студентов. Студенты без сохранённой отметки будут считаться отсутствующими. Сохранить данные?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirm(false)} color="inherit">Отмена</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary" disabled={saving}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={qrOpen} onClose={() => setQrOpen(false)}>
        <DialogTitle sx={{ textAlign: 'center' }}>Сканируйте для отметки</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
          {qrLoading && <LinearProgress sx={{ width: '100%', mb: 2 }} />}
          {checkinUrl && (
            <>
              <Paper sx={{ p: 3, borderRadius: 4, bgcolor: 'white' }}>
                <QRCodeSVG value={checkinUrl} size={256} />
              </Paper>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                Студенты сканируют QR-код и отмечаются сами
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, wordBreak: 'break-all', textAlign: 'center' }}>
                {checkinUrl}
              </Typography>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AttendancePage;
