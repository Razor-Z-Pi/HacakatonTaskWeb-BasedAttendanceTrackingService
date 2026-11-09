import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Grid, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Stack, Skeleton,
  FormControl, InputLabel, Select, MenuItem, Tab, Tabs, IconButton, Tooltip,
  Alert, LinearProgress,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

import type { AttendanceStat, JournalEntry, Meta, Student } from '../types';
import { api, ApiError } from '../api/client';
import { JournalCalendar } from '../components/JournalCalendar';

const ALL_SUBJECTS = 'Все предметы';
const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

const AnalyticsPage: React.FC = () => {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [data, setData] = useState<AttendanceStat[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [journalLoading, setJournalLoading] = useState(false);
  const [error, setError] = useState('');

  // Фильтры
  const [selectedGroup, setSelectedGroup] = useState<string>('all'); // 'all' - все группы
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>(ALL_SUBJECTS);
  const [tabIndex, setTabIndex] = useState(0);

  useEffect(() => {
    api.getMeta()
      .then(setMeta)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить справочники.');
      });
  }, []);

  useEffect(() => {
    if (selectedGroup === 'all') {
      setStudents([]);
      return;
    }
    let cancelled = false;
    api.getStudents(selectedGroup)
      .then((items) => {
        if (!cancelled) setStudents(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setStudents([]);
          setError(err instanceof ApiError ? err.message : 'Не удалось загрузить студентов.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedGroup]);

  const analyticsFilters = useMemo(() => ({
    group: selectedGroup === 'all' ? undefined : selectedGroup,
    student_id: selectedStudent === 'all' ? undefined : selectedStudent,
    subject: selectedSubject === ALL_SUBJECTS ? undefined : selectedSubject,
  }), [selectedGroup, selectedStudent, selectedSubject]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getAnalytics(analyticsFilters)
      .then((items) => {
        if (!cancelled) setData(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setData([]);
          setError(err instanceof ApiError ? err.message : 'Не удалось загрузить аналитику.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analyticsFilters]);

  useEffect(() => {
    if (tabIndex !== 1) return;
    let cancelled = false;
    setJournalLoading(true);
    api.getJournal(analyticsFilters)
      .then((items) => {
        if (!cancelled) setJournal(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setJournal([]);
          setError(err instanceof ApiError ? err.message : 'Не удалось загрузить журнал.');
        }
      })
      .finally(() => {
        if (!cancelled) setJournalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tabIndex, analyticsFilters]);

  const filteredData = data;

  const pieData = filteredData.length ? [
    { name: 'Присутствовал', value: filteredData.reduce((s, d) => s + d.present, 0) },
    { name: 'Отсутствовал', value: filteredData.reduce((s, d) => s + d.absent, 0) },
    { name: 'Опоздал', value: filteredData.reduce((s, d) => s + d.late, 0) },
    { name: 'Уважительная', value: filteredData.reduce((s, d) => s + d.excused, 0) },
  ] : [];

  const getZoneInfo = (percent: number) => {
    if (percent >= 70) return { color: 'success', label: 'Зеленая зона', bg: '#dcfce7', text: '#166534' };
    if (percent >= 20) return { color: 'warning', label: 'Желтая зона', bg: '#fef3c7', text: '#92400e' };
    return { color: 'error', label: 'Красная зона', bg: '#fee2e2', text: '#991b1b' };
  };

  const groups = meta?.groups ?? [];
  const subjects = meta?.subjects ?? [];

  const handleReport = async (format: 'xlsx' | 'pdf') => {
    try {
      await api.downloadAnalyticsReport(format, analyticsFilters);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сформировать отчёт.');
    }
  };

  const handleCertificate = async (fio: string) => {
    try {
      await api.downloadCertificate(fio, new Date().toLocaleDateString('ru-RU'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сформировать справку.');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Аналитика</Typography>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Группа</InputLabel>
            <Select
              value={selectedGroup}
              label="Группа"
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setSelectedStudent('all');
              }}
            >
              <MenuItem value="all">Все группы</MenuItem>
              {groups.map((group) => <MenuItem key={group} value={group}>{group}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }} disabled={selectedGroup === 'all'}>
            <InputLabel>Студент</InputLabel>
            <Select value={selectedStudent} label="Студент" onChange={(e) => setSelectedStudent(e.target.value)}>
              <MenuItem value="all">Все студенты</MenuItem>
              {students.map((student) => (
                <MenuItem key={student.student_id} value={student.student_id}>{student.fio}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Предмет</InputLabel>
            <Select value={selectedSubject} label="Предмет" onChange={(e) => setSelectedSubject(e.target.value)}>
              <MenuItem value={ALL_SUBJECTS}>{ALL_SUBJECTS}</MenuItem>
              {subjects.map((subject) => <MenuItem key={subject} value={subject}>{subject}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" color="success" startIcon={<FileDownloadIcon />} onClick={() => void handleReport('xlsx')} disabled={loading}>
            Excel
          </Button>
          <Button variant="contained" color="error" startIcon={<PictureAsPdfIcon />} onClick={() => void handleReport('pdf')} disabled={loading}>
            PDF
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {loading && <LinearProgress />}

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabIndex} onChange={(_, value) => setTabIndex(value)}>
          <Tab label="Обзор и графики" />
          <Tab label="Журнал посещений (Календарь)" />
        </Tabs>
      </Box>

      {tabIndex === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Grid container spacing={3}>
            {[
              { label: 'Средняя посещаемость', value: `${Math.round(filteredData.reduce((s, d) => s + d.percent, 0) / (filteredData.length || 1))}%` },
              { label: 'Студентов', value: filteredData.length },
              { label: 'Красная зона (<20%)', value: filteredData.filter((d) => d.percent < 20).length },
              { label: 'Зеленая зона (>=70%)', value: filteredData.filter((d) => d.percent >= 70).length },
            ].map((kpi, i) => (
              <Grid key={i} size={{ xs: 6, md: 3 }}>
                <Paper sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>{kpi.label}</Typography>
                  {loading ? <Skeleton width="60%" height={40} /> : <Typography variant="h4" sx={{ fontWeight: 700 }}>{kpi.value}</Typography>}
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper sx={{ p: 2.5, height: 380, borderRadius: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Посещаемость</Typography>
                {loading ? <Skeleton variant="rectangular" height={280} /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={filteredData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="fio" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
                      <YAxis domain={[0, 100]} unit="%" />
                      <RechartsTooltip formatter={(v) => `${v}%`} />
                      <Bar dataKey="percent" name="% посещаемости" radius={[6, 6, 0, 0]}>
                        {filteredData.map((entry, index) => (
                          <Cell key={index} fill={entry.percent >= 70 ? '#10b981' : entry.percent >= 20 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Paper sx={{ p: 2.5, height: 380, borderRadius: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Распределение статусов</Typography>
                {loading ? <Skeleton variant="rectangular" height={280} /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx]} />)}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>
          </Grid>

          <Paper sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Детализация</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Студент</TableCell>
                    <TableCell>Группа</TableCell>
                    <TableCell align="center">%</TableCell>
                    <TableCell align="center">Зона риска</TableCell>
                    <TableCell align="center">Тренд</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredData.map((row) => {
                    const zone = getZoneInfo(row.percent);
                    return (
                      <TableRow key={row.student_id} hover>
                        <TableCell>{row.fio}</TableCell>
                        <TableCell>{row.group_name}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{row.percent}%</TableCell>
                        <TableCell align="center">
                          <Chip label={zone.label} size="small" sx={{ bgcolor: zone.bg, color: zone.text, fontWeight: 600 }} />
                        </TableCell>
                        <TableCell align="center">
                          {row.percent >= 70 ? <TrendingUpIcon color="success" fontSize="small" /> : <TrendingDownIcon color="error" fontSize="small" />}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Справка">
                            <IconButton color="primary" size="small" onClick={() => void handleCertificate(row.fio)}>
                              <DescriptionIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {tabIndex === 1 && (
        <Box>
          {journalLoading && <LinearProgress sx={{ mb: 2 }} />}
          <JournalCalendar
            data={journal}
            title={selectedGroup === 'all'
              ? 'Сводный журнал'
              : (selectedStudent === 'all'
                ? `Журнал группы ${selectedGroup}`
                : `Журнал: ${students.find((s) => s.student_id === selectedStudent)?.fio ?? selectedStudent}`)}
          />
        </Box>
      )}
    </Box>
  );
};

export default AnalyticsPage;
