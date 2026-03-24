import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import './App.css';

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
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
