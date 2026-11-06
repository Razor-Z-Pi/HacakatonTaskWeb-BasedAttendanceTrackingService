import React from 'react';
import {
  AppBar, Toolbar, Typography, IconButton, Container, Box,
  Tooltip, Button, Menu, MenuItem, Avatar, Stack, useMediaQuery, useTheme,
  BottomNavigation, BottomNavigationAction, Paper
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import SchoolIcon from '@mui/icons-material/School';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoutIcon from '@mui/icons-material/Logout';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  toggleTheme: () => void;
}

const Layout: React.FC<LayoutProps> = ({ toggleTheme }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleLogout = () => {
    setAnchorEl(null);
    logout();
    navigate('/login');
  };

  // Определяем текущую вкладку для мобильного меню
  const getMobileNavValue = () => {
    if (location.pathname === '/') return 0;
    if (location.pathname === '/analytics') return 1;
    return 0;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', pb: isMobile ? 8 : 0 }}>
      <AppBar
        position="sticky"
        color="default"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', backdropFilter: 'blur(8px)' }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <Box
            onClick={() => navigate('/')}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', mr: 'auto' }}
          >
            <SchoolIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, display: { xs: 'none', sm: 'block' } }}>
              Электронный журнал
            </Typography>
          </Box>

          {/* Десктопное меню */}
          {!isMobile && (
            <Stack direction="row" spacing={1}>
              <Button
                startIcon={<DashboardIcon />}
                onClick={() => navigate('/')}
                color={location.pathname === '/' ? 'primary' : 'inherit'}
                variant={location.pathname === '/' ? 'outlined' : 'text'}
              >
                Расписание
              </Button>
              <Button
                startIcon={<AnalyticsIcon />}
                onClick={() => navigate('/analytics')}
                color={location.pathname === '/analytics' ? 'primary' : 'inherit'}
                variant={location.pathname === '/analytics' ? 'outlined' : 'text'}
              >
                Аналитика
              </Button>
            </Stack>
          )}

          <Tooltip title="Переключить тему">
            <IconButton onClick={toggleTheme} color="inherit">
              {isDark ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 15, fontWeight: 600 }}>
              {user?.full_name?.charAt(0) ?? '?'}
            </Avatar>
          </IconButton>

          <Menu anchorEl={anchorEl} open={menuOpen} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user?.full_name}
              </Typography>
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Выйти
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, flexGrow: 1, px: { xs: 2, sm: 3 } }}>
        <Outlet />
      </Container>

      <Box
        component="footer"
        sx={{
          py: 3,
          textAlign: 'center',
          color: 'text.secondary',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="body2">2026 Веб-Сервис Учёта Посещаемости</Typography>
      </Box>

      {/* Мобильное нижнее меню */}
      {isMobile && (
        <Paper
          sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, borderTop: 1, borderColor: 'divider' }}
          elevation={3}
        >
          <BottomNavigation
            showLabels
            value={getMobileNavValue()}
            onChange={(event, newValue) => {
              if (newValue === 0) navigate('/');
              if (newValue === 1) navigate('/analytics');
            }}
          >
            <BottomNavigationAction label="Расписание" icon={<DashboardIcon />} />
            <BottomNavigationAction label="Аналитика" icon={<AnalyticsIcon />} />
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
};

export default Layout;