import React, { useState } from 'react';
import {
  Box, Typography, Paper, IconButton, Stack, Chip,
  Dialog, DialogTitle, DialogContent, IconButton as MuiIconButton, List, ListItem, ListItemText, Divider
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import type { JournalEntry, AttendanceStatus } from '../types';

interface JournalCalendarProps {
  data: JournalEntry[];
  title?: string;
}

const STATUS_COLORS: Record<AttendanceStatus, { bg: string; text: string; label: string }> = {
  present: { bg: '#dcfce7', text: '#166534', label: 'Присутствовал' },
  absent: { bg: '#fee2e2', text: '#991b1b', label: 'Отсутствовал' },
  late: { bg: '#fef3c7', text: '#92400e', label: 'Опоздал' },
  excused: { bg: '#dbeafe', text: '#1e40af', label: 'Уважительная' },
};

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
const WEEKDAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const JournalCalendar: React.FC<JournalCalendarProps> = ({ data, title = 'Журнал группы' }) => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 10, 1)); 
  
  // Стейт для модалки с деталями дня
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (dateStr: string, entries: JournalEntry[]) => {
    if (entries.length > 0) {
      setSelectedDate(dateStr);
      setModalOpen(true);
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  let firstDayOfMonth = new Date(year, month, 1).getDay();
  firstDayOfMonth = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDaysArray = Array.from({ length: firstDayOfMonth }, () => null);

  // Данные для модалки
  const modalData = selectedDate ? data.filter((entry) => entry.date === selectedDate) : [];

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Шапка */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={handlePrevMonth} size="small">
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, minWidth: 140, textAlign: 'center' }}>
            {MONTHS_RU[month]} {year}
          </Typography>
          <IconButton onClick={handleNextMonth} size="small">
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Дни недели */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
        {WEEKDAYS_RU.map((day) => (
          <Typography key={day} variant="caption" sx={{ textAlign: 'center', fontWeight: 600, color: 'text.secondary' }}>
            {day}
          </Typography>
        ))}
      </Box>

      {/* Сетка */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, flexGrow: 1 }}>
        {emptyDaysArray.map((_, i) => (
          <Box key={`empty-${i}`} sx={{ minHeight: { xs: 100, sm: 130 }, borderRadius: 2, bgcolor: 'action.hover', opacity: 0.3 }} />
        ))}

        {daysArray.map((day) => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayData = data.filter((entry) => entry.date === dateStr);
          
          // Подсчет статусов за день
          const presentCount = dayData.filter(d => d.status === 'present').length;
          const absentCount = dayData.filter(d => d.status === 'absent').length;
          const lateCount = dayData.filter(d => d.status === 'late').length;
          const hasData = dayData.length > 0;

          return (
            <Box
              key={day}
              onClick={() => handleDayClick(dateStr, dayData)}
              sx={{
                minHeight: { xs: 100, sm: 130 },
                p: 1,
                borderRadius: 2,
                border: 1,
                borderColor: hasData ? 'primary.main' : 'divider',
                bgcolor: hasData ? 'action.hover' : 'background.paper',
                cursor: hasData ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                transition: '0.2s',
                '&:hover': hasData ? { transform: 'translateY(-2px)', boxShadow: 3 } : {},
              }}
            >
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: hasData ? 700 : 400, 
                  color: hasData ? 'primary.main' : 'text.secondary',
                  mb: 1
                }}
              >
                {day}
              </Typography>

              {/* Статистика внутри дня */}
              {hasData && (
                <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
                   <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.2 }}>
                     Занятий: {new Set(dayData.map(d => d.lesson_id ?? `${d.subject}-${d.date}`)).size}
                   </Typography>
                   
                   {presentCount > 0 && (
                     <Chip label={`Присут: ${presentCount}`} size="small" sx={{ bgcolor: STATUS_COLORS.present.bg, color: STATUS_COLORS.present.text, height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                   )}
                   {absentCount > 0 && (
                     <Chip label={`Отсут: ${absentCount}`} size="small" sx={{ bgcolor: STATUS_COLORS.absent.bg, color: STATUS_COLORS.absent.text, height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                   )}
                   {lateCount > 0 && (
                     <Chip label={`Опозд: ${lateCount}`} size="small" sx={{ bgcolor: STATUS_COLORS.late.bg, color: STATUS_COLORS.late.text, height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                   )}
                </Stack>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Модалка с деталями по группе */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Детали за {selectedDate}</Typography>
            <Typography variant="caption" color="text.secondary">Статусы студентов группы</Typography>
          </Box>
          <MuiIconButton onClick={() => setModalOpen(false)} size="small">
            <CloseIcon />
          </MuiIconButton>
        </DialogTitle>
        <DialogContent dividers>
          <List disablePadding>
            {modalData.map((entry, idx) => {
              const colors = STATUS_COLORS[entry.status];
              return (
                <React.Fragment key={idx}>
                  <ListItem disablePadding sx={{ py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ListItemText
                      primary={entry.student_fio}
                      secondary={entry.subject}
                      slotProps={{
                        primary: { sx: { fontWeight: 600, fontSize: '0.875rem' } },
                        secondary: { sx: { fontSize: '0.75rem' } },
                      }}
                    />
                    <Chip 
                      label={colors.label} 
                      size="small" 
                      sx={{ bgcolor: colors.bg, color: colors.text, fontWeight: 600 }} 
                    />
                  </ListItem>
                  {idx !== modalData.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </List>
        </DialogContent>
      </Dialog>
    </Paper>
  );
};