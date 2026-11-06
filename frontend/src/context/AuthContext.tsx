import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readStoredUser = (): User | null => {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Read synchronously so ProtectedRoute does not redirect to /login on the
  // first render after a page reload.
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('access_token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token && !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
