import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentService, empresaTransporteService, unidadService, clientTariffService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import logoEmpresa from '../assets/Images/logo-empresa.png';
import './Upload.css';

const Upload = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const notification = useNotification();

  // Wizard state
  const [wizardStep, setWizardStep] = useState(null); // null | 'placas' | 'tarifas' | 'done'
  const [newPlacas, setNewPlacas] = useState([]); // [{placa, empresaId}]
  const [empresas, setEmpresas] = useState([]);
  const [savingWizard, setSavingWizard] = useState(false);

  // Tariff wizard state
  const [missingTariffs, setMissingTariffs] = useState([]); // [{docId, cliente, partida, llegada, transportado, precioVentaSinIgv, precioCostoSinIgv, moneda, divisa}]
  const [savingTariff, setSavingTariff] = useState(false);
  // Docs where OCR found no plate at all — user enters plate manually
  const [docsManualPlaca, setDocsManualPlaca] = useState([]); // [{ docId, grt, placa, empresaId }]
  const [tarifasCatalogo, setTarifasCatalogo] = useState([]); // datos de client_tariff para selects

  // Cargar catálogo de tarifas cuando se abre el wizard de tarifas
  useEffect(() => {
    if (wizardStep === 'tarifas' && tarifasCatalogo.length === 0) {
      clientTariffService.getAll().then(res => setTarifasCatalogo(res || [])).catch(() => {});
    }
  }, [wizardStep]);

  // Filtro bidireccional: filtra opciones según los valores ya seleccionados en cada tarjeta
  const getFilteredOptions = (card) => {
    const filterCatalog = (excludeField) => {
      return tarifasCatalogo.filter(t => {
        if (excludeField !== 'cliente' && card.cliente && t.cliente !== card.cliente) return false;
        if (excludeField !== 'partida' && card.partida && t.partida !== card.partida) return false;
        if (excludeField !== 'llegada' && card.llegada && t.llegada !== card.llegada) return false;
        if (excludeField !== 'material' && card.transportado && t.material !== card.transportado) return false;
        return true;
      });
    };
    return {
      clientes: [...new Set(filterCatalog('cliente').map(t => t.cliente))].filter(Boolean).sort(),
      partidas: [...new Set(filterCatalog('partida').map(t => t.partida))].filter(Boolean).sort(),
      llegadas: [...new Set(filterCatalog('llegada').map(t => t.llegada))].filter(Boolean).sort(),
      materiales: [...new Set(filterCatalog('material').map(t => t.material))].filter(Boolean).sort(),
    };
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    const pdfs = droppedFiles.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    const nonPdfs = droppedFiles.length - pdfs.length;
    if (pdfs.length > 0) {
      setFiles((prev) => [...prev, ...pdfs]);
      if (nonPdfs > 0) {
        setError(`${nonPdfs} archivo(s) ignorado(s) por no ser PDF`);
      } else {
        setError('');
      }
    } else {
      setError('Solo se permiten archivos PDF');
    }
  };

  const handleFileChange = (e) => {
    const allFiles = Array.from(e.target.files);
    const pdfs = allFiles.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    const nonPdfs = allFiles.length - pdfs.length;
    if (pdfs.length > 0) {
      setFiles((prev) => [...prev, ...pdfs]);
      if (nonPdfs > 0) {
        setError(`${nonPdfs} archivo(s) ignorado(s) por no ser PDF`);
      } else {
        setError('');
      }
    } else if (allFiles.length > 0) {
      setError('Solo se permiten archivos PDF');
    }
    // Reset input para poder seleccionar los mismos archivos otra vez
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Por favor selecciona al menos un archivo PDF');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);
    const uploadResults = [];
    const placasNuevas = new Set();
    const tarifasFaltantes = [];
    const docsManualPlacaLocal = [];

    for (let i = 0; i < files.length; i++) {
      setCurrentIndex(i);
      console.log('Upload: processing file', files[i].name, 'index', i);
      try {
        const response = await documentService.upload(files[i]);
        console.log('Upload: success response', response);
        uploadResults.push({ file: files[i].name, success: true, document: response.document });
        if (response.placaNoRegistrada) {
          placasNuevas.add(response.placaNoRegistrada);
        } else if (response.document?.unidad === null) {
          // OCR didn't detect any plate — let user enter it manually
          docsManualPlacaLocal.push({ docId: response.document.id, grt: response.document.grt || '-', placa: '', empresaId: '' });
        }
        if (response.tarifaNoEncontrada && response.document?.id) {
          const tnf = response.tarifaNoEncontrada;
          const mensajes = [];
          if (!tnf.partida || !tnf.llegada) mensajes.push('Ruta incompleta detectada');
          if (!tnf.cliente) mensajes.push('Cliente no detectado');
          if (!tnf.transportado) mensajes.push('Material no detectado');
          if (mensajes.length === 0) mensajes.push('Sin tarifa registrada para esta ruta');
          const motivoTarifa = mensajes.join(' — ');
          tarifasFaltantes.push({
            docId: response.document.id,
            cliente: tnf.cliente || '',
            partida: tnf.partida || '',
            llegada: tnf.llegada || '',
            transportado: tnf.transportado || '',
            precioVentaSinIgv: '',
            precioCostoSinIgv: '',
            moneda: 'USD',
            divisa: 'USD',
            motivo: motivoTarifa,
          });
        }
      } catch (err) {
        console.error('Upload error for', files[i].name, err);
        if (err.rejected) {
          // Documento rechazado por la IA o GRT duplicada — usar el reason específico del backend
          uploadResults.push({ file: files[i].name, success: false, rejected: true, error: err.reason || 'Documento no válido' });
        } else {
          // Error técnico — mostrar el mensaje detallado si existe
          const msg = err.message && err.message !== 'Error en la petición'
            ? err.message
            : 'Error al procesar el documento. Intenta nuevamente.';
          uploadResults.push({ file: files[i].name, success: false, error: msg });
        }
      }
      setResults([...uploadResults]);
    }

    setLoading(false);
    const exitosos = uploadResults.filter((r) => r.success).length;
    const fallidos = uploadResults.filter((r) => !r.success).length;
    if (exitosos > 0) {
      notification.success(`${exitosos} documento(s) procesado(s) exitosamente`);
    }
    if (fallidos > 0) {
      notification.error(`${fallidos} documento(s) fallaron`);
    }

    // Si hay placas nuevas o docs sin placa, iniciar wizard de placas
    if (placasNuevas.size > 0 || docsManualPlacaLocal.length > 0) {
      setNewPlacas([...placasNuevas].map(p => ({ placa: p, empresaId: '' })));
      setDocsManualPlaca(docsManualPlacaLocal);
      try {
        const resp = await empresaTransporteService.getActivas();
        setEmpresas(resp || []);
      } catch (e) {
        setEmpresas([]);
      }
      setWizardStep('placas');
    } else if (tarifasFaltantes.length > 0) {
      // Sin placas nuevas pero sí tarifas faltantes, ir directo a tarifas
      setMissingTariffs(tarifasFaltantes);
      setWizardStep('tarifas');
    }

    // Guardar tarifas faltantes para después del wizard de placas
    if ((placasNuevas.size > 0 || docsManualPlacaLocal.length > 0) && tarifasFaltantes.length > 0) {
      setMissingTariffs(tarifasFaltantes);
    }
  };

  // === WIZARD HANDLERS ===
  const [newEmpresaNombre, setNewEmpresaNombre] = useState('');
  const [newEmpresaRuc, setNewEmpresaRuc] = useState('');
  const [creatingEmpresa, setCreatingEmpresa] = useState(false);

  const handleCreateEmpresa = async () => {
    if (!newEmpresaNombre.trim()) return;
    setCreatingEmpresa(true);
    try {
      const resp = await empresaTransporteService.create({ 
        nombre: newEmpresaNombre.trim().toUpperCase(), 
        ruc: newEmpresaRuc.trim() || null 
      });
      const created = resp;
      setEmpresas(prev => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNewEmpresaNombre('');
      setNewEmpresaRuc('');
      notification.success(`Empresa "${created.nombre}" creada`);
    } catch (e) {
      notification.error('Error al crear empresa');
    }
    setCreatingEmpresa(false);
  };

  const handlePlacaEmpresaChange = (idx, empresaId) => {
    setNewPlacas(prev => prev.map((p, i) => i === idx ? { ...p, empresaId } : p));
  };

  const handleManualPlacaChange = (idx, field, value) => {
    setDocsManualPlaca(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const handleSavePlacas = async () => {
    const incomplete = newPlacas.filter(p => !p.empresaId);
    if (incomplete.length > 0) {
      notification.error(`Asigna una empresa a todas las placas (${incomplete.length} pendiente(s))`);
      return;
    }
    const incompleteManual = docsManualPlaca.filter(d => d.placa.trim() && !d.empresaId);
    if (incompleteManual.length > 0) {
      notification.error(`Asigna una empresa a las placas ingresadas manualmente (${incompleteManual.length} pendiente(s))`);
      return;
    }

    setSavingWizard(true);
    let saved = 0;
    for (const p of newPlacas) {
      try {
        await unidadService.create({ placa: p.placa, empresaId: Number(p.empresaId) });
        saved++;
      } catch (e) {
        console.error(`Error registrando placa ${p.placa}:`, e);
      }
    }

    // Guardar placas ingresadas manualmente y actualizar los documentos
    for (const doc of docsManualPlaca) {
      if (!doc.placa.trim() || !doc.empresaId) continue;
      const placaNorm = doc.placa.trim().toUpperCase();
      try {
        await unidadService.create({ placa: placaNorm, empresaId: Number(doc.empresaId) });
        saved++;
      } catch (e) {
        console.error(`Error registrando placa manual ${placaNorm}:`, e);
      }
      try {
        await documentService.update(doc.docId, { unidad: placaNorm });
      } catch (e) {
        console.error(`Error actualizando placa en doc ${doc.docId}:`, e);
      }
    }

    // Re-asociar documentos con las nuevas placas
    try {
      const reassocResult = await documentService.reassociate();
      console.log('Re-asociados:', reassocResult.updated);
    } catch (e) {
      console.error('Error re-asociando:', e);
    }

    notification.success(`${saved} placa(s) registrada(s) y documentos re-asociados`);
    setSavingWizard(false);
    setNewPlacas([]);
    setDocsManualPlaca([]);
    // Si hay tarifas faltantes, pasar al wizard de tarifas
    if (missingTariffs.length > 0) {
      setWizardStep('tarifas');
    } else {
      setWizardStep(null);
    }
  };

  const handleSkipWizard = () => {
    setNewPlacas([]);
    setDocsManualPlaca([]);
    // Si estamos en placas y hay tarifas pendientes, pasar a tarifas
    if (wizardStep === 'placas' && missingTariffs.length > 0) {
      setWizardStep('tarifas');
    } else {
      setWizardStep(null);
      setMissingTariffs([]);
    }
  };

  // === TARIFF WIZARD HANDLERS ===
  const handleTariffFieldChange = (idx, field, value) => {
    setMissingTariffs(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const handleSaveTariffs = async () => {
    const incomplete = missingTariffs.filter(t => !t.precioVentaSinIgv || !t.precioCostoSinIgv);
    if (incomplete.length > 0) {
      notification.error(`Completa los precios de todas las tarifas (${incomplete.length} pendiente(s))`);
      return;
    }
    const sinRuta = missingTariffs.filter(t => !t.cliente || !t.partida);
    if (sinRuta.length > 0) {
      notification.error(`Selecciona cliente y punto de partida en todos los documentos (${sinRuta.length} pendiente(s))`);
      return;
    }

    setSavingTariff(true);
    let saved = 0;
    for (const t of missingTariffs) {
      try {
        await clientTariffService.create({
          cliente: t.cliente,
          partida: t.partida,
          llegada: t.llegada,
          material: t.transportado,
          precioVentaSinIgv: Number(t.precioVentaSinIgv),
          precioCostoSinIgv: Number(t.precioCostoSinIgv),
          moneda: t.moneda,
          divisa: t.divisa,
        });
        saved++;

        // Actualizar campos de ruta en el documento si venían vacíos del PDF
        try {
          await documentService.update(t.docId, {
            cliente: t.cliente || null,
            partida: t.partida || null,
            llegada: t.llegada || null,
            transportado: t.transportado || null,
          });
        } catch (e) {
          console.error(`Error actualizando ruta en doc ${t.docId}:`, e);
        }

        // Recalcular campos financieros del documento
        try {
          await documentService.recalculate(t.docId);
        } catch (e) {
          console.error(`Error recalculando doc ${t.docId}:`, e);
        }
      } catch (e) {
        console.error(`Error creando tarifa para ${t.cliente}:`, e);
        notification.error(`Error al crear tarifa: ${t.cliente}`);
      }
    }

    if (saved > 0) {
      notification.success(`${saved} tarifa(s) creada(s) y documentos recalculados`);
    }
    setSavingTariff(false);
    setWizardStep(null);
    setMissingTariffs([]);
  };

  const handleSkipTariffWizard = () => {
    setWizardStep(null);
    setMissingTariffs([]);
  };

  const handleReset = () => {
    setFiles([]);
    setResults([]);
    setError('');
    setCurrentIndex(0);
    setWizardStep(null);
    setNewPlacas([]);
    setMissingTariffs([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="upload-page">
      <div className="upload-header">
        <img src={logoEmpresa} alt="Logo Empresa" className="page-logo" />
        <h1>Subir Guías de Remisión</h1>
        <p>Sube uno o varios archivos PDF y el sistema extraerá automáticamente los datos</p>
      </div>

      {results.length === 0 || loading ? (
        <div className="upload-container">
          <div
            className={`drop-zone ${dragActive ? 'active' : ''} ${files.length > 0 ? 'has-file' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !loading && fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.PDF,application/pdf"
              multiple
              hidden
            />
            
            {files.length > 0 ? (
              <div className="files-list">
                <div className="files-summary">
                  <span>📁 {files.length} archivo(s) seleccionado(s)</span>
                  <span className="files-total-size">{(totalSize / 1024 / 1024).toFixed(2)} MB total</span>
                </div>
                <div className="files-grid">
                  {files.map((f, idx) => (
                    <div key={idx} className="file-item">
                      <span className="file-item-icon">📄</span>
                      <span className="file-item-name" title={f.name}>
                        {f.name.length > 30 ? f.name.slice(0, 27) + '...' : f.name}
                      </span>
                      <span className="file-item-size">{(f.size / 1024).toFixed(0)} KB</span>
                      {!loading && (
                        <button
                          className="file-item-remove"
                          onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                          title="Quitar"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {!loading && (
                  <p className="drop-subtext">Haz clic para agregar más archivos</p>
                )}
              </div>
            ) : (
              <div className="drop-content">
                <div className="drop-icon">📂</div>
                <p className="drop-text">Arrastra y suelta tus PDFs aquí</p>
                <p className="drop-subtext">o haz clic para seleccionar (puedes elegir varios)</p>
              </div>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="upload-actions">
            {files.length > 0 && !loading && (
              <button onClick={handleReset} className="btn-secondary">
                Cancelar
              </button>
            )}
            <button
              onClick={handleUpload}
              className="btn-primary"
              disabled={files.length === 0 || loading}
            >
              {loading
                ? `Procesando ${currentIndex + 1} de ${files.length}...`
                : `Procesar ${files.length > 0 ? files.length + ' Documento(s)' : 'Documentos'}`}
            </button>
          </div>

          {loading && (
            <div className="processing-indicator">
              <div className="spinner"></div>
              <p>Procesando: {files[currentIndex]?.name}</p>
              <p className="processing-note">
                {currentIndex + 1} de {files.length} — {Math.round(((currentIndex) / files.length) * 100)}% completado
              </p>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${((currentIndex) / files.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="result-container">
          <div className="result-header">
            <div className="success-icon">✅</div>
            <h2>Procesamiento Completado</h2>
            <p>
              {results.filter((r) => r.success).length} exitoso(s), {results.filter((r) => !r.success).length} fallido(s) de {results.length} total
            </p>
          </div>

          <div className="results-list">
            {results.map((r, idx) => (
              <div key={idx} className={`result-item ${r.success ? 'result-success' : r.rejected ? 'result-warning' : 'result-error'}`}>
                <div className="result-item-status">
                  {r.success ? '✅' : r.rejected ? '⚠️' : '❌'}
                </div>
                <div className="result-item-info">
                  <span className="result-item-name">{r.file}</span>
                  {r.success ? (
                    <span className="result-item-detail">
                      GRT: {r.document?.grt || '-'} | Cliente: {r.document?.cliente || '-'} | TN: {r.document?.tn_enviado || '-'}
                    </span>
                  ) : r.rejected ? (
                    <span className="result-item-error" style={{ color: '#b45309' }}>{r.error}</span>
                  ) : (
                    <span className="result-item-error">{r.error}</span>
                  )}
                </div>
                {r.success && r.document?.id && (
                  <button
                    className="btn-small"
                    onClick={() => navigate(`/documents/${r.document.id}`)}
                  >
                    Ver
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="result-actions">
            <button onClick={handleReset} className="btn-secondary">
              Subir Más
            </button>
            <button onClick={() => navigate('/documents')} className="btn-primary">
              Ver Todos los Documentos
            </button>
          </div>

          {/* Wizard: Registrar placas nuevas */}
          {wizardStep === 'placas' && (
            <div className="wizard-overlay">
              <div className="wizard-modal">
                <div className="wizard-header">
                  <h2>🚛 Registro de Placas</h2>
                  <p>
                    {newPlacas.length > 0 && <span>Se detectaron <strong>{newPlacas.length}</strong> placa(s) nuevas. </span>}
                    {docsManualPlaca.length > 0 && <span>Hay <strong>{docsManualPlaca.length}</strong> guía(s) sin placa identificada. </span>}
                    Asigna cada placa a su empresa de transporte.
                  </p>
                </div>

                {/* Crear empresa rápido */}
                <div className="wizard-create-empresa">
                  <h3>¿La empresa no aparece? Créala aquí:</h3>
                  <div className="wizard-create-row">
                    <input
                      type="text"
                      placeholder="Nombre de la empresa"
                      value={newEmpresaNombre}
                      onChange={e => setNewEmpresaNombre(e.target.value)}
                      className="wizard-input"
                    />
                    <input
                      type="text"
                      placeholder="RUC (opcional)"
                      value={newEmpresaRuc}
                      onChange={e => setNewEmpresaRuc(e.target.value)}
                      className="wizard-input wizard-input-ruc"
                      maxLength={11}
                    />
                    <button
                      onClick={handleCreateEmpresa}
                      disabled={!newEmpresaNombre.trim() || creatingEmpresa}
                      className="btn-primary btn-small"
                    >
                      {creatingEmpresa ? '...' : '+ Crear'}
                    </button>
                  </div>
                </div>

                {/* Lista de placas */}
                <div className="wizard-placas-list">
                  {newPlacas.map((p, idx) => (
                    <div key={p.placa} className={`wizard-placa-row ${p.empresaId ? 'assigned' : ''}`}>
                      <span className="wizard-placa-badge">{p.placa}</span>
                      <select
                        value={p.empresaId}
                        onChange={e => handlePlacaEmpresaChange(idx, e.target.value)}
                        className="wizard-select"
                      >
                        <option value="">— Seleccionar empresa —</option>
                        {empresas.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                        ))}
                      </select>
                      {p.empresaId ? <span className="wizard-check">✓</span> : <span className="wizard-pending">⚠</span>}
                    </div>
                  ))}
                </div>

                {/* Guías sin placa detectada — usuario ingresa la placa manualmente */}
                {docsManualPlaca.length > 0 && (
                  <div className="wizard-manual-placas">
                    <h3>📝 Guías sin placa identificada</h3>
                    <p className="wizard-manual-desc">El sistema no pudo leer la placa en estas guías. Si la conoces, ingrésala ahora (opcional):</p>
                    {docsManualPlaca.map((doc, idx) => (
                      <div key={doc.docId} className={`wizard-placa-row ${doc.placa && doc.empresaId ? 'assigned' : ''}`}>
                        <span className="wizard-placa-badge wizard-placa-grt" title="GRT del documento">GRT: {doc.grt}</span>
                        <input
                          type="text"
                          placeholder="Ej: CBS886"
                          value={doc.placa}
                          onChange={e => handleManualPlacaChange(idx, 'placa', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                          className="wizard-input wizard-input-placa"
                          maxLength={6}
                        />
                        <select
                          value={doc.empresaId}
                          onChange={e => handleManualPlacaChange(idx, 'empresaId', e.target.value)}
                          className="wizard-select"
                          disabled={!doc.placa.trim()}
                        >
                          <option value="">— Seleccionar empresa —</option>
                          {empresas.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                          ))}
                        </select>
                        {doc.placa && doc.empresaId ? <span className="wizard-check">✓</span> : <span className="wizard-pending">⚠</span>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="wizard-progress">
                  {newPlacas.filter(p => p.empresaId).length + docsManualPlaca.filter(d => d.placa.trim() && d.empresaId).length} placa(s) completadas
                </div>

                <div className="wizard-actions">
                  <button onClick={handleSkipWizard} className="btn-secondary">
                    Omitir (registrar después)
                  </button>
                  <button
                    onClick={handleSavePlacas}
                    disabled={savingWizard}
                    className="btn-primary"
                  >
                    {savingWizard ? 'Guardando...' : `Registrar ${newPlacas.length + docsManualPlaca.filter(d => d.placa.trim() && d.empresaId).length} Placa(s)`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Wizard: Tarifas no encontradas */}
          {wizardStep === 'tarifas' && (
            <div className="wizard-overlay">
              <div className="wizard-modal wizard-modal-wide">
                <div className="wizard-header">
                  <h2>💰 Tarifas No Encontradas</h2>
                  <p>
                    Se detectaron <strong>{missingTariffs.length}</strong> documento(s) que requieren atención.
                    {' '}Corrige los campos resaltados y completa los precios para registrar las tarifas.
                  </p>
                </div>

                <div className="wizard-tariff-list">
                  {missingTariffs.map((t, idx) => {
                    const opts = getFilteredOptions(t);
                    return (
                    <div key={idx} className="wizard-tariff-card">
                      {t.motivo && (
                        <div className={`wizard-tariff-motivo ${
                          t.motivo === 'Sin tarifa registrada para esta ruta' ? 'motivo-sin-tarifa' : 'motivo-sin-datos'
                        }`}>
                          ⚠️ {t.motivo}
                        </div>
                      )}
                      <div className="wizard-tariff-info">
                        {/* Cliente: editable siempre (select si hay catalogo, sino input) */}
                        <div className="wizard-tariff-field">
                          <label className="wizard-tariff-label">Cliente:</label>
                          {opts.clientes.length > 0 ? (
                            <select
                              value={t.cliente || ''}
                              onChange={e => handleTariffFieldChange(idx, 'cliente', e.target.value)}
                              className={`wizard-select wizard-select-route ${!t.cliente ? 'wizard-field-empty' : ''}`}
                            >
                              <option value="">-- Seleccionar cliente --</option>
                              {opts.clientes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <input type="text" value={t.cliente || ''} onChange={e => handleTariffFieldChange(idx, 'cliente', e.target.value)} className="wizard-input" placeholder="Nombre cliente" />
                          )}
                          {!t.cliente && <span className="wizard-field-required">Requerido</span>}
                        </div>
                        {/* Partida: editable siempre */}
                        <div className="wizard-tariff-field">
                          <label className="wizard-tariff-label">Partida:</label>
                          {opts.partidas.length > 0 ? (
                            <select
                              value={t.partida || ''}
                              onChange={e => handleTariffFieldChange(idx, 'partida', e.target.value)}
                              className={`wizard-select wizard-select-route ${!t.partida ? 'wizard-field-empty' : ''}`}
                            >
                              <option value="">-- Seleccionar partida --</option>
                              {opts.partidas.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          ) : (
                            <input type="text" value={t.partida || ''} onChange={e => handleTariffFieldChange(idx, 'partida', e.target.value)} className="wizard-input" placeholder="REGION-PROVINCIA-DISTRITO" />
                          )}
                          {!t.partida && <span className="wizard-field-required">Requerido</span>}
                        </div>
                        {/* Llegada: editable siempre */}
                        <div className="wizard-tariff-field">
                          <label className="wizard-tariff-label">Llegada:</label>
                          {opts.llegadas.length > 0 ? (
                            <select
                              value={t.llegada || ''}
                              onChange={e => handleTariffFieldChange(idx, 'llegada', e.target.value)}
                              className="wizard-select wizard-select-route"
                            >
                              <option value="">-- Seleccionar llegada --</option>
                              {opts.llegadas.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                          ) : (
                            <input type="text" value={t.llegada || ''} onChange={e => handleTariffFieldChange(idx, 'llegada', e.target.value)} className="wizard-input" placeholder="REGION-PROVINCIA-DISTRITO" />
                          )}
                        </div>
                        {/* Material: editable siempre */}
                        <div className="wizard-tariff-field">
                          <label className="wizard-tariff-label">Material:</label>
                          {opts.materiales.length > 0 ? (
                            <select
                              value={t.transportado || ''}
                              onChange={e => handleTariffFieldChange(idx, 'transportado', e.target.value)}
                              className="wizard-select wizard-select-route"
                            >
                              <option value="">-- Seleccionar material --</option>
                              {opts.materiales.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          ) : (
                            <input type="text" value={t.transportado || ''} onChange={e => handleTariffFieldChange(idx, 'transportado', e.target.value)} className="wizard-input" placeholder="CONCENTRADO DE ZN..." />
                          )}
                        </div>
                      </div>
                      <div className="wizard-tariff-prices">
                        <div className="wizard-tariff-price-row">
                          <label>Precio Venta (sin IGV):</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={t.precioVentaSinIgv}
                            onChange={e => handleTariffFieldChange(idx, 'precioVentaSinIgv', e.target.value)}
                            className="wizard-input wizard-input-price"
                          />
                        </div>
                        <div className="wizard-tariff-price-row">
                          <label>Precio Costo (sin IGV):</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={t.precioCostoSinIgv}
                            onChange={e => handleTariffFieldChange(idx, 'precioCostoSinIgv', e.target.value)}
                            className="wizard-input wizard-input-price"
                          />
                        </div>
                        <div className="wizard-tariff-price-row">
                          <label>Moneda Venta:</label>
                          <select
                            value={t.moneda}
                            onChange={e => handleTariffFieldChange(idx, 'moneda', e.target.value)}
                            className="wizard-select wizard-select-small"
                          >
                            <option value="USD">USD</option>
                            <option value="PEN">PEN</option>
                          </select>
                        </div>
                        <div className="wizard-tariff-price-row">
                          <label>Moneda Costo:</label>
                          <select
                            value={t.divisa}
                            onChange={e => handleTariffFieldChange(idx, 'divisa', e.target.value)}
                            className="wizard-select wizard-select-small"
                          >
                            <option value="USD">USD</option>
                            <option value="PEN">PEN</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>

                <div className="wizard-actions">
                  <button onClick={handleSkipTariffWizard} className="btn-secondary">
                    Omitir (crear después)
                  </button>
                  <button
                    onClick={handleSaveTariffs}
                    disabled={savingTariff}
                    className="btn-primary"
                  >
                    {savingTariff ? 'Guardando...' : `Crear ${missingTariffs.length} Tarifa(s)`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Upload;
