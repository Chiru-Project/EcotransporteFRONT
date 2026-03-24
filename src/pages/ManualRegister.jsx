import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { documentService, empresaTransporteService, unidadService, clientTariffService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import './EditDocument.css';

const DIVISAS = ['USD', 'PEN'];

const ManualRegister = () => {
  const navigate = useNavigate();
  const notification = useNotification();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [empresas, setEmpresas] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [tarifas, setTarifas] = useState([]);

  const [showTarifaPopup, setShowTarifaPopup] = useState(false);
  const [tarifaResults, setTarifaResults] = useState([]);
  const [tarifaLoading, setTarifaLoading] = useState(false);
  const [modoEspecial, setModoEspecial] = useState(false);

  const [formData, setFormData] = useState({
    ticket: '',
    factura: '',
    tn_recibida: '',
    fecha: '',
    grt: '',
    grr: '',
    transportista: '',
    unidad: '',
    empresa: '',
    tn_enviado: '',
    deposito: '',
    cliente: '',
    partida: '',
    llegada: '',
    transportado: '',
    precio_unitario: '',
    divisa: 'USD',
    precio_final: '',
    pcosto: '',
    divisa_cost: 'USD',
    costo_final: '',
    margen_operativo: '',
  });

  const esEcotransporte = (formData.empresa || '').toUpperCase().includes('ECOTRANSPORTE');
  const esTarifaFija = ((formData.cliente || '').toUpperCase().includes('NUKLEO') || (formData.cliente || '').toUpperCase().includes('PAY METAL'));

  useEffect(() => {
    loadCatalogos();
  }, []);

  const loadCatalogos = async () => {
    try {
      const [empRes, unidRes, tarRes] = await Promise.all([
        empresaTransporteService.getActivas(),
        unidadService.getActivas(),
        clientTariffService.getAll(),
      ]);
      setEmpresas(empRes || []);
      setUnidades(unidRes || []);
      setTarifas(tarRes || []);
    } catch (err) {
      console.error('Error cargando catálogos:', err);
    }
  };

  const clientesUnicos = [...new Set(tarifas.map(t => t.cliente))].filter(Boolean).sort();

  const tarifasFiltradas1 = formData.cliente
    ? tarifas.filter(t => t.cliente === formData.cliente)
    : tarifas;
  const partidasUnicas = [...new Set(tarifasFiltradas1.map(t => t.partida))].filter(Boolean).sort();

  const tarifasFiltradas2 = formData.partida
    ? tarifasFiltradas1.filter(t => t.partida === formData.partida)
    : tarifasFiltradas1;
  const llegadasUnicas = [...new Set(tarifasFiltradas2.map(t => t.llegada))].filter(Boolean).sort();

  const tarifasFiltradas3 = formData.llegada
    ? tarifasFiltradas2.filter(t => t.llegada === formData.llegada)
    : tarifasFiltradas2;
  const materialesUnicos = [...new Set(tarifasFiltradas3.map(t => t.material))].filter(Boolean).sort();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      // Cascada: al cambiar un padre, resetear hijos
      if (name === 'cliente') { next.partida = ''; next.llegada = ''; next.transportado = ''; }
      if (name === 'partida') { next.llegada = ''; next.transportado = ''; }
      if (name === 'llegada') { next.transportado = ''; }
      return next;
    });
  };

  const handleUnidadChange = (e) => {
    const placa = e.target.value;
    const unidadEncontrada = unidades.find(u => u.placa === placa);
    setFormData(prev => ({
      ...prev,
      unidad: placa,
      empresa: unidadEncontrada?.empresa?.nombre || prev.empresa,
    }));
  };

  const handleBuscarTarifa = async () => {
    setShowTarifaPopup(true);
    setTarifaLoading(true);
    setTarifaResults([]);
    try {
      const results = await clientTariffService.searchMatch({
        cliente: formData.cliente || '',
        partida: formData.partida || '',
        llegada: formData.llegada || '',
        material: formData.transportado || '',
      });
      setTarifaResults(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error('Error buscando tarifas:', err);
      setTarifaResults([]);
    } finally {
      setTarifaLoading(false);
    }
  };

  const handleSelectTarifa = (tarifa) => {
    const precioUnitario = Number(tarifa.precioVentaConIgv) || 0;
    const pcosto = Number(tarifa.precioCostoConIgv) || 0;
    const tnRecibida = Number(formData.tn_recibida) || Number(formData.tn_enviado) || 0;
    const clienteUpper = (formData.cliente || '').toUpperCase();
    const tarifaFija = clienteUpper.includes('NUKLEO') || clienteUpper.includes('PAY METAL');

    const precioFinal = tarifaFija ? precioUnitario : (tnRecibida ? Number((precioUnitario * tnRecibida).toFixed(2)) : '');
    const esEco = (formData.empresa || '').toUpperCase().includes('ECOTRANSPORTE');
    const costoFinal = esEco ? 0 : (tarifaFija ? pcosto : (tnRecibida ? Number((pcosto * tnRecibida).toFixed(2)) : ''));
    const margen = (precioFinal !== '' && costoFinal !== '') ? Number((precioFinal - costoFinal).toFixed(2)) : '';

    setFormData(prev => ({
      ...prev,
      precio_unitario: precioUnitario || '',
      divisa: tarifa.moneda || 'USD',
      precio_final: precioFinal,
      pcosto: pcosto || '',
      divisa_cost: tarifa.divisa || 'USD',
      costo_final: costoFinal,
      margen_operativo: margen,
    }));
    setShowTarifaPopup(false);
    setModoEspecial(false);
    notification.success('Tarifa aplicada correctamente');
  };

  const handleEspecialChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      const tn = Number(next.tn_recibida) || Number(next.tn_enviado) || 0;
      const pu = Number(next.precio_unitario) || 0;
      const pc = Number(next.pcosto) || 0;
      const esEco = (next.empresa || '').toUpperCase().includes('ECOTRANSPORTE');
      const clienteUpper = (next.cliente || '').toUpperCase();
      const tarifaFija = clienteUpper.includes('NUKLEO') || clienteUpper.includes('PAY METAL');
      next.precio_final = tarifaFija ? pu : (tn ? Number((pu * tn).toFixed(2)) : '');
      next.costo_final = esEco ? 0 : (tarifaFija ? pc : (tn ? Number((pc * tn).toFixed(2)) : ''));
      next.margen_operativo = (next.precio_final !== '' && next.costo_final !== '') ? Number((next.precio_final - next.costo_final).toFixed(2)) : '';
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fecha || !formData.grt) {
      notification.error('La fecha y GRT son obligatorios');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const payload = {
        fecha: formData.fecha || null,
        grt: formData.grt || null,
        grr: formData.grr || null,
        transportista: formData.transportista || null,
        unidad: formData.unidad || null,
        cliente: formData.cliente || null,
        partida: formData.partida || null,
        llegada: formData.llegada || null,
        transportado: formData.transportado || null,
        tn_enviado: formData.tn_enviado ? Number(formData.tn_enviado) : null,
        tn_recibida: formData.tn_recibida ? Number(formData.tn_recibida) : null,
        ticket: formData.ticket || null,
        factura: formData.factura || null,
        deposito: formData.deposito || null,
        precio_unitario: formData.precio_unitario !== '' ? Number(formData.precio_unitario) : null,
        divisa: formData.divisa || null,
        pcosto: formData.pcosto !== '' ? Number(formData.pcosto) : null,
        divisa_cost: formData.divisa_cost || null,
        precio_final: formData.precio_final !== '' ? Number(formData.precio_final) : null,
        costo_final: formData.costo_final !== '' ? Number(formData.costo_final) : null,
        margen_operativo: formData.margen_operativo !== '' ? Number(formData.margen_operativo) : null,
      };
      const result = await documentService.createManual(payload);
      if (result?.data?.motivo) {
        notification.warning(`⚠️ Registro creado pero incompleto: ${result.data.motivo}`);
      } else {
        notification.success('Registro creado exitosamente');
      }
      navigate('/documents');
    } catch (err) {
      setError(err.message || 'Error al crear el registro');
      notification.error('Error al crear el registro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="edit-document">
      <div className="edit-header">
        <Link to="/dashboard" className="back-link">&larr; Volver al Dashboard</Link>
        <div className="header-title-row">
          <h1>✏️ Agregar Registro Manual</h1>
        </div>
        <p className="document-code">Nuevo documento</p>
      </div>

      <form onSubmit={handleSubmit} className="edit-form">
        {error && <div className="error-message">{error}</div>}

        <div className="form-section">
          <h2>Datos del Ticket</h2>
          <div className="form-grid">
            <div className="form-group ticket-highlight">
              <label htmlFor="ticket">Ticket</label>
              <input type="text" id="ticket" name="ticket" value={formData.ticket} onChange={handleChange} placeholder="Número de ticket" className="ticket-input" />
            </div>
            <div className="form-group ticket-highlight">
              <label htmlFor="factura">ID de Factura</label>
              <input type="text" id="factura" name="factura" value={formData.factura} onChange={handleChange} placeholder="Ej: F001-00001234" className="ticket-input" />
            </div>
            <div className="form-group ticket-highlight">
              <label htmlFor="tn_recibida">Peso Ticket (TN Recibida)</label>
              <input type="number" step="0.01" id="tn_recibida" name="tn_recibida" value={formData.tn_recibida} onChange={handleChange} placeholder="Tonelaje recibido" className="ticket-input" />
            </div>
          </div>
        </div>

        <div className="form-section admin-section">
          <h2>Datos del Documento</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="fecha">Fecha <span style={{ color: '#e53e3e', fontWeight: 700 }}>*</span></label>
              <input type="date" id="fecha" name="fecha" value={formData.fecha} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="grt">GRT <span style={{ color: '#e53e3e', fontWeight: 700 }}>*</span></label>
              <input type="text" id="grt" name="grt" value={formData.grt} onChange={handleChange} placeholder="VVV1-000000" required />
            </div>
            <div className="form-group">
              <label htmlFor="grr">GRR</label>
              <input type="text" id="grr" name="grr" value={formData.grr} onChange={handleChange} placeholder="EG07-00000" />
            </div>
            <div className="form-group">
              <label htmlFor="transportista">Transportista</label>
              <input type="text" id="transportista" name="transportista" value={formData.transportista} onChange={handleChange} placeholder="Nombre completo" />
            </div>
            <div className="form-group">
              <label htmlFor="unidad">Placa (Unidad)</label>
              <select id="unidad" name="unidad" value={formData.unidad} onChange={handleUnidadChange}>
                <option value="">-- Seleccionar placa --</option>
                {unidades.map(u => (
                  <option key={u.id} value={u.placa}>{u.placa}{u.empresa ? ` (${u.empresa.nombre})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="empresa">Empresa</label>
              <select id="empresa" name="empresa" value={formData.empresa} onChange={handleChange}>
                <option value="">-- Seleccionar empresa --</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.nombre}>{e.nombre}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="tn_enviado">Peso Guía (TN Enviada)</label>
              <input type="number" step="0.01" id="tn_enviado" name="tn_enviado" value={formData.tn_enviado} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="deposito">Depósito</label>
              <input type="text" id="deposito" name="deposito" value={formData.deposito} onChange={handleChange} placeholder="IMPALA / LOGIMINSA / CONCESION" />
            </div>
          </div>
        </div>

        <div className="form-section admin-section">
          <h2>Ruta y Carga</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="cliente">Cliente</label>
              <select id="cliente" name="cliente" value={formData.cliente} onChange={handleChange}>
                <option value="">-- Seleccionar cliente --</option>
                {clientesUnicos.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="partida">Punto de Partida</label>
              <select id="partida" name="partida" value={formData.partida} onChange={handleChange} disabled={!formData.cliente}>
                <option value="">{!formData.cliente ? '-- Primero selecciona cliente --' : '-- Seleccionar partida --'}</option>
                {partidasUnicas.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="llegada">Punto de Llegada</label>
              <select id="llegada" name="llegada" value={formData.llegada} onChange={handleChange} disabled={!formData.partida}>
                <option value="">{!formData.partida ? '-- Primero selecciona partida --' : '-- Seleccionar llegada --'}</option>
                {llegadasUnicas.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="transportado">Material Transportado</label>
              <select id="transportado" name="transportado" value={formData.transportado} onChange={handleChange} disabled={!formData.llegada}>
                <option value="">{!formData.llegada ? '-- Primero selecciona llegada --' : '-- Seleccionar material --'}</option>
                {materialesUnicos.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="form-section admin-section">
          <h2>Datos Financieros</h2>
          <div className="tarifa-selector-bar">
            <button type="button" className="btn-buscar-tarifa" onClick={handleBuscarTarifa}>
              🔍 Buscar Tarifa
            </button>
            <button type="button" className={`btn-modo-especial${modoEspecial ? ' active' : ''}`} onClick={() => setModoEspecial(true)} disabled={modoEspecial}>
              ✏️ {modoEspecial ? 'Modo especial activo' : 'Precio y Costo Especial'}
            </button>
            <span className="tarifa-hint">{modoEspecial ? 'Edita precio y costo unitario manualmente' : 'Selecciona una tarifa basada en cliente, partida, llegada y material'}</span>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Precio Unitario con IGV</label>
              {modoEspecial ? (
                <input type="number" step="0.01" className="ticket-input" value={formData.precio_unitario} onChange={(e) => handleEspecialChange('precio_unitario', e.target.value)} placeholder="0.00" />
              ) : (
                <div className="readonly-financial">{formData.precio_unitario !== '' ? formData.precio_unitario : '-'} {formData.divisa}</div>
              )}
            </div>
            <div className="form-group">
              <label>Moneda Venta</label>
              <div className="readonly-financial">{formData.divisa || '-'}</div>
            </div>
            <div className="form-group">
              <label>Precio Final</label>
              <div className="readonly-financial">{formData.precio_final !== '' ? formData.precio_final : '-'} {formData.divisa}</div>
            </div>
            <div className="form-group">
              <label>Costo Unitario con IGV</label>
              {modoEspecial ? (
                <input type="number" step="0.01" className="ticket-input" value={formData.pcosto} onChange={(e) => handleEspecialChange('pcosto', e.target.value)} placeholder="0.00" />
              ) : (
                <div className="readonly-financial">{formData.pcosto !== '' ? formData.pcosto : '-'} {formData.divisa_cost}</div>
              )}
            </div>
            <div className="form-group">
              <label>Moneda Costo</label>
              <div className="readonly-financial">{formData.divisa_cost || '-'}</div>
            </div>
            <div className="form-group">
              <label>Costo Final</label>
              <div className="readonly-financial">{formData.costo_final !== '' ? formData.costo_final : '-'} {formData.divisa_cost}</div>
            </div>
            <div className="form-group">
              <label>Margen Operativo</label>
              <div className="readonly-financial">{formData.margen_operativo !== '' ? formData.margen_operativo : '-'}</div>
            </div>
          </div>
          {esEcotransporte && (
            <div className="ecotransporte-cost-notice">
              <span>&#9432;</span> Al ser Ecotransporte, los campos <strong>Costo Unitario con IGV</strong>, <strong>Costo Final</strong> y <strong>Margen Operativo</strong> se guardan y muestran como <strong>0</strong>.
            </div>
          )}
          {esTarifaFija && (
            <div className="ecotransporte-cost-notice">
              <span>&#9432;</span> El cliente <strong>{formData.cliente}</strong> cobra por servicio, no por tonelada. El precio y costo son <strong>fijos por viaje</strong>, sin multiplicar por TN.
            </div>
          )}
        </div>

        {showTarifaPopup && (
          <div className="tarifa-popup-overlay" onClick={() => setShowTarifaPopup(false)}>
            <div className="tarifa-popup" onClick={(e) => e.stopPropagation()}>
              <div className="tarifa-popup-header">
                <h3>Seleccionar Tarifa</h3>
                <button type="button" className="tarifa-popup-close" onClick={() => setShowTarifaPopup(false)}>✕</button>
              </div>
              <div className="tarifa-popup-filters">
                <span><strong>Cliente:</strong> {formData.cliente || '—'}</span>
                <span><strong>Partida:</strong> {formData.partida || '—'}</span>
                <span><strong>Llegada:</strong> {formData.llegada || '—'}</span>
                <span><strong>Material:</strong> {formData.transportado || '—'}</span>
              </div>
              <div className="tarifa-popup-body">
                {tarifaLoading ? (
                  <div className="tarifa-popup-loading"><div className="spinner"></div><p>Buscando tarifas...</p></div>
                ) : tarifaResults.length === 0 ? (
                  <div className="tarifa-popup-empty">No se encontraron tarifas para esta combinación</div>
                ) : (
                  <div className="tarifa-popup-list">
                    {tarifaResults.map((t) => (
                      <div key={t.id} className="tarifa-popup-item" onClick={() => handleSelectTarifa(t)}>
                        <div className="tarifa-item-route">
                          <strong>{t.cliente}{t.mes ? <span className="tarifa-item-mes"> — {t.mes}</span> : null}</strong>
                          <span>{t.partida} → {t.llegada}</span>
                          <span className="tarifa-item-material">{t.material}</span>
                        </div>
                        <div className="tarifa-item-prices">
                          <span className="tarifa-price-sell">Venta: {Number(t.precioVentaConIgv).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t.moneda}</span>
                          <span className="tarifa-price-cost">Costo: {Number(t.precioCostoConIgv).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t.divisa}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <Link to="/dashboard" className="btn-secondary">Cancelar</Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Crear Registro'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ManualRegister;
