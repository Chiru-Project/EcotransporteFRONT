import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken) {
      setToken(savedToken);
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await authService.login(email, password);
    const { accessToken, email: userEmail, role } = response;
    
    // Asegurar que role sea número
    const roleNumber = Number(role);
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify({ email: userEmail, role: roleNumber }));
    
    setToken(accessToken);
    setUser({ email: userEmail, role: roleNumber });
    
    return response;
  };

  const signup = async (email, password, userName) => {
    const response = await authService.signup(email, password, userName);
    return response;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  };

  const requestResetPassword = async (email) => {
    return await authService.requestResetPassword(email);
  };

  const resetPassword = async (resetToken, password) => {
    return await authService.resetPassword(resetToken, password);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    login,
    signup,
    logout,
    requestResetPassword,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
