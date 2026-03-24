import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardResumen from '../components/dashboard/DashboardResumen';
import DashboardResumenGeneral from '../components/dashboard/DashboardResumenGeneral';
import DashboardSemanal from '../components/dashboard/DashboardSemanal';
import DashboardTransportista from '../components/dashboard/DashboardTransportista';
import DashboardFinanciero from '../components/dashboard/DashboardFinanciero';
import logoEmpresa from '../assets/Images/logo-empresa.png';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('resumen');

  const tabs = [
    { id: 'resumen', label: '📊 Resumen General' },
    { id: 'semanal', label: '⚖️ Variación de TN' },
    { id: 'transportista', label: '🚚 Detalle Transportista' },
    { id: 'financiero', label: '💰 Financiero' },
    { id: 'control-peso', label: '⚖️ Control de peso' },
  ];

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <img src={logoEmpresa} alt="Logo Empresa" className="page-logo" />
          <h1>🏭 Dashboard</h1>
          <p>⛏️ Panel de control y análisis de operaciones</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/upload" className="btn-upload">
            + Subir PDF
          </Link>
          {user?.role === 1 && (
            <Link to="/manual-register" className="btn-upload" style={{ background: '#1B7430' }}>
              ✏️ Agregar Registro
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido de cada tab */}
      <div className="dashboard-content">
        {activeTab === 'resumen' && <DashboardResumenGeneral />}
        {activeTab === 'semanal' && <DashboardSemanal />}
        {activeTab === 'transportista' && <DashboardTransportista />}
        {activeTab === 'financiero' && <DashboardFinanciero />}
        {activeTab === 'control-peso' && <DashboardResumen />}
      </div>
    </div>
  );
};

export default Dashboard;
