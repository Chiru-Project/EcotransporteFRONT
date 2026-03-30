import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { documentService, empresaTransporteService, unidadService, clientTariffService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import './EditDocument.css';

const DIVISAS = ['USD', 'PEN'];

const EditDocument = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const notification = useNotification();
  const { user } = useAuth();
  const isAdmin = user?.role === 1;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [document, setDocument] = useState(null);

  // Catálogos desde la BD
  const [empresas, setEmpresas] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [tarifas, setTarifas] = useState([]);

  // Popup selector de tarifa
  const [showTarifaPopup, setShowTarifaPopup] = useState(false);
  const [tarifaResults, setTarifaResults] = useState([]);
  const [tarifaLoading, setTarifaLoading] = useState(false);
  const [modoEspecial, setModoEspecial] = useState(false);

  const [formData, setFormData] = useState({
    ticket: '',
    factura: '',
    tn_recibida: '',
    tn_recibida_data_cruda: '',
    fecha: '',
    mes: '',
    semana: '',
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
  const tarifaSinAsignar = document?.precio_unitario === null || document?.precio_unitario === undefined || document?.precio_unitario === '';
  const tarifaEsCero = !tarifaSinAsignar && Number(document?.precio_unitario) === 0;

  useEffect(() => {
    loadDocument();
    loadCatalogos();
  }, [id]);

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

  // Valores únicos para selects de tarifa (filtrados en cascada)
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

  const loadDocument = async () => {
    try {
      const response = await documentService.getById(id);
      const doc = response.data;
      setDocument(doc);
      setFormData({
        ticket: doc.ticket || '',
        factura: doc.factura || '',
        tn_recibida: doc.tn_recibida ?? '',
        tn_recibida_data_cruda: doc.tn_recibida_data_cruda ?? '',
        fecha: doc.fecha ? doc.fecha.toString().substring(0, 10) : '',
        mes: doc.mes || '',
        semana: doc.semana || '',
        grt: doc.grt || '',
        grr: doc.grr || '',
        transportista: doc.transportista || '',
        unidad: doc.unidad || '',
        empresa: doc.empresa || '',
        tn_enviado: doc.tn_enviado ?? '',
        deposito: doc.deposito || '',
        cliente: doc.cliente || '',
        partida: doc.partida || '',
        llegada: doc.llegada || '',
        transportado: doc.transportado || '',
        precio_unitario: doc.precio_unitario ?? '',
        divisa: doc.divisa || 'USD',
        precio_final: doc.precio_final ?? '',
        pcosto: doc.pcosto ?? '',
        divisa_cost: doc.divisa_cost || 'USD',
        costo_final: doc.costo_final ?? '',
        margen_operativo: doc.margen_operativo ?? '',
      });
    } catch (err) {
      setError('Documento no encontrado');
    } finally {
      setLoading(false);
    }
  };

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

  // Al cambiar la placa, auto-rellena empresa si está en la BD
  const handleUnidadChange = (e) => {
    const placa = e.target.value;
    const unidadEncontrada = unidades.find(u => u.placa === placa);
    setFormData(prev => ({
      ...prev,
      unidad: placa,
      empresa: unidadEncontrada?.empresa?.nombre || prev.empresa,
    }));
  };

  // Buscar tarifas coincidentes según el documento actual
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

  // Al seleccionar una tarifa, llenar campos financieros y recalcular
  const handleSelectTarifa = (tarifa) => {
    const precioUnitario = Number(tarifa.precioVentaConIgv) || 0;
    const pcosto = Number(tarifa.precioCostoConIgv) || 0;
    const tnRecibida = Number(formData.tn_recibida) || 0;
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

  // Recalcular campos derivados al editar precio/costo en modo especial
  const handleEspecialChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      const tn = Number(next.tn_recibida) || 0;
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
    setSaving(true);
    setError('');

    try {
      let updateData;
      if (isAdmin) {
        updateData = {
          ticket: formData.ticket || null,
          factura: formData.factura || null,
          tn_recibida: formData.tn_recibida !== '' ? Number(formData.tn_recibida) : null,
          tn_recibida_data_cruda: formData.tn_recibida_data_cruda !== '' ? Number(formData.tn_recibida_data_cruda) : null,
          fecha: formData.fecha || null,
          mes: formData.mes || null,
          semana: formData.semana || null,
          grt: formData.grt || null,
          grr: formData.grr || null,
          transportista: formData.transportista || null,
          unidad: formData.unidad || null,
          empresa: formData.empresa || null,
          tn_enviado: formData.tn_enviado !== '' ? Number(formData.tn_enviado) : null,
          deposito: formData.deposito || null,
          cliente: formData.cliente || null,
          partida: formData.partida || null,
          llegada: formData.llegada || null,
          transportado: formData.transportado || null,
          precio_unitario: formData.precio_unitario !== '' ? Number(formData.precio_unitario) : null,
          divisa: formData.divisa || null,
          precio_final: formData.precio_final !== '' ? Number(formData.precio_final) : null,
          pcosto: formData.pcosto !== '' ? Number(formData.pcosto) : null,
          divisa_cost: formData.divisa_cost || null,
          costo_final: formData.costo_final !== '' ? Number(formData.costo_final) : null,
          margen_operativo: formData.margen_operativo !== '' ? Number(formData.margen_operativo) : null,
        };
      } else {
        updateData = {
          ticket: formData.ticket || null,
          factura: formData.factura || null,
          tn_recibida: formData.tn_recibida !== '' ? Number(formData.tn_recibida) : null,
          tn_recibida_data_cruda: formData.tn_recibida_data_cruda !== '' ? Number(formData.tn_recibida_data_cruda) : null,
        };
      }

      const result = await documentService.update(id, updateData);
      if (result?.data?.motivo) {
        notification.warning(`⚠️ Documento guardado pero incompleto: ${result.data.motivo}`);
      } else {
        notification.success('Datos guardados correctamente');
      }
      navigate(`/documents/${id}`);
    } catch (err) {
      setError(err.message || 'Error al guardar los cambios');
      notification.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
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

  if (error && !document) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <Link to="/documents" className="btn-primary">Volver a documentos</Link>
      </div>
    );
  }

  return (
    <div className="edit-document">
      <div className="edit-header">
        <Link to={`/documents/${id}`} className="back-link">&larr; Volver</Link>
        <div className="header-title-row">
          <h1>
            {isAdmin ? 'Editar Documento (Admin)' : 'Editar Datos del Ticket'}
          </h1>
        </div>
        <p className="document-code">{document?.grt}</p>
      </div>

      {document?.updater && (
        <div className="edit-audit-bar">
          <span>Ultima edicion por <strong>{document.updater?.userInformation?.userName || document.updater?.email}</strong></span>
          {document.updated_at && (
            <span className="audit-date"> - {new Date(document.updated_at).toLocaleString('es-PE')}</span>
          )}
        </div>
      )}

      {!isAdmin && (
        <div className="locked-notice">
          <span className="lock-icon-large">&#128274;</span>
          <div className="locked-text">
            <strong>Documento bloqueado</strong>
            <p>Solo puedes editar los datos del ticket: numero de ticket y tonelaje recibido.</p>
          </div>
        </div>
      )}

      {isAdmin && tarifaSinAsignar && (
        <div className="admin-warning-notice">
          <span>Atencion</span>
          <div>
            <strong>Documento incompleto</strong>
            <p>Este documento no tiene tarifa asignada. Puedes completar los campos financieros manualmente.</p>
          </div>
        </div>
      )}

      {isAdmin && tarifaEsCero && (
        <div className="admin-warning-notice">
          <span>Atencion</span>
          <div>
            <strong>Tarifa en 0.00</strong>
            <p>La tarifa de este documento es 0.00 en el tarifario. Es una tarifa valida y no se considera incompleto.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="edit-form">
        {error && <div className="error-message">{error}</div>}

        {/* ===== DATOS DEL TICKET (todos)----- ===== */}
        <div className="form-section">
          <h2>Datos del Ticket</h2>
          <div className="form-grid">
            <div className="form-group ticket-highlight">
              <label htmlFor="ticket">Ticket <span className="editable-badge">Editable</span></label>
              <input type="text" id="ticket" name="ticket" value={formData.ticket} onChange={handleChange} placeholder="Numero de ticket" className="ticket-input" />
            </div>
            <div className="form-group ticket-highlight">
              <label htmlFor="factura">ID de Factura <span className="editable-badge">Editable</span></label>
              <input type="text" id="factura" name="factura" value={formData.factura} onChange={handleChange} placeholder="Ej: F001-00001234" className="ticket-input" />
            </div>
            <div className="form-group ticket-highlight">
              <label htmlFor="tn_recibida">Peso Ticket (TN Recibida) <span className="editable-badge">Editable</span></label>
              <input type="number" step="0.01" id="tn_recibida" name="tn_recibida" value={formData.tn_recibida} onChange={handleChange} placeholder="Tonelaje recibido" className="ticket-input" />
            </div>
          </div>
        </div>

        {/* ===== ADMIN: DATOS DEL PDF ===== */}
        {isAdmin && (
          <>
            <div className="form-section admin-section">
              <h2>Datos del Documento <span className="admin-badge">Solo Admin</span></h2>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="fecha">Fecha</label>
                  <input type="date" id="fecha" name="fecha" value={formData.fecha} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="mes">Mes</label>
                  <input type="text" id="mes" name="mes" value={formData.mes} onChange={handleChange} placeholder="enero, febrero..." />
                </div>
                <div className="form-group">
                  <label htmlFor="semana">Semana</label>
                  <input type="text" id="semana" name="semana" value={formData.semana} onChange={handleChange} placeholder="1, 2, 3..." />
                </div>
                <div className="form-group">
                  <label htmlFor="grt">GRT</label>
                  <input type="text" id="grt" name="grt" value={formData.grt} onChange={handleChange} placeholder="VVV1-000000" />
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
              <h2>Ruta y Carga <span className="admin-badge">Solo Admin</span></h2>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="cliente">Cliente</label>
                  <div className="campo-actual">Actual: <strong>{document?.cliente || '—'}</strong></div>
                  <select id="cliente" name="cliente" value={formData.cliente} onChange={handleChange}>
                    <option value="">-- Seleccionar cliente --</option>
                    {formData.cliente && !clientesUnicos.includes(formData.cliente) && (
                      <option value={formData.cliente}>{formData.cliente} (actual)</option>
                    )}
                    {clientesUnicos.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="partida">Punto de Partida</label>
                  <div className="campo-actual">Actual: <strong>{document?.partida || '—'}</strong></div>
                  <select id="partida" name="partida" value={formData.partida} onChange={handleChange} disabled={!formData.cliente}>
                    <option value="">{!formData.cliente ? '-- Primero selecciona cliente --' : '-- Seleccionar partida --'}</option>
                    {formData.partida && !partidasUnicas.includes(formData.partida) && (
                      <option value={formData.partida}>{formData.partida} (actual)</option>
                    )}
                    {partidasUnicas.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="llegada">Punto de Llegada</label>
                  <div className="campo-actual">Actual: <strong>{document?.llegada || '—'}</strong></div>
                  <select id="llegada" name="llegada" value={formData.llegada} onChange={handleChange} disabled={!formData.partida}>
                    <option value="">{!formData.partida ? '-- Primero selecciona partida --' : '-- Seleccionar llegada --'}</option>
                    {formData.llegada && !llegadasUnicas.includes(formData.llegada) && (
                      <option value={formData.llegada}>{formData.llegada} (actual)</option>
                    )}
                    {llegadasUnicas.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="transportado">Material Transportado</label>
                  <div className="campo-actual">Actual: <strong>{document?.transportado || '—'}</strong></div>
                  <select id="transportado" name="transportado" value={formData.transportado} onChange={handleChange} disabled={!formData.llegada}>
                    <option value="">{!formData.llegada ? '-- Primero selecciona llegada --' : '-- Seleccionar material --'}</option>
                    {formData.transportado && !materialesUnicos.includes(formData.transportado) && (
                      <option value={formData.transportado}>{formData.transportado} (actual)</option>
                    )}
                    {materialesUnicos.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="form-section admin-section">
              <h2>Datos Financieros <span className="admin-badge">Solo Admin</span></h2>
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

            {/* Popup selector de tarifa */}
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
          </>
        )}

        {/* No-admin: solo lectura del resto */}
        {!isAdmin && (
          <div className="form-section locked-section">
            <h2>Datos del Documento (Solo Lectura)</h2>
            <div className="readonly-grid">
              <div className="readonly-item">
                <span className="readonly-label">Peso Guía (TN Enviada):</span>
                <span className="readonly-value">{document?.tn_enviado || '-'}</span>
              </div>
              <div className="readonly-item">
                <span className="readonly-label">Precio Unitario con IGV:</span>
                <span className="readonly-value">{document?.precio_unitario !== null && document?.precio_unitario !== undefined && document?.precio_unitario !== '' ? document?.precio_unitario : '-'} {document?.divisa}</span>
              </div>
              <div className="readonly-item">
                <span className="readonly-label">Precio Final:</span>
                <span className="readonly-value">{document?.precio_final || '-'}</span>
              </div>
              <div className="readonly-item">
                <span className="readonly-label">Costo Unitario con IGV:</span>
                <span className="readonly-value">{document?.pcosto || '-'} {document?.divisa_cost}</span>
              </div>
              <div className="readonly-item">
                <span className="readonly-label">Costo Final:</span>
                <span className="readonly-value">{document?.costo_final || '-'}</span>
              </div>
              <div className="readonly-item">
                <span className="readonly-label">Margen Operativo:</span>
                <span className="readonly-value">{document?.margen_operativo || '-'}</span>
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <Link to={`/documents/${id}`} className="btn-secondary">Cancelar</Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditDocument;
