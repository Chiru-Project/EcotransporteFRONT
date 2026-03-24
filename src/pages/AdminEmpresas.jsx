import { useState, useEffect } from 'react';
import { empresaTransporteService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import './Admin.css';

const AdminEmpresas = () => {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filter, setFilter] = useState('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const { showNotification } = useNotification();

  const [formData, setFormData] = useState({
    nombre: '',
    ruc: '',
    estado: 'activo'
  });

  useEffect(() => {
    loadEmpresas();
  }, []);

  const loadEmpresas = async () => {
    try {
      setLoading(true);
      const data = await empresaTransporteService.getAll();
      setEmpresas(data);
    } catch (error) {
      showNotification('Error al cargar empresas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEmpresa) {
        await empresaTransporteService.update(editingEmpresa.id, formData);
        showNotification('Empresa actualizada correctamente', 'success');
      } else {
        await empresaTransporteService.create(formData);
        showNotification('Empresa creada correctamente', 'success');
      }
      setShowModal(false);
      resetForm();
      loadEmpresas();
    } catch (error) {
      showNotification(error.message || 'Error al guardar empresa', 'error');
    }
  };

  const handleEdit = (empresa) => {
    setEditingEmpresa(empresa);
    setFormData({
      nombre: empresa.nombre || '',
      ruc: empresa.ruc || '',
      estado: empresa.estado || 'activo'
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    try {
      await empresaTransporteService.delete(confirmDelete.id);
      showNotification('Empresa eliminada correctamente', 'success');
      setConfirmDelete(null);
      loadEmpresas();
    } catch (error) {
      showNotification(error.message || 'Error al eliminar empresa', 'error');
    }
  };

  const resetForm = () => {
    setFormData({ nombre: '', ruc: '', estado: 'activo' });
    setEditingEmpresa(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Filtrar empresas
  const filteredEmpresas = empresas.filter(emp => {
    const matchesFilter = filter === 'todas' || emp.estado === filter;
    const matchesSearch = emp.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.ruc && emp.ruc.includes(searchTerm));
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: empresas.length,
    activas: empresas.filter(e => e.estado === 'activo').length,
    inactivas: empresas.filter(e => e.estado !== 'activo').length
  };

  if (loading) {
    return <div className="admin-page"><div className="loading-container">Cargando...</div></div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>🏭 Empresas de Transporte</h1>
        <div className="admin-actions">
          <button className="btn-primary" onClick={openCreateModal}>
            + Nueva Empresa
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="admin-stats">
        <div className="stat-card">
          <h3>Total Empresas</h3>
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
          placeholder="Buscar por nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="todas">Todas</option>
          <option value="activo">Activas</option>
          <option value="inactivo">Inactivas</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="admin-table-container">
        {filteredEmpresas.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron empresas</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>RUC</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmpresas.map((empresa) => (
                <tr key={empresa.id}>
                  <td><strong>{empresa.nombre}</strong></td>
                  <td>{empresa.ruc || '-'}</td>
                  <td>
                    <span className={`status-badge status-${empresa.estado}`}>
                      {empresa.estado}
                    </span>
                  </td>
                  <td className="actions">
                    <button className="btn-edit btn-sm" onClick={() => handleEdit(empresa)} title="Editar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="btn-danger btn-sm" onClick={() => setConfirmDelete(empresa)} title="Eliminar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
              <h2>{editingEmpresa ? 'Editar Empresa' : 'Nueva Empresa'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value.toUpperCase() })}
                  required
                  placeholder="Nombre de la empresa"
                />
              </div>
              <div className="form-group">
                <label>RUC</label>
                <input
                  type="text"
                  value={formData.ruc}
                  onChange={(e) => setFormData({ ...formData, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  placeholder="Número de RUC (11 dígitos)"
                  maxLength={11}
                />
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
                  {editingEmpresa ? 'Actualizar' : 'Crear'}
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
            <p>¿Estás seguro de eliminar la empresa <strong>{confirmDelete.nombre}</strong>?</p>
            <p style={{ fontSize: '0.85rem', color: '#666' }}>
              Esta acción no se puede deshacer y eliminará las unidades asociadas.
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

export default AdminEmpresas;
