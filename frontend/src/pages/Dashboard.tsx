import React, { useState, useMemo, useRef } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Chip, Button, ToggleButton, ToggleButtonGroup, Paper, Divider,
  Snackbar, Alert
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useNavigate } from 'react-router-dom';
import { MOCK_LESSON } from '../types';
import type { Lesson } from '../types';
import { parseScheduleExcel } from '../utils/importExcel';

// Базовые моки
const INITIAL_LESSONS: Lesson[] = [
  { ...MOCK_LESSON, id: 1, lesson_date: '2026-11-02', subject: 'Теоретическая информатика', time_range: '10:10-11:40', auditory: '2-423', type_lesson: 'л.' },
  { ...MOCK_LESSON, id: 2, lesson_date: '2026-11-02', subject: 'История России', time_range: '13:40-15:10', auditory: '2-523', type_lesson: 'л.' },
  { ...MOCK_LESSON, id: 3, lesson_date: '2026-11-03', subject: 'Математика. Линейная алгебра', time_range: '08:30-10:00', auditory: '2-406', type_lesson: 'л.' },
];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>(INITIAL_LESSONS);
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState(new Date('2026-11-02'));
  
  // Стейт для импорта
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedLessons = await parseScheduleExcel(file);
      
      // Преобразуем импортированные данные в формат Lesson (для демо конвертируем дату)
      const newLessons: Lesson[] = importedLessons.map((imp, index) => ({
        id: Date.now() + index,
        lesson_date: imp.date.split('.').reverse().join('-'), // ДД.ММ.ГГГГ -> ГГГГ-ММ-ДД
        week_number: 10, // Заглушка
        weekday: new Date(imp.date.split('.').reverse().join('-')).getDay(),
        slot_no: 1,
        subject: imp.subject,
        teacher_name: imp.teacher,
        auditory: imp.auditory,
        type_lesson: imp.type,
        groups: [imp.group],
        time_range: imp.time
      }));

      setLessons(prev => [...prev, ...newLessons]);
      setSnackbar({ open: true, message: `Успешно загружено ${newLessons.length} занятий!`, severity: 'success' });
    } catch (error: any) {
      setSnackbar({ open: true, message: error.message, severity: 'error' });
    }
    
    // Сбрасываем инпут
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleViewChange = (event: React.MouseEvent<HTMLElement>, newView: 'day' | 'week' | 'month' | null) => {
    if (newView !== null) setView(newView);
  };

  const filteredLessons = useMemo(() => {
    const selectedISO = selectedDate.toISOString().split('T')[0];
    if (view === 'day') return lessons.filter(l => l.lesson_date === selectedISO);
    if (view === 'week') return lessons.filter(l => l.lesson_date >= '2026-11-02' && l.lesson_date <= '2026-11-08');
    return lessons.filter(l => l.lesson_date.startsWith('2026-11'));
  }, [view, selectedDate, lessons]);

  const groupedLessons = useMemo(() => {
    const groups: Record<string, Lesson[]> = {};
    filteredLessons.forEach(lesson => {
      if (!groups[lesson.lesson_date]) groups[lesson.lesson_date] = [];
      groups[lesson.lesson_date].push(lesson);
    });
    return Object.keys(groups).sort().reduce((acc, key) => {
      acc[key] = groups[key].sort((a, b) => a.time_range.localeCompare(b.time_range));
      return acc;
    }, {} as Record<string, Lesson[]>);
  }, [filteredLessons]);

  const LessonCard = ({ lesson }: { lesson: Lesson }) => (
    <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%', transition: '0.2s', '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' }, bgcolor: 'background.paper' }}>
      <CardContent sx={{ flexGrow: 1, p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Chip label={lesson.type_lesson} size="small" color="primary" variant="outlined" />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{lesson.auditory}</Typography>
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, lineHeight: 1.3 }}>{lesson.subject}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 0.5 }}>
          <AccessTimeIcon fontSize="small" />
          <Typography variant="body2">{lesson.time_range}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
          <GroupIcon fontSize="small" />
          <Typography variant="body2">{lesson.groups.join(', ')}</Typography>
        </Box>
      </CardContent>
      <Box sx={{ p: 2, pt: 0 }}>
        <Button fullWidth variant="outlined" size="small" onClick={() => navigate(`/lesson/${lesson.id}`)}>Отметить</Button>
      </Box>
    </Card>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Расписание</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <ToggleButtonGroup value={view} exclusive onChange={handleViewChange} size="small">
            <ToggleButton value="day">День</ToggleButton>
            <ToggleButton value="week">Неделя</ToggleButton>
            <ToggleButton value="month">Месяц</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
             <Button variant="outlined" size="small" sx={{ minWidth: 'auto', px: 1 }}><ChevronLeftIcon /></Button>
             <Typography variant="subtitle2" sx={{ fontWeight: 600, minWidth: 120, textAlign: 'center' }}>
               {view === 'day' ? selectedDate.toLocaleDateString('ru-RU') : 'Ноябрь 2026'}
             </Typography>
             <Button variant="outlined" size="small" sx={{ minWidth: 'auto', px: 1 }}><ChevronRightIcon /></Button>
          </Box>
        </Box>
      </Box>

      {/* Блок импорта */}
      <Paper
        sx={{ p: 3, border: '2px dashed', borderColor: 'primary.main', borderRadius: 3, textAlign: 'center', cursor: 'pointer', bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) {
            // Эмуляция события загрузки
            const fakeEvent = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
            handleFileUpload(fakeEvent);
          }
        }}
      >
        <CloudUploadIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
        <Typography variant="h6" fontWeight={600}>Импорт расписания из Excel</Typography>
        <Typography variant="body2" color="text.secondary">Перетащите файл сюда или нажмите для выбора</Typography>
        <input type="file" hidden ref={fileInputRef} accept=".xlsx, .xls" onChange={handleFileUpload} />
      </Paper>

      {/* Вид: День */}
      {view === 'day' && (
         <Grid container spacing={3}>
           {filteredLessons.length === 0 ? <Grid size={12}><Typography color="text.secondary">На этот день занятий нет.</Typography></Grid> : filteredLessons.map(lesson => (
             <Grid key={lesson.id} size={{ xs: 12, sm: 6, md: 4 }}><LessonCard lesson={lesson} /></Grid>
           ))}
         </Grid>
      )}

      {/* Вид: Неделя / Месяц */}
      {view !== 'day' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
           {Object.entries(groupedLessons).map(([date, lessons]) => {
             const dateObj = new Date(date);
             const isToday = date === '2026-11-02';
             return (
               <Paper key={date} sx={{ p: 2.5, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                 <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                   <Typography variant="h6" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                     {dateObj.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
                   </Typography>
                   {isToday && <Chip label="Сегодня" size="small" color="primary" />}
                   <Divider sx={{ flex: 1 }} />
                   <Typography variant="body2" color="text.secondary">{lessons.length} занятия</Typography>
                 </Box>
                 <Grid container spacing={2}>
                   {lessons.map(lesson => (
                     <Grid key={lesson.id} size={{ xs: 12, sm: 6, md: 4 }}><LessonCard lesson={lesson} /></Grid>
                   ))}
                 </Grid>
               </Paper>
             );
           })}
        </Box>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default Dashboard;