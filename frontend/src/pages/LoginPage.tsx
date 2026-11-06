import React, { useState } from 'react';
import {
  Box, Paper, TextField, Button, Typography, Alert, Avatar, useTheme,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const theme = useTheme();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (loginValue === 'teacher' && password === '1234') {
      const mockUser = {
        id: 1,
        login: 'teacher',
        role: 'teacher' as const,
        full_name: 'Соснин Евгений Анатольевич',
        teacher_id: 1,
      };
      login('mock-jwt-token-xxxxx', mockUser);
      navigate('/');
    } else {
      setError('Неверный логин или пароль. Попробуйте: teacher / 1234');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
        p: 2,
      }}
    >
      <Paper elevation={10} sx={{ p: { xs: 3, sm: 4 }, maxWidth: 420, width: '100%', borderRadius: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Avatar sx={{ m: 1, bgcolor: 'secondary.main', width: 56, height: 56 }}>
            <LockOutlinedIcon fontSize="large" />
          </Avatar>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>
            Вход в систему
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            Цифровой Кампус | Учёт посещаемости
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <TextField
            margin="normal"
            required
            fullWidth
            label="Логин"
            autoFocus
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" fullWidth variant="contained" size="large" sx={{ mt: 3, mb: 2, py: 1.5 }}>
            Войти
          </Button>

          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', display: 'block', textAlign: 'center' }}
          >
            Демо-доступ: <b>teacher / 1234</b>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginPage;