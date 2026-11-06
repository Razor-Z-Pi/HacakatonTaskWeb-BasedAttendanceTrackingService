import { createTheme } from '@mui/material/styles';

export const getTheme = (mode: 'light' | 'dark') => createTheme({
  palette: {
    mode,
    primary: {
      main: '#2563eb', // Современный синий
    },
    secondary: {
      main: '#7c3aed', // Фиолетовый акцент
    },
    background: {
      default: mode === 'light' ? '#f8fafc' : '#0f172a',
      paper: mode === 'light' ? '#ffffff' : '#1e293b',
    },
    success: { main: '#10b981' }, // Зеленый для "Присутствует"
    error: { main: '#ef4444' },   // Красный для "Отсутствует"
    warning: { main: '#f59e0b' }, // Оранжевый для "Опоздал"
    info: { main: '#3b82f6' },    // Синий для "Уважительная"
  },
  shape: {
    borderRadius: 12, // Скругленные углы везде
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        },
      },
    },
  },
});