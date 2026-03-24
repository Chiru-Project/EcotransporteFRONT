import { useState, useEffect } from 'react';
import { clientTariffService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import './Admin.css';

const AdminTarifas = () => {
  const [tarifas, setTarifas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTarifa, setEditingTarifa] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCliente, setFilterCliente] = useState('todos');
  const [filterMes, setFilterMes] = useState('todos');
  const { showNotification } = useNotification();

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const [formData, setFormData] = useState({
    cliente: '',
    partida: '',
    llegada: '',
    material: '',
    precioVentaSinIgv: '',
    moneda: 'PEN',
    precioCostoSinIgv: '',
    divisa: 'PEN',
    mes: ''
  });

  useEffect(() => {
    loadTarifas();
  }, []);

  const loadTarifas = async () => {
    try {
      setLoading(true);
      const data = await clientTariffService.getAll();
      setTarifas(data);
    } catch (error) {
      showNotification('Error al cargar tarifas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        precioVentaSinIgv: parseFloat(formData.precioVentaSinIgv) || 0,
        precioCostoSinIgv: parseFloat(formData.precioCostoSinIgv) || 0
      };

      if (editingTarifa) {
        await clientTariffService.update(editingTarifa.id, dataToSend);
        showNotification('Tarifa actualizada correctamente', 'success');
      } else {
        await clientTariffService.create(dataToSend);
        showNotification('Tarifa creada correctamente', 'success');
      }
      setShowModal(false);
      resetForm();
      loadTarifas();
    } catch (error) {
      showNotification(error.message || 'Error al guardar tarifa', 'error');
    }
  };

  const handleEdit = (tarifa) => {
    setEditingTarifa(tarifa);
    setFormData({
      cliente: tarifa.cliente || '',
      partida: tarifa.partida || '',
      llegada: tarifa.llegada || '',
      material: tarifa.material || '',
      precioVentaSinIgv: tarifa.precioVentaSinIgv ? parseFloat(tarifa.precioVentaSinIgv).toFixed(2) : '',
      moneda: tarifa.moneda || 'PEN',
      precioCostoSinIgv: tarifa.precioCostoSinIgv ? parseFloat(tarifa.precioCostoSinIgv).toFixed(2) : '',
      divisa: tarifa.divisa || 'PEN',
      mes: tarifa.mes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    try {
      await clientTariffService.delete(confirmDelete.id);
      showNotification('Tarifa eliminada correctamente', 'success');
      setConfirmDelete(null);
      loadTarifas();
    } catch (error) {
      showNotification(error.message || 'Error al eliminar tarifa', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      cliente: '',
      partida: '',
      llegada: '',
      material: '',
      precioVentaSinIgv: '',
      moneda: 'PEN',
      precioCostoSinIgv: '',
      divisa: 'PEN',
      mes: ''
    });
    setEditingTarifa(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Obtener clientes únicos
  const clientes = [...new Set(tarifas.map(t => t.cliente).filter(Boolean))].sort();

  // Meses que existen en los datos (ordenados por índice del año)
  const mesesExistentes = MESES.filter(m => tarifas.some(t => t.mes === m));
  const hayTarifasSinMes = tarifas.some(t => !t.mes);

  // Filtrar tarifas
  const filteredTarifas = tarifas.filter(tarifa => {
    const matchesCliente = filterCliente === 'todos' || tarifa.cliente === filterCliente;
    const matchesMes = filterMes === 'todos'
      ? true
      : filterMes === 'sin-mes'
        ? !tarifa.mes
        : tarifa.mes === filterMes;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      tarifa.cliente?.toLowerCase().includes(searchLower) ||
      tarifa.partida?.toLowerCase().includes(searchLower) ||
      tarifa.llegada?.toLowerCase().includes(searchLower) ||
      tarifa.material?.toLowerCase().includes(searchLower);
    return matchesCliente && matchesMes && matchesSearch;
  });

  // Calcular margen
  const calcularMargen = (venta, costo) => {
    if (!venta || !costo || costo === 0) return '-';
    const margen = ((venta - costo) / venta) * 100;
    return margen.toFixed(1) + '%';
  };

  const formatMoney = (value, currency) => {
    if (!value && value !== 0) return '-';
    const symbol = currency === 'USD' ? '$' : 'S/';
    return `${symbol} ${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const stats = {
    total: tarifas.length,
    clientes: clientes.length,
    promedioVenta: tarifas.length > 0 
      ? (tarifas.reduce((sum, t) => sum + (parseFloat(t.precioVentaSinIgv) || 0), 0) / tarifas.length).toFixed(2)
      : 0
  };

  if (loading) {
    return <div className="admin-page"><div className="loading-container">Cargando...</div></div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>💲 Tarifas de Clientes</h1>
        <div className="admin-actions">
          <button className="btn-primary" onClick={openCreateModal}>
            + Nueva Tarifa
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="admin-stats">
        <div className="stat-card">
          <h3>Total Tarifas</h3>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <h3>Clientes</h3>
          <div className="value">{stats.clientes}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="admin-filters">
        <input
          type="text"
          placeholder="Buscar por cliente, ruta o material..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select value={filterCliente} onChange={(e) => setFilterCliente(e.target.value)}>
          <option value="todos">Todos los clientes</option>
          {clientes.map(cliente => (
            <option key={cliente} value={cliente}>{cliente}</option>
          ))}
        </select>
        {(mesesExistentes.length > 0 || hayTarifasSinMes) && (
          <select value={filterMes} onChange={(e) => setFilterMes(e.target.value)}>
            <option value="todos">Todos los meses</option>
            {mesesExistentes.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
            {hayTarifasSinMes && <option value="sin-mes">Sin mes</option>}
          </select>
        )}
      </div>

      {/* Tabla */}
      <div className="admin-table-container">
        {filteredTarifas.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron tarifas</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Partida</th>
                <th>Llegada</th>
                <th>Material</th>
                <th>Mes</th>
                <th>P. Venta (sin IGV)</th>
                <th>P. Venta (con IGV)</th>
                <th>P. Costo (sin IGV)</th>
                <th>P. Costo (con IGV)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredTarifas.map((tarifa) => (
                <tr key={tarifa.id}>
                  <td><strong>{tarifa.cliente}</strong></td>
                  <td title={tarifa.partida}>{tarifa.partida?.includes('-') ? tarifa.partida.split('-').pop().trim() : tarifa.partida}</td>
                  <td title={tarifa.llegada}>{tarifa.llegada?.includes('-') ? tarifa.llegada.split('-').pop().trim() : tarifa.llegada}</td>
                  <td>{tarifa.material || '-'}</td>
                  <td>{tarifa.mes || '-'}</td>
                  <td>{formatMoney(tarifa.precioVentaSinIgv, tarifa.moneda)}</td>
                  <td>{formatMoney(tarifa.precioVentaConIgv || (parseFloat(tarifa.precioVentaSinIgv || 0) * 1.18).toFixed(2), tarifa.moneda)}</td>
                  <td>{formatMoney(tarifa.precioCostoSinIgv, tarifa.divisa)}</td>
                  <td>{formatMoney(tarifa.precioCostoConIgv || (parseFloat(tarifa.precioCostoSinIgv || 0) * 1.18).toFixed(2), tarifa.divisa)}</td>
                  <td className="actions">
                    <button className="btn-edit btn-sm" onClick={() => handleEdit(tarifa)} title="Editar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="btn-danger btn-sm" onClick={() => setConfirmDelete(tarifa)} title="Eliminar">
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
          <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTarifa ? 'Editar Tarifa' : 'Nueva Tarifa'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Cliente *</label>
                  <input
                    type="text"
                    value={formData.cliente}
                    onChange={(e) => setFormData({ ...formData, cliente: e.target.value.toUpperCase() })}
                    required
                    placeholder="Nombre del cliente"
                    list="clientes-list"
                  />
                  <datalist id="clientes-list">
                    {clientes.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label>Material</label>
                  <input
                    type="text"
                    value={formData.material}
                    onChange={(e) => setFormData({ ...formData, material: e.target.value.toUpperCase() })}
                    placeholder="Tipo de material"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Partida *</label>
                  <input
                    type="text"
                    value={formData.partida}
                    onChange={(e) => setFormData({ ...formData, partida: e.target.value.toUpperCase() })}
                    required
                    placeholder="Lugar de partida"
                  />
                </div>
                <div className="form-group">
                  <label>Llegada *</label>
                  <input
                    type="text"
                    value={formData.llegada}
                    onChange={(e) => setFormData({ ...formData, llegada: e.target.value.toUpperCase() })}
                    required
                    placeholder="Lugar de llegada"
                  />
                </div>
              </div>
              <div className="form-row">                  <div className="form-group">
                    <label>Mes</label>
                    <select
                      value={formData.mes}
                      onChange={(e) => setFormData({ ...formData, mes: e.target.value })}
                    >
                      <option value="">-- Sin mes --</option>
                      {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">                <div className="form-group">
                  <label>Precio Venta (sin IGV) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precioVentaSinIgv}
                    onChange={(e) => setFormData({ ...formData, precioVentaSinIgv: e.target.value })}
                    required
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Moneda Venta</label>
                  <select
                    value={formData.moneda}
                    onChange={(e) => setFormData({ ...formData, moneda: e.target.value })}
                  >
                    <option value="PEN">Soles (PEN)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Precio Venta (con IGV)</label>
                  <input
                    type="text"
                    value={formData.precioVentaSinIgv ? (parseFloat(formData.precioVentaSinIgv) * 1.18).toFixed(2) : '0.00'}
                    readOnly
                    className="input-readonly"
                  />
                </div>
                <div className="form-group">
                  <label>Moneda Venta (con IGV)</label>
                  <input
                    type="text"
                    value={formData.moneda === 'PEN' ? 'Soles (PEN)' : 'Dólares (USD)'}
                    readOnly
                    className="input-readonly"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Precio Costo (sin IGV)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precioCostoSinIgv}
                    onChange={(e) => setFormData({ ...formData, precioCostoSinIgv: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Divisa Costo</label>
                  <select
                    value={formData.divisa}
                    onChange={(e) => setFormData({ ...formData, divisa: e.target.value })}
                  >
                    <option value="PEN">Soles (PEN)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Precio Costo (con IGV)</label>
                  <input
                    type="text"
                    value={formData.precioCostoSinIgv ? (parseFloat(formData.precioCostoSinIgv) * 1.18).toFixed(2) : '0.00'}
                    readOnly
                    className="input-readonly"
                  />
                </div>
                <div className="form-group">
                  <label>Divisa Costo (con IGV)</label>
                  <input
                    type="text"
                    value={formData.divisa === 'PEN' ? 'Soles (PEN)' : 'Dólares (USD)'}
                    readOnly
                    className="input-readonly"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingTarifa ? 'Actualizar' : 'Crear'}
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
            <p>
              ¿Estás seguro de eliminar la tarifa de <strong>{confirmDelete.cliente}</strong> 
              {' '}({confirmDelete.partida} → {confirmDelete.llegada})?
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

export default AdminTarifas;
