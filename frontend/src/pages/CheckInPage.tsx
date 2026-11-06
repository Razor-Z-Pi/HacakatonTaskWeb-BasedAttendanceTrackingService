import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, CircularProgress, Divider, List, ListItem,
  ListItemText, Paper, TextField, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useParams } from 'react-router-dom';

import type { CheckInInfo, Student } from '../types';
import { api, ApiError } from '../api/client';

const CheckInPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<CheckInInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Некорректная ссылка для отметки.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.getCheckInInfo(token)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Ссылка для отметки недействительна.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const students = useMemo(() => {
    if (!info) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return info.students;
    return info.students.filter((student) =>
      student.fio.toLowerCase().includes(needle)
      || student.student_id.toLowerCase().includes(needle)
      || student.group_name.toLowerCase().includes(needle),
    );
  }, [info, query]);

  const handleCheckIn = async (student: Student) => {
    if (!token) return;
    setSubmitting(student.student_id);
    setError('');
    try {
      await api.checkIn(token, student.student_id);
      setSuccess(`${student.fio} отмечен(а) как присутствующий(ая).`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отметиться.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', justifyContent: 'center', p: { xs: 2, sm: 4 } }}>
      <Paper elevation={4} sx={{ width: '100%', maxWidth: 680, p: { xs: 2.5, sm: 4 }, borderRadius: 4, alignSelf: 'flex-start' }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Avatar sx={{ mx: 'auto', mb: 1.5, bgcolor: 'primary.main', width: 56, height: 56 }}>
            <CheckCircleIcon fontSize="large" />
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Отметка посещаемости</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Выберите себя в списке группы
          </Typography>
        </Box>

        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

        {info && (
          <>
            <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 3, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{info.lesson.subject}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {info.lesson.lesson_date} · {info.lesson.time_range} · Ауд. {info.lesson.auditory}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {info.lesson.teacher_name ?? '—'} · {info.lesson.groups.join(', ')}
              </Typography>
            </Paper>

            <TextField
              fullWidth
              size="small"
              label="Поиск по ФИО, ID или группе"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              sx={{ mb: 2 }}
            />

            <List disablePadding sx={{ maxHeight: 460, overflow: 'auto' }}>
              {students.map((student, index) => (
                <React.Fragment key={student.student_id}>
                  <ListItem
                    secondaryAction={(
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={submitting === student.student_id}
                        onClick={() => handleCheckIn(student)}
                      >
                        {submitting === student.student_id ? '...' : 'Я здесь'}
                      </Button>
                    )}
                    sx={{ pr: 12 }}
                  >
                    <ListItemText
                      primary={student.fio}
                      secondary={`${student.student_id} · ${student.group_name}`}
                      slotProps={{
                        primary: { sx: { fontWeight: 600, fontSize: '0.9rem' } },
                        secondary: { sx: { fontSize: '0.75rem' } },
                      }}
                    />
                  </ListItem>
                  {index !== students.length - 1 && <Divider />}
                </React.Fragment>
              ))}
              {!students.length && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  Ничего не найдено.
                </Typography>
              )}
            </List>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default CheckInPage;
