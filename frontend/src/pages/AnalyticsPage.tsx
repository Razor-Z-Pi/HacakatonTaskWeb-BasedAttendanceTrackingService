import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Grid, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Stack, Skeleton,
  FormControl, InputLabel, Select, MenuItem, Tab, Tabs, IconButton, Tooltip
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SendIcon from '@mui/icons-material/Send';
import DescriptionIcon from '@mui/icons-material/Description';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

import type { AttendanceStat, JournalEntry } from '../types';
import { exportToExcel, exportToPDF } from '../utils/export';
import { generateMedicalCertificate } from '../utils/pdfDocs';
import { JournalCalendar } from '../components/JournalCalendar';

// --- МОКИ ДАННЫХ ---
const SUBJECTS = ['Все предметы', 'Теоретическая информатика', 'История России', 'Математика'];

const MOCK_ANALYTICS: AttendanceStat[] = [
  { student_id: 'STU-5001', fio: 'Смирнов Артём', group_name: '526-1', total_lessons: 20, present: 15, absent: 5, late: 0, excused: 0, percent: 75 },
  { student_id: 'STU-5002', fio: 'Иванов Даниил', group_name: '526-1', total_lessons: 20, present: 4, absent: 16, late: 0, excused: 0, percent: 20 },
  { student_id: 'STU-5013', fio: 'Павлова Мария', group_name: '526-1', total_lessons: 20, present: 20, absent: 0, late: 0, excused: 0, percent: 100 },
  { student_id: 'STU-5014', fio: 'Козлова Анна', group_name: '526-1', total_lessons: 20, present: 10, absent: 10, late: 0, excused: 0, percent: 50 },
  { student_id: 'STU-5026', fio: 'Белов Григорий', group_name: '526-2', total_lessons: 20, present: 17, absent: 3, late: 0, excused: 0, percent: 85 },
  { student_id: 'STU-5027', fio: 'Тихонов Арсений', group_name: '526-2', total_lessons: 20, present: 5, absent: 15, late: 0, excused: 0, percent: 25 },
];

const MOCK_JOURNAL: JournalEntry[] = [
  { date: '2026-11-02', subject: 'Информатика', student_id: 'STU-5001', student_fio: 'Смирнов Артём', status: 'present' },
  { date: '2026-11-02', subject: 'Информатика', student_id: 'STU-5002', student_fio: 'Иванов Даниил', status: 'absent' },
  { date: '2026-11-02', subject: 'Информатика', student_id: 'STU-5013', student_fio: 'Павлова Мария', status: 'present' },
  { date: '2026-11-02', subject: 'История', student_id: 'STU-5001', student_fio: 'Смирнов Артём', status: 'late' },
  { date: '2026-11-02', subject: 'История', student_id: 'STU-5013', student_fio: 'Павлова Мария', status: 'present' },
  { date: '2026-11-03', subject: 'Математика', student_id: 'STU-5001', student_fio: 'Смирнов Артём', status: 'present' },
  { date: '2026-11-03', subject: 'Математика', student_id: 'STU-5002', student_fio: 'Иванов Даниил', status: 'present' },
  { date: '2026-11-03', subject: 'Математика', student_id: 'STU-5013', student_fio: 'Павлова Мария', status: 'present' },
  { date: '2026-11-03', subject: 'Математика', student_id: 'STU-5014', student_fio: 'Козлова Анна', status: 'present' },
  { date: '2026-11-05', subject: 'История', student_id: 'STU-5001', student_fio: 'Смирнов Артём', status: 'absent' },
  { date: '2026-11-05', subject: 'История', student_id: 'STU-5002', student_fio: 'Иванов Даниил', status: 'absent' },
  { date: '2026-11-05', subject: 'История', student_id: 'STU-5013', student_fio: 'Павлова Мария', status: 'present' },
  { date: '2026-11-12', subject: 'Информатика', student_id: 'STU-5001', student_fio: 'Смирнов Артём', status: 'present' },
  { date: '2026-11-12', subject: 'Информатика', student_id: 'STU-5013', student_fio: 'Павлова Мария', status: 'present' },
  { date: '2026-11-12', subject: 'Информатика', student_id: 'STU-5014', student_fio: 'Козлова Анна', status: 'absent' },
  { date: '2026-11-16', subject: 'История', student_id: 'STU-5001', student_fio: 'Смирнов Артём', status: 'excused' },
  { date: '2026-11-16', subject: 'История', student_id: 'STU-5002', student_fio: 'Иванов Даниил', status: 'present' },
  { date: '2026-11-16', subject: 'История', student_id: 'STU-5013', student_fio: 'Павлова Мария', status: 'present' },
  { date: '2026-11-16', subject: 'История', student_id: 'STU-5026', student_fio: 'Белов Григорий', status: 'present' },
];

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AttendanceStat[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Фильтры
  const [selectedGroup, setSelectedGroup] = useState<string>('all'); // 'all' - все группы
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('Все предметы');
  
  const [tabIndex, setTabIndex] = useState(0);

  useEffect(() => {
    setTimeout(() => {
      setData(MOCK_ANALYTICS);
      setLoading(false);
    }, 800);
  }, []);

  // Список студентов для фильтра (зависит от выбранной группы)
  const studentsForSelect = useMemo(() => {
    if (selectedGroup === 'all') return data;
    return data.filter(d => d.group_name === selectedGroup);
  }, [data, selectedGroup]);

  // Фильтрация данных для графиков и таблиц
  const filteredData = useMemo(() => {
    let result = data;

    // Фильтр по группе
    if (selectedGroup !== 'all') {
      result = result.filter(d => d.group_name === selectedGroup);
    }

    // Фильтр по студенту
    if (selectedStudent !== 'all') {
      result = result.filter(d => d.student_id === selectedStudent);
    }

    // Имитация фильтра по предмету (в реальности тут запрос к API, Сюда надоооо)
    if (selectedSubject !== 'Все предметы') {
        result = result.map(r => ({
            ...r,
            present: Math.max(0, r.present - 3),
            percent: Math.round((r.present - 3) / r.total_lessons * 100)
        }));
    }
    
    return result;
  }, [data, selectedGroup, selectedStudent, selectedSubject]);

  // Фильтрация журнала для календаря
  const filteredJournal = useMemo(() => {
    let result = MOCK_JOURNAL;
    
    // Группа (если выбрана не all)
    if (selectedGroup !== 'all') {
      // В мок-данных журнала нет поля group, поэтому фильтруем по студентам этой группы
      const studentIds = data.filter(d => d.group_name === selectedGroup).map(d => d.student_id);
      result = result.filter(j => studentIds.includes(j.student_id));
    }

    if (selectedStudent !== 'all') result = result.filter(j => j.student_id === selectedStudent);
    if (selectedSubject !== 'Все предметы') result = result.filter(j => j.subject.includes(selectedSubject.split(' ')[0]));
    
    return result;
  }, [selectedStudent, selectedSubject, selectedGroup, data]);

  const pieData = filteredData.length ? [
    { name: 'Присутствовал', value: filteredData.reduce((s, d) => s + d.present, 0) },
    { name: 'Отсутствовал', value: filteredData.reduce((s, d) => s + d.absent, 0) },
    { name: 'Опоздал', value: filteredData.reduce((s, d) => s + d.late, 0) },
    { name: 'Уважительная', value: filteredData.reduce((s, d) => s + d.excused, 0) },
  ] : [];

  const getZoneInfo = (percent: number) => {
    if (percent >= 80) return { color: 'success', label: 'Зеленая зона', bg: '#dcfce7', text: '#166534' };
    if (percent >= 50) return { color: 'warning', label: 'Желтая зона', bg: '#fef3c7', text: '#92400e' };
    if (percent >= 20) return { color: 'error', label: 'Красная зона', bg: '#fee2e2', text: '#991b1b' };
    return { color: 'error', label: 'Критическая', bg: '#fca5a5', text: '#7f1d1d' };
  };

  const reportTitle = `Отчет по ${selectedSubject === 'Все предметы' ? 'всем предметам' : selectedSubject} (Группа: ${selectedGroup === 'all' ? 'Все' : selectedGroup})`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Аналитика</Typography>
          
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Группа</InputLabel>
            <Select value={selectedGroup} label="Группа" onChange={(e) => { setSelectedGroup(e.target.value); setSelectedStudent('all'); }}>
              <MenuItem value="all">Все группы</MenuItem>
              <MenuItem value="526-1">526-1</MenuItem>
              <MenuItem value="526-2">526-2</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }} disabled={selectedGroup === 'all'}>
            <InputLabel>Студент</InputLabel>
            <Select value={selectedStudent} label="Студент" onChange={(e) => setSelectedStudent(e.target.value)}>
              <MenuItem value="all">Все студенты</MenuItem>
              {studentsForSelect.map(s => <MenuItem key={s.student_id} value={s.student_id}>{s.fio}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Предмет</InputLabel>
            <Select value={selectedSubject} label="Предмет" onChange={(e) => setSelectedSubject(e.target.value)}>
              {SUBJECTS.map(sub => <MenuItem key={sub} value={sub}>{sub}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" color="success" startIcon={<FileDownloadIcon />} onClick={() => exportToExcel(filteredData, reportTitle)} disabled={loading}>
            Excel
          </Button>
          <Button variant="contained" color="error" startIcon={<PictureAsPdfIcon />} onClick={() => exportToPDF(filteredData, reportTitle, 'analytics_report')} disabled={loading}>
            PDF
          </Button>
        </Stack>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)}>
          <Tab label="Обзор и графики" />
          <Tab label="Журнал посещений (Календарь)" />
        </Tabs>
      </Box>

      {/* Вкладка: Обзор */}
      {tabIndex === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Grid container spacing={3}>
            {[
              { label: 'Средняя посещаемость', value: `${Math.round(filteredData.reduce((s, d) => s + d.percent, 0) / (filteredData.length || 1))}%` },
              { label: 'Студентов', value: filteredData.length },
              { label: 'Красная зона (<50%)', value: filteredData.filter((d) => d.percent < 50).length },
              { label: 'Зеленая зона (>=80%)', value: filteredData.filter((d) => d.percent >= 80).length },
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
                          <Cell key={index} fill={entry.percent >= 80 ? '#10b981' : entry.percent >= 50 ? '#f59e0b' : '#ef4444'} />
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
                          {row.percent > 80 ? <TrendingUpIcon color="success" fontSize="small" /> : <TrendingDownIcon color="error" fontSize="small" />}
                        </TableCell>
                        <TableCell align="right">
                          {row.percent < 20 && (
                            <Tooltip title="Предупреждение куратору">
                              <IconButton color="error" size="small" onClick={() => alert(`Куратору группы ${row.group_name} отправлено предупреждение о ${row.fio}`)}>
                                <SendIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Справка">
                            <IconButton color="primary" size="small" onClick={() => generateMedicalCertificate(row.fio, new Date().toLocaleDateString('ru-RU'))}>
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

      {/* Вкладка: Журнал */}
      {tabIndex === 1 && (
        <Box>
          <JournalCalendar 
            data={filteredJournal} 
            title={selectedGroup === 'all' ? 'Сводный журнал' : (selectedStudent === 'all' ? `Журнал группы ${selectedGroup}` : `Журнал: ${studentsForSelect.find(s => s.student_id === selectedStudent)?.fio}`)}
          />
        </Box>
      )}
    </Box>
  );
};

export default AnalyticsPage;