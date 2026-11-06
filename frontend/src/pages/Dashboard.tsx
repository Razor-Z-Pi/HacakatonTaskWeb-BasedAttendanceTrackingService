import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Chip, Button, ToggleButton, ToggleButtonGroup,
  Paper, Divider, Alert, LinearProgress, Snackbar,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { Lesson, Meta } from '../types';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  addDays, addMonths, endOfMonth, endOfWeek, formatRuDate, formatRuRange,
  formatISODate, parseISODate, startOfMonth, startOfWeek, todayISO,
} from '../utils/date';

type CalendarView = 'day' | 'week' | 'month';

const isCalendarView = (value: string | null): value is CalendarView =>
  value === 'day' || value === 'week' || value === 'month';

const parseDateParam = (value: string | null): Date | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = parseISODate(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [view, setView] = useState<CalendarView>(() => {
    const value = searchParams.get('view');
    return isCalendarView(value) ? value : 'week';
  });
  const [selectedDate, setSelectedDate] = useState<Date>(
    () => parseDateParam(searchParams.get('date')) ?? new Date(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const teacherId = user?.role === 'teacher' ? user.teacher_id ?? undefined : undefined;

  useEffect(() => {
    const dateValue = formatISODate(selectedDate);
    if (searchParams.get('view') === view && searchParams.get('date') === dateValue) {
      return;
    }
    setSearchParams({ view, date: dateValue }, { replace: true });
  }, [view, selectedDate, searchParams, setSearchParams]);

  useEffect(() => {
    api.getMeta()
      .then((data) => {
        setMeta(data);
        const today = todayISO();
        if (data.min_date && data.max_date && (today < data.min_date || today > data.max_date)) {
          setSelectedDate(parseISODate(data.min_date));
        }
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить справочники.');
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const range = (() => {
      if (view === 'day') {
        const value = formatISODate(selectedDate);
        return { date_from: value, date_to: value };
      }
      if (view === 'week') {
        return {
          date_from: formatISODate(startOfWeek(selectedDate)),
          date_to: formatISODate(endOfWeek(selectedDate)),
        };
      }
      return {
        date_from: formatISODate(startOfMonth(selectedDate)),
        date_to: formatISODate(endOfMonth(selectedDate)),
      };
    })();

    setLoading(true);
    setError('');
    api.getLessons({ ...range, teacher_id: teacherId })
      .then((data) => {
        if (!cancelled) setLessons(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setLessons([]);
          setError(err instanceof ApiError ? err.message : 'Не удалось загрузить расписание.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [view, selectedDate, teacherId, refreshKey]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError('');
    try {
      const result = await api.importSchedule(file);
      const metaData = await api.getMeta();
      setMeta(metaData);
      setRefreshKey((value) => value + 1);
      setSnackbar({
        open: true,
        message: `Импорт завершён: добавлено ${result.created}, пропущено ${result.skipped}${result.errors.length ? `, ошибок ${result.errors.length}` : ''}.`,
        severity: result.created > 0 || result.skipped > 0 ? 'success' : 'error',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof ApiError ? err.message : 'Не удалось импортировать расписание.',
        severity: 'error',
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleViewChange = (
    _event: React.MouseEvent<HTMLElement>,
    newView: CalendarView | null,
  ) => {
    if (newView !== null) setView(newView);
  };

  const shiftPeriod = (direction: -1 | 1) => {
    if (view === 'month') {
      setSelectedDate(addMonths(selectedDate, direction));
      return;
    }
    setSelectedDate(addDays(selectedDate, direction * (view === 'week' ? 7 : 1)));
  };

  const periodLabel = useMemo(() => {
    if (view === 'day') return formatRuDate(selectedDate);
    if (view === 'week') return formatRuRange(startOfWeek(selectedDate), endOfWeek(selectedDate));
    return selectedDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  }, [view, selectedDate]);

  const groupedLessons = useMemo(() => {
    const groups: Record<string, Lesson[]> = {};
    lessons.forEach((lesson) => {
      if (!groups[lesson.lesson_date]) groups[lesson.lesson_date] = [];
      groups[lesson.lesson_date].push(lesson);
    });
    return Object.keys(groups).sort().reduce((acc, key) => {
      acc[key] = groups[key].sort((a, b) => a.time_range.localeCompare(b.time_range));
      return acc;
    }, {} as Record<string, Lesson[]>);
  }, [lessons]);

  const LessonCard = ({ lesson }: { lesson: Lesson }) => (
    <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%', transition: '0.2s', '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' }, bgcolor: 'background.paper' }}>
      <CardContent sx={{ flexGrow: 1, p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Chip label={lesson.type_lesson || 'занятие'} size="small" color="primary" variant="outlined" />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{lesson.auditory}</Typography>
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, lineHeight: 1.3 }}>{lesson.subject}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 0.5 }}>
          <AccessTimeIcon fontSize="small" />
          <Typography variant="body2">{lesson.time_range}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 0.5 }}>
          <GroupIcon fontSize="small" />
          <Typography variant="body2">{lesson.groups.join(', ')}</Typography>
        </Box>
        {lesson.teacher_name && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {lesson.teacher_name}
          </Typography>
        )}
      </CardContent>
      <Box sx={{ p: 2, pt: 0 }}>
        <Button fullWidth variant="outlined" size="small" onClick={() => navigate(`/lesson/${lesson.id}`)}>
          Отметить
        </Button>
      </Box>
    </Card>
  );

  const today = todayISO();

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
            <Button variant="outlined" size="small" sx={{ minWidth: 'auto', px: 1 }} onClick={() => shiftPeriod(-1)}>
              <ChevronLeftIcon />
            </Button>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, minWidth: 170, textAlign: 'center' }}>
              {periodLabel}
            </Typography>
            <Button variant="outlined" size="small" sx={{ minWidth: 'auto', px: 1 }} onClick={() => shiftPeriod(1)}>
              <ChevronRightIcon />
            </Button>
          </Box>
        </Box>
      </Box>

      {(user?.role === 'teacher' || user?.role === 'admin') && (
        <Paper
          sx={{ p: 2.5, border: '2px dashed', borderColor: 'primary.main', borderRadius: 3, textAlign: 'center', cursor: importing ? 'wait' : 'pointer', bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}
          onClick={() => !importing && fileInputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (event.dataTransfer.files.length && !importing) {
              void handleFileUpload({ target: { files: event.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>);
            }
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 34, color: 'primary.main', mb: 0.5 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {importing ? 'Импорт расписания...' : 'Импорт расписания из Excel'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            .xlsx · колонки: Дата, Время, Предмет, Преподаватель, Аудитория, Группа, Тип
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept=".xlsx"
            onChange={handleFileUpload}
          />
        </Paper>
      )}

      {meta && meta.min_date && meta.max_date && (
        <Typography variant="caption" color="text.secondary">
          Доступный период расписания: {formatRuDate(parseISODate(meta.min_date))} – {formatRuDate(parseISODate(meta.max_date))}
        </Typography>
      )}

      {error && <Alert severity="error">{error}</Alert>}
      {loading && <LinearProgress />}

      {view === 'day' && (
        <Grid container spacing={3}>
          {!loading && lessons.length === 0 && (
            <Grid size={12}><Typography color="text.secondary">На этот день занятий нет.</Typography></Grid>
          )}
          {lessons.map((lesson) => (
            <Grid key={lesson.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <LessonCard lesson={lesson} />
            </Grid>
          ))}
        </Grid>
      )}

      {view !== 'day' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {!loading && lessons.length === 0 && (
            <Typography color="text.secondary">В выбранном периоде занятий нет.</Typography>
          )}
          {Object.entries(groupedLessons).map(([date, dayLessons]) => (
            <Paper key={date} sx={{ p: 2.5, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                  {parseISODate(date).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Typography>
                {date === today && <Chip label="Сегодня" size="small" color="primary" />}
                <Divider sx={{ flex: 1 }} />
                <Typography variant="body2" color="text.secondary">{dayLessons.length} занятий</Typography>
              </Box>
              <Grid container spacing={2}>
                {dayLessons.map((lesson) => (
                  <Grid key={lesson.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <LessonCard lesson={lesson} />
                  </Grid>
                ))}
              </Grid>
            </Paper>
          ))}
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Dashboard;
