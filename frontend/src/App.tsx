import { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { getTheme } from './theme';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import AttendancePage from './pages/AttendancePage';
import AnalyticsPage from './pages/AnalyticsPage';
import CheckInPage from './pages/CheckInPage';
import Layout from './components/Layout';

function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/check-in/:token" element={<CheckInPage />} />
            
            {/* Защищенные роуты */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout toggleTheme={() => setMode(prev => prev === 'light' ? 'dark' : 'light')} />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/lesson/:id" element={<AttendancePage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;