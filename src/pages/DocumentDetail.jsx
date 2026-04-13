import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { documentService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import './DocumentDetail.css';
import FileDropdown from '../components/FileDropdown';

const DocumentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const notification = useNotification();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingFactura, setEditingFactura] = useState(false);
  const [facturaValue, setFacturaValue] = useState('');
  const [savingFactura, setSavingFactura] = useState(false);

  const handleSaveFactura = async () => {
    setSavingFactura(true);
    try {
      const response = await documentService.update(id, { factura: facturaValue.trim() || null });
      setDocument(response.data);
      setEditingFactura(false);
      notification.success('Factura actualizada correctamente');
    } catch (err) {
      notification.error('Error al actualizar la factura');
    } finally {
      setSavingFactura(false);
    }
  };

  const handleCancelFactura = () => {
    setEditingFactura(false);
    setFacturaValue(document?.factura || '');
  };

  useEffect(() => {
    loadDocument();
  }, [id]);

  const loadDocument = async () => {
    try {
      const response = await documentService.getById(id);
      setDocument(response.data);
    } catch (err) {
      setError('Documento no encontrado');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de eliminar este documento?')) return;
    
    try {
      await documentService.delete(id);
      navigate('/documents');
    } catch (err) {
      alert('Error al eliminar el documento');
    }
  };

  const handleAnular = async () => {
    const action = document.anulado ? 'restaurar' : 'anular';
    if (!window.confirm(`¿Estás seguro de ${action} este documento?`)) return;
    
    try {
      const response = await documentService.anular(id);
      setDocument(response.data);
      notification.success(response.message);
    } catch (err) {
      notification.error(`Error al ${action} el documento`);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando documento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <Link to="/documents" className="btn-primary">Volver a documentos</Link>
      </div>
    );
  }

  const esEcotransporte = (document.empresa || '').toUpperCase().includes('ECOTRANSPORTE');
  const formatAmount = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className={`document-detail${document.anulado ? ' anulado' : ''}`}>
      {document.anulado && (
        <div className="anulado-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          DOCUMENTO ANULADO
        </div>
      )}

      {(() => {
        const faltantes = [];
        const tarifaSinAsignar = document.precio_unitario === null || document.precio_unitario === undefined || document.precio_unitario === '';
        const tarifaEsCero = !tarifaSinAsignar && Number(document.precio_unitario) === 0;
        const empresaAsignada = String(document.empresa || '').trim();
        if (!document.cliente) faltantes.push('Cliente no identificado');
        if (!document.partida) faltantes.push('Punto de partida no identificado');
        if (!document.llegada) faltantes.push('Punto de llegada no identificado');
        if (!document.transportado) faltantes.push('Material transportado no reconocido');
        if (!document.tn_enviado) faltantes.push('Peso y unidad de medida no identificada en la guia.');
        if (tarifaSinAsignar) faltantes.push('Tarifa no encontrada');
        if (document.unidad && !empresaAsignada) faltantes.push('Placa no ligada a una empresa de transporte');
        if (!document.unidad) faltantes.push('Placa del vehículo no identificada');
        if (faltantes.length > 0) {
          return (
            <div className="motivo-detail-banner">
              <div className="motivo-detail-icon">&#9888;</div>
              <div className="motivo-detail-body">
                <strong>Documento incompleto</strong>
                <p className="motivo-detail-text">{faltantes.join(' | ')}</p>
              </div>
            </div>
          );
        }

        if (tarifaEsCero) {
          return (
            <div className="tarifa-cero-detail-banner">
              <div className="tarifa-cero-detail-icon">&#9432;</div>
              <div className="tarifa-cero-detail-body">
                <strong>Tarifa en 0.00</strong>
                <p className="tarifa-cero-detail-text">La tarifa de este cliente es 0.00 en el tarifario y es un valor valido.</p>
              </div>
            </div>
          );
        }

        return null;
      })()}
      <div className="detail-header">
        <div className="header-info">
          <Link to="/documents" className="back-link">← Volver</Link>
          <h1>📝 Guía de Remisión</h1>
          <p className="document-code">{document.grt}</p>
        </div>
        <div className="header-actions">
          <button onClick={handleAnular} className={document.anulado ? 'btn-restore' : 'btn-anular'} title={document.anulado ? 'Restaurar' : 'Anular'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> {document.anulado ? 'Restaurar' : 'Anular'}
          </button>
          <Link to={`/documents/${id}/edit`} className="btn-edit" title="Editar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar
          </Link>
          <button onClick={handleDelete} className="btn-delete" title="Eliminar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Eliminar
          </button>
        </div>
      </div>

      <div className="detail-grid">
        {/* Información General */}
        <div className="detail-section">
          <h2>📋 Información General</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>GRT</label>
              <span>{document.grt || '-'}</span>
            </div>
            <div className="info-item">
              <label>GRR</label>
              <span>{document.grr || '-'}</span>
            </div>
            <div className="info-item">
              <label>Fecha</label>
              <span>{document.fecha || '-'}</span>
            </div>
            <div className="info-item">
              <label>Mes</label>
              <span>{document.mes || '-'}</span>
            </div>
            <div className="info-item">
              <label>Semana</label>
              <span>{document.semana || '-'}</span>
            </div>
            <div className="info-item">
              <label>Ticket</label>
              <span>{document.ticket || '-'}</span>
            </div>
          </div>
        </div>

        {/* Transporte */}
        <div className="detail-section">
          <h2>🚚 Transporte</h2>
          <div className="info-grid">
            <div className="info-item full">
              <label>Conductor Principal</label>
              <span>{document.transportista || '-'}</span>
            </div>
            <div className="info-item full">
              <label>Empresa de Transporte</label>
                <span>{document.empresa || '-'}</span>
              </div>
              <div className="info-item">
                <label>Unidad</label>
                <span>{document.unidad || '-'}</span>
            </div>
            <div className="info-item full">
              <label>Producto Transportado</label>
              <span>{document.transportado || '-'}</span>
            </div>
          </div>
        </div>

        {/* Origen y Destino */}
        <div className="detail-section">
          <h2>📍 Origen y Destino</h2>
          <div className="info-grid">
            <div className="info-item full">
              <label>Empresa Remitente</label>
              <span>{document.empresa || '-'}</span>
            </div>
            <div className="info-item full">
              <label>Depósito</label>
              <span>{document.deposito || '-'}</span>
            </div>
            <div className="info-item full">
              <label>Punto de Partida</label>
              <span>{document.partida || '-'}</span>
            </div>
            <div className="info-item full">
              <label>Cliente</label>
              <span>{document.cliente || '-'}</span>
            </div>
            <div className="info-item full">
              <label>Punto de Llegada</label>
              <span>{document.llegada || '-'}</span>
            </div>
          </div>
        </div>

        {/* Tonelaje */}
        <div className="detail-section highlight">
          <h2>⚖️ Tonelaje</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Peso Guía (TN Enviada)</label>
              <span className="value-large">{document.tn_enviado || '-'}</span>
            </div>
            <div className="info-item">
              <label>Peso Ticket (TN Recibida)</label>
              <span className="value-large">{document.tn_recibida || '-'}</span>
            </div>
          </div>
        </div>

        {/* Archivos adjuntos */}
        <div className="detail-section">
          <h2>📎 Archivos adjuntos</h2>
          <FileDropdown
            document={document}
            onUpdate={(updated) => setDocument(updated)}
          />
        </div>

        {/* Facturación */}
        <div className="detail-section">
          <h2>🧾 Facturación</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Código de Factura</label>
              {editingFactura ? (
                <div className="factura-inline-edit">
                  <input
                    type="text"
                    value={facturaValue}
                    onChange={(e) => setFacturaValue(e.target.value)}
                    placeholder="Ingrese código de factura"
                    className="factura-input"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFactura(); if (e.key === 'Escape') handleCancelFactura(); }}
                  />
                  <button onClick={handleSaveFactura} className="btn-factura-save" disabled={savingFactura} title="Guardar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button onClick={handleCancelFactura} className="btn-factura-cancel" title="Cancelar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ) : (
                <span className={document.factura ? '' : 'no-data'}>
                  {document.factura || 'Sin factura'}
                  <button className="btn-factura-edit" onClick={() => { setFacturaValue(document.factura || ''); setEditingFactura(true); }} title="Editar factura">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Información Financiera */}
        <div className="detail-section">
          <h2>💰 Información Financiera</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Precio Unitario con IGV</label>
              <span>{document.precio_unitario !== null && document.precio_unitario !== undefined && document.precio_unitario !== '' ? `${formatAmount(document.precio_unitario)} ${document.divisa || ''}` : '-'}</span>
            </div>
            <div className="info-item">
              <label>Precio Final</label>
              <span>{document.precio_final !== null && document.precio_final !== undefined && document.precio_final !== '' ? `${formatAmount(document.precio_final)} ${document.divisa || ''}` : '-'}</span>
            </div>
            <div className="info-item">
              <label>Costo Unitario con IGV</label>
              <span>{esEcotransporte ? '0.00' : (document.pcosto !== null && document.pcosto !== undefined && document.pcosto !== '' ? `${formatAmount(document.pcosto)} ${document.divisa_cost || ''}` : '-')}</span>
            </div>
            <div className="info-item">
              <label>Costo Final</label>
              <span>{esEcotransporte ? '0.00' : (document.costo_final !== null && document.costo_final !== undefined && document.costo_final !== '' ? `${formatAmount(document.costo_final)} ${document.divisa_cost || ''}` : '-')}</span>
            </div>
            <div className="info-item">
              <label>Margen Operativo</label>
              <span>{esEcotransporte ? '0.00' : formatAmount(document.margen_operativo)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetail;
