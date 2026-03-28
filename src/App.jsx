import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Toast from './components/Toast';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DocumentDetail from './pages/DocumentDetail';
import EditDocument from './pages/EditDocument';
import ManualRegister from './pages/ManualRegister';
import Upload from './pages/Upload';
import AdminEmpresas from './pages/AdminEmpresas';
import AdminUnidades from './pages/AdminUnidades';
import AdminTarifas from './pages/AdminTarifas';
import ViajesCliente from './pages/ViajesCliente';
import logoEmpresa from './assets/Images/logo-empresa.png';
import './App.css';

const APP_NAME = 'ECOTRANSPORTE';

function getPageTitle(pathname) {
  if (pathname === '/dashboard') return 'Dashboard';
  if (pathname === '/documents') return 'Documentos';
  if (/^\/documents\/\d+$/.test(pathname)) return 'Detalle de Documento';
  if (/^\/documents\/\d+\/edit$/.test(pathname)) return 'Editar Documento';
  if (pathname === '/manual-register') return 'Agregar Registro';
  if (pathname === '/upload') return 'Subir PDF';
  if (pathname === '/admin/empresas') return 'Admin Empresas';
  if (pathname === '/admin/unidades') return 'Admin Unidades';
  if (pathname === '/admin/tarifas') return 'Admin Tarifas';
  if (pathname === '/viajes-cliente') return 'Viajes por Cliente';
  if (pathname === '/login') return 'Iniciar Sesion';
  if (pathname === '/signup') return 'Registro';
  if (pathname === '/forgot-password') return 'Recuperar Contrasena';
  return APP_NAME;
}

function RouteMeta() {
  const location = useLocation();

  useEffect(() => {
    const pageTitle = getPageTitle(location.pathname);
    document.title = pageTitle === APP_NAME ? APP_NAME : `${pageTitle} | ${APP_NAME}`;

    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.setAttribute('rel', 'icon');
      document.head.appendChild(favicon);
    }
    favicon.setAttribute('type', 'image/png');
    favicon.setAttribute('href', logoEmpresa);
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <RouteMeta />
          <Toast />
          <Routes>
            {/* Rutas públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Rutas protegidas */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/documents/:id" element={<DocumentDetail />} />
                <Route path="/documents/:id/edit" element={<EditDocument />} />
                <Route path="/manual-register" element={<ManualRegister />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/admin/empresas" element={<AdminEmpresas />} />
                <Route path="/admin/unidades" element={<AdminUnidades />} />
                <Route path="/admin/tarifas" element={<AdminTarifas />} />
                <Route path="/viajes-cliente" element={<ViajesCliente />} />
              </Route>
            </Route>

            {/* Redirección por defecto */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
