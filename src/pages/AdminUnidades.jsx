import { useState, useEffect } from 'react';
import { unidadService, empresaTransporteService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import './Admin.css';

const AdminUnidades = () => {
  const [unidades, setUnidades] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUnidad, setEditingUnidad] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filterEmpresa, setFilterEmpresa] = useState('todas');
  const [filterEstado, setFilterEstado] = useState('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const { showNotification } = useNotification();

  const [formData, setFormData] = useState({
    placa: '',
    empresa_id: '',
    estado: 'activo'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [unidadesData, empresasData] = await Promise.all([
        unidadService.getAll(),
        empresaTransporteService.getActivas()
      ]);
      setUnidades(unidadesData);
      setEmpresas(empresasData);
    } catch (error) {
      showNotification('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        empresa_id: formData.empresa_id ? parseInt(formData.empresa_id) : null
      };

      if (editingUnidad) {
        await unidadService.update(editingUnidad.id, dataToSend);
        showNotification('Unidad actualizada correctamente', 'success');
      } else {
        await unidadService.create(dataToSend);
        showNotification('Unidad creada correctamente', 'success');
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      showNotification(error.message || 'Error al guardar unidad', 'error');
    }
  };

  const handleEdit = (unidad) => {
    setEditingUnidad(unidad);
    setFormData({
      placa: unidad.placa || '',
      empresa_id: unidad.empresa_id || unidad.empresa?.id || '',
      estado: unidad.estado || 'activo'
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ placa: '', empresa_id: '', estado: 'activo' });
    setEditingUnidad(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleToggleEstado = async (unidad) => {
    const nuevoEstado = unidad.estado === 'activo' ? 'inactivo' : 'activo';
    try {
      await unidadService.update(unidad.id, { estado: nuevoEstado });
      showNotification(`Unidad ${unidad.placa} ${nuevoEstado === 'activo' ? 'habilitada' : 'deshabilitada'}`, 'success');
      loadData();
    } catch (error) {
      showNotification(error.message || 'Error al cambiar estado', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await unidadService.delete(confirmDelete.id);
      showNotification(`Unidad ${confirmDelete.placa} eliminada correctamente`, 'success');
      setConfirmDelete(null);
      loadData();
    } catch (error) {
      showNotification(error.message || 'Error al eliminar unidad', 'error');
    }
  };

  // Obtener nombre de empresa
  const getEmpresaNombre = (unidad) => {
    if (unidad.empresa?.nombre) return unidad.empresa.nombre;
    const empresa = empresas.find(e => e.id === unidad.empresa_id);
    return empresa?.nombre || 'Sin asignar';
  };

  // Filtrar unidades
  const filteredUnidades = unidades.filter(uni => {
    const matchesEmpresa = filterEmpresa === 'todas' || 
                          uni.empresa_id?.toString() === filterEmpresa ||
                          uni.empresa?.id?.toString() === filterEmpresa;
    const matchesEstado = filterEstado === 'todas' || uni.estado === filterEstado;
    const matchesSearch = uni.placa.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesEmpresa && matchesEstado && matchesSearch;
  });

  // Agrupar por empresa para estadísticas
  const statsByEmpresa = empresas.map(emp => ({
    nombre: emp.nombre,
    count: unidades.filter(u => u.empresa_id === emp.id || u.empresa?.id === emp.id).length
  })).filter(s => s.count > 0);

  const stats = {
    total: unidades.length,
    activas: unidades.filter(u => u.estado === 'activo').length,
    inactivas: unidades.filter(u => u.estado !== 'activo').length
  };

  if (loading) {
    return <div className="admin-page"><div className="loading-container">Cargando...</div></div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>🚛 Unidades (Placas)</h1>
        <div className="admin-actions">
          <button className="btn-primary" onClick={openCreateModal}>
            + Nueva Unidad
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="admin-stats">
        <div className="stat-card">
          <h3>Total Unidades</h3>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <h3>Activas</h3>
          <div className="value">{stats.activas}</div>
        </div>
        <div className="stat-card">
          <h3>Inactivas</h3>
          <div className="value">{stats.inactivas}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="admin-filters">
        <input
          type="text"
          placeholder="Buscar por placa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
        />
        <select value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)}>
          <option value="todas">Todas las empresas</option>
          {empresas.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.nombre}</option>
          ))}
        </select>
        <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
          <option value="todas">Todos los estados</option>
          <option value="activo">Activas</option>
          <option value="inactivo">Inactivas</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="admin-table-container">
        {filteredUnidades.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron unidades</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Empresa</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnidades.map((unidad) => (
                <tr key={unidad.id}>
                  <td><strong>{unidad.placa}</strong></td>
                  <td>{getEmpresaNombre(unidad)}</td>
                  <td>
                    <span className={`status-badge status-${unidad.estado}`}>
                      {unidad.estado}
                    </span>
                  </td>
                  <td className="actions">
                    <button className="btn-edit btn-sm" onClick={() => handleEdit(unidad)} title="Editar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button
                      className={`btn-sm ${unidad.estado === 'activo' ? 'btn-disable' : 'btn-enable'}`}
                      onClick={() => handleToggleEstado(unidad)}
                      title={unidad.estado === 'activo' ? 'Deshabilitar' : 'Habilitar'}
                      style={{
                        marginLeft: 6,
                        background: unidad.estado === 'activo' ? '#dc3545' : '#1B7430',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      {unidad.estado === 'activo' ? '🚫 Deshabilitar' : '✅ Habilitar'}
                    </button>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => setConfirmDelete(unidad)}
                      title="Eliminar placa"
                      style={{ marginLeft: 6 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/>
                        <path d="M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingUnidad ? 'Editar Unidad' : 'Nueva Unidad'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Placa *</label>
                <input
                  type="text"
                  value={formData.placa}
                  onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                  required
                  placeholder="Ej: ABC123"
                  maxLength={20}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <div className="form-group">
                <label>Empresa de Transporte *</label>
                <select
                  value={formData.empresa_id}
                  onChange={(e) => setFormData({ ...formData, empresa_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar empresa</option>
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingUnidad ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-content confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirmar Eliminación</h2>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}>&times;</button>
            </div>
            <p>¿Estás seguro de eliminar la placa <strong>{confirmDelete.placa}</strong>?</p>
            <p style={{ fontSize: '0.85rem', color: '#666' }}>
              La placa ya no aparecerá en la lista, pero los documentos históricos asociados se conservarán.
            </p>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button className="btn-danger" onClick={handleDelete}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUnidades;
