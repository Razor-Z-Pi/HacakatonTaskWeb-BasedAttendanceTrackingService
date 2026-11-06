import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Avatar,
  ToggleButton, ToggleButtonGroup, Stack, Paper,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Snackbar, Alert, useMediaQuery, useTheme, Chip, IconButton, Tooltip,
  TextField
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import QrCodeIcon from '@mui/icons-material/QrCode';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { QRCodeSVG } from 'qrcode.react';

import { MOCK_STUDENTS, MOCK_LESSON } from '../types';
import type { Student, AttendanceStatus } from '../types';
import { exportToExcel, exportToPDF } from '../utils/export';

const AttendancePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const DRAFT_KEY = `draft_attendance_${id}`;

  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [isSaved, setIsSaved] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  
  // Стейт для Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' }>({ 
    open: false, message: '', severity: 'success' 
  });

  useEffect(() => {
    setStudents(MOCK_STUDENTS);
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try { setAttendance(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, [id, DRAFT_KEY]);

  useEffect(() => {
    if (Object.keys(attendance).length > 0 && !isSaved) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(attendance));
    }
  }, [attendance, DRAFT_KEY, isSaved]);

  // Горячие клавиши (P, A, L)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (focusMode) return; // В режиме фокуса клавиши могут конфликтовать, отключим

      if (['p', 'a', 'l', 'у', 'ф', 'д'].includes(e.key.toLowerCase())) {
        const newStatus = e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 'у' ? 'present' : 
                          e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'ф' ? 'absent' : 'late';
        
        setAttendance(prev => {
          const next = { ...prev };
          students.forEach(s => {
            if (!next[s.student_id]) next[s.student_id] = newStatus as AttendanceStatus;
          });
          return next;
        });
        
        setSnackbar({ open: true, message: `Горячая клавиша: отмечено "${newStatus}"`, severity: 'info' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [students, focusMode]);

  const handleStatusChange = (studentId: string, newStatus: AttendanceStatus | null) => {
    if (!newStatus) return;
    setAttendance((prev) => ({ ...prev, [studentId]: newStatus }));
  };

  const markAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach((s) => (next[s.student_id] = status));
    setAttendance(next);
  };

  const handleSubmit = () => {
    console.log('POST /api/lessons/{id}/attendance/', { lesson_id: id, records: attendance });
    localStorage.removeItem(DRAFT_KEY);
    setIsSaved(true);
    setOpenConfirm(false);
    
    setSnackbar({ 
      open: true, 
      message: `Данные сохранены! Уведомление отправлено куратору группы ${MOCK_LESSON.groups[0]}.`, 
      severity: 'success' 
    });
  };

  // Подготовка данных для экспорта
  const exportData = students.map(s => ({
    student_id: s.student_id,
    fio: s.fio,
    group_name: s.group_name,
    total_lessons: 1,
    present: attendance[s.student_id] === 'present' ? 1 : 0,
    absent: attendance[s.student_id] === 'absent' ? 1 : 0,
    late: attendance[s.student_id] === 'late' ? 1 : 0,
    excused: attendance[s.student_id] === 'excused' ? 1 : 0,
    percent: attendance[s.student_id] === 'present' ? 100 : 0,
  }));

  const markedCount = Object.keys(attendance).length;
  const totalCount = students.length;
  const checkinUrl = `${window.location.origin}/check-in/${id}`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Шапка */}
      {!focusMode && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} variant="outlined" color="inherit">
            Назад
          </Button>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{MOCK_LESSON.subject}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {MOCK_LESSON.lesson_date} · {MOCK_LESSON.time_range} · Ауд. {MOCK_LESSON.auditory} · {MOCK_LESSON.teacher_name}
            </Typography>
          </Box>
          <Tooltip title={focusMode ? "Выйти из режима фокуса" : "Режим фокуса"}>
            <IconButton onClick={() => setFocusMode(!focusMode)} color="primary">
              {focusMode ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Панель действий (скрывается в фокусе) */}
      {!focusMode && (
        <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => markAll('present')}>
              Все присутствуют (P)
            </Button>
            <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={() => markAll('absent')}>
              Все отсутствуют (A)
            </Button>
            <Button variant="outlined" startIcon={<QrCodeIcon />} onClick={() => setQrOpen(true)}>
              QR-код
            </Button>
          </Stack>

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip label="Черновик сохраняется" size="small" color="info" variant="outlined" />
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              Отмечено: <Box component="span" sx={{ color: 'primary.main' }}>{markedCount}</Box> / {totalCount}
            </Typography>
          </Stack>
        </Paper>
      )}

      {/* Список студентов */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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

      {/* Панель сохранения */}
      <Paper elevation={4} sx={{ position: 'sticky', bottom: 16, p: 2, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 2, border: 1, borderColor: 'divider', zIndex: 10 }}>
        {isSaved && (
          <>
            <Button variant="outlined" color="success" startIcon={<FileDownloadIcon />} onClick={() => exportToExcel(exportData, `Отчет_${id}`)}>
              Excel
            </Button>
            <Button variant="outlined" color="error" startIcon={<FileDownloadIcon />} onClick={() => exportToPDF(exportData, `Отчет по паре ${MOCK_LESSON.subject}`, `Отчет_${id}`)}>
              PDF
            </Button>
          </>
        )}
        {isSaved ? (
          <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} disabled>
            Отправлено
          </Button>
        ) : (
          <Button variant="contained" size="large" endIcon={<SendIcon />} disabled={markedCount === 0} onClick={() => setOpenConfirm(true)}>
            Сохранить и отправить
          </Button>
        )}
      </Paper>

      {/* Модалка подтверждения */}
      <Dialog open={openConfirm} onClose={() => setOpenConfirm(false)}>
        <DialogTitle>Подтверждение отправки</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы отметили {markedCount} из {totalCount} студентов. Сохранить данные?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirm(false)} color="inherit">Отмена</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">Сохранить</Button>
        </DialogActions>
      </Dialog>

      {/* Модалка QR-кода */}
      <Dialog open={qrOpen} onClose={() => setQrOpen(false)}>
        <DialogTitle sx={{ textAlign: 'center' }}>Сканируйте для отметки</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
          <Paper sx={{ p: 3, borderRadius: 4, bgcolor: 'white' }}>
            <QRCodeSVG value={checkinUrl} size={256} />
          </Paper>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Студенты сканируют QR-код и отмечаются сами
          </Typography>
        </DialogContent>
      </Dialog>

      {/* Уведомления */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AttendancePage;