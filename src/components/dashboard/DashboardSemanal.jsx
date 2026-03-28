import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService } from '../../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
  LineChart, Line, Cell
} from 'recharts';
import { useIsMobile } from '../../hooks/useIsMobile';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import logoEmpresa from '../../assets/Images/logo-empresa.png';

const fmtNum = (n) => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toTitleCase = (text) => {
  if (!text) return '';
  return String(text)
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

const CHART_COLORS = [
  '#1B7430', '#4A86B8', '#E8913A', '#8E6BAD',
  '#5BA3C9', '#C4883A', '#9E6575', '#6882A8',
  '#3A9E9E', '#B87840'
];


import './DashboardComponents.css';

const Modal = ({ title, items, onClose }) => (
  <div className="dm-overlay" onClick={onClose}>
    <div className="dm-content" onClick={e => e.stopPropagation()}>
      <div className="dm-header">
        <h3>{title}</h3>
        <button className="dm-close" onClick={onClose}>×</button>
      </div>
      <div className="dm-body">
        {items.length === 0 ? (
          <p className="empty-message">No hay documentos para mostrar</p>
        ) : (
          <table className="dm-table">
            <thead>
              <tr>
                <th>GRT</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Unidad</th>
                <th>Ticket</th>
                <th>Peso Ticket (TN Recibida)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(doc => (
                <tr key={doc.id}>
                  <td className="dm-code">{doc.grt || '-'}</td>
                  <td>{doc.fecha || '-'}</td>
                  <td>{doc.cliente || '-'}</td>
                  <td>{doc.unidad || '-'}</td>
                  <td className="dm-code">{doc.ticket || '-'}</td>
                  <td>{doc.tn_recibida ? fmtNum(doc.tn_recibida) : '-'}</td>
                  <td>
                    <Link to={`/documents/${doc.id}/edit`} className="btn-action btn-edit" onClick={onClose}>
                      🔒 Ticket
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  </div>
);

const DashboardSemanal = ({ filters: globalFilters }) => {
  const isMobile = useIsMobile();
  const contentRef = useRef(null);
  const pesoSemanaRef = useRef(null);
  const pesoConcentradoRef = useRef(null);
  const [tnEnviadoPorSemana, setTnEnviadoPorSemana] = useState([]);
  const [tnRecibidoPorSemana, setTnRecibidoPorSemana] = useState([]);
  const [tnRecibidoPorConcentrado, setTnRecibidoPorConcentrado] = useState([]);
  const [guiasPorVerificar, setGuiasPorVerificar] = useState(0);
  const [modal, setModal] = useState(null); // { title, items }
  const [loadingModal, setLoadingModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingSemanaPdf, setExportingSemanaPdf] = useState(false);
  const [exportingConcentradoPdf, setExportingConcentradoPdf] = useState(false);
  const [localFilters, setLocalFilters] = useState({ mes: '', transportado: '', cliente: '' });

  const descargarPDF = async () => {
    if (!contentRef.current) return;
    setExportingPdf(true);
    try {
      await exportVisualPdfFromSections({
        rootElement: contentRef.current,
        sectionSelector: '.chart-section',
        fileName: 'Variacion_TN.pdf',
        title: 'Variacion TN Semanal',
        subtitle: getSubtitle(),
      });
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  const descargarSemanaPDF = async () => {
    if (!pesoSemanaRef.current) return;
    setExportingSemanaPdf(true);
    try {
      await exportVisualPdfFromElement({
        element: pesoSemanaRef.current,
        fileName: 'Peso_Ticket_por_Semana.pdf',
        title: 'Peso Ticket por Semana',
        subtitle: getSubtitle(),
      });
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setExportingSemanaPdf(false);
    }
  };
  const descargarConcentradoPDF = async () => {
    if (!pesoConcentradoRef.current) return;
    setExportingConcentradoPdf(true);
    try {
      await exportVisualPdfFromElement({
        element: pesoConcentradoRef.current,
        fileName: 'Peso_Ticket_por_Concentrado.pdf',
        title: 'Peso Ticket por Tipo de Concentrado',
        subtitle: getSubtitle(),
      });
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setExportingConcentradoPdf(false);
    }
  };
  
  // Opciones para los filtros
  const [segmentadores, setSegmentadores] = useState({
    meses: [],
    transportados: [],
    clientes: []
  });
  const [filtersLoading, setFiltersLoading] = useState(false);

  const loadImageAsDataUrl = async (src) => {
    const response = await fetch(src);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const getSubtitle = () => {
    const capitalizeText = (text) => {
      if (!text) return '';
      return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    const filterParts = [];
    if (localFilters.mes) filterParts.push(capitalizeText(localFilters.mes));
    if (localFilters.transportado) filterParts.push(capitalizeText(localFilters.transportado));
    if (localFilters.cliente) filterParts.push(capitalizeText(localFilters.cliente));
    return filterParts.length > 0 ? filterParts.join(' - ') : 'General';
  };

  const captureElementWithoutButtons = async (element) => {
    const clone = element.cloneNode(true);
    clone.querySelectorAll('button, .pdf-btn-wrapper').forEach((btn) => btn.remove());

    clone.style.position = 'fixed';
    clone.style.left = '-10000px';
    clone.style.top = '0';
    clone.style.width = `${Math.max(element.scrollWidth, element.offsetWidth)}px`;
    clone.style.background = '#ffffff';
    clone.style.padding = '16px';
    clone.style.boxSizing = 'border-box';
    clone.style.zIndex = '-1';

    document.body.appendChild(clone);
    try {
      return await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight,
      });
    } finally {
      document.body.removeChild(clone);
    }
  };

  const addHeader = (pdf, title, subtitle, logoDataUrl) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const marginX = 24;

    if (logoDataUrl) {
      pdf.addImage(logoDataUrl, 'PNG', marginX, 16, 50, 28);
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(27, 116, 48);
    pdf.setFontSize(18);
    pdf.text(title, pageWidth / 2, 28, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(70, 70, 70);
    pdf.setFontSize(10.5);
    pdf.text(subtitle, pageWidth / 2, 43, { align: 'center' });
    pdf.text(`Generado: ${new Date().toLocaleString('es-PE')}`, pageWidth - marginX, 18, { align: 'right' });

    pdf.setDrawColor(27, 116, 48);
    pdf.setLineWidth(1.1);
    pdf.line(marginX, 52, pageWidth - marginX, 52);
    return 60;
  };

  const exportVisualPdfFromElement = async ({ element, fileName, title, subtitle }) => {
    const canvas = await captureElementWithoutButtons(element);
    const imgData = canvas.toDataURL('image/png');
    const logoDataUrl = await loadImageAsDataUrl(logoEmpresa).catch(() => null);

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 24;
    const headerBottomY = addHeader(pdf, title, subtitle, logoDataUrl);
    const availableWidth = pageWidth - marginX * 2;
    const scaledImgHeight = (canvas.height * availableWidth) / canvas.width;

    let remainingHeight = scaledImgHeight;
    let sourceY = 0;
    const pageContentHeight = pageHeight - headerBottomY - 16;
    const sourceSliceHeight = (pageContentHeight * canvas.width) / availableWidth;

    while (remainingHeight > 0) {
      const currentSliceHeight = Math.min(sourceSliceHeight, canvas.height - sourceY);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = currentSliceHeight;
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, sourceY, canvas.width, currentSliceHeight, 0, 0, canvas.width, currentSliceHeight);

      const sliceData = sliceCanvas.toDataURL('image/png');
      const sliceRenderHeight = (currentSliceHeight * availableWidth) / canvas.width;
      pdf.addImage(sliceData, 'PNG', marginX, headerBottomY, availableWidth, sliceRenderHeight);

      sourceY += currentSliceHeight;
      remainingHeight -= sliceRenderHeight;

      if (sourceY < canvas.height) {
        pdf.addPage();
        addHeader(pdf, title, subtitle, logoDataUrl);
      }
    }

    pdf.save(fileName);
  };

  const exportVisualPdfFromSections = async ({
    rootElement,
    sectionSelector,
    fileName,
    title,
    subtitle,
  }) => {
    const cloneRoot = rootElement.cloneNode(true);
    cloneRoot.querySelectorAll('button, .pdf-btn-wrapper').forEach((btn) => btn.remove());

    cloneRoot.style.position = 'fixed';
    cloneRoot.style.left = '-10000px';
    cloneRoot.style.top = '0';
    cloneRoot.style.width = `${Math.max(rootElement.scrollWidth, rootElement.offsetWidth)}px`;
    cloneRoot.style.background = '#ffffff';
    cloneRoot.style.padding = '16px';
    cloneRoot.style.boxSizing = 'border-box';
    cloneRoot.style.zIndex = '-1';

    document.body.appendChild(cloneRoot);

    try {
      const sectionNodes = Array.from(cloneRoot.querySelectorAll(sectionSelector));
      const sectionCanvases = [];

      for (const section of sectionNodes) {
        const canvas = await html2canvas(section, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          windowWidth: cloneRoot.scrollWidth,
          windowHeight: section.scrollHeight,
        });
        sectionCanvases.push(canvas);
      }

      const logoDataUrl = await loadImageAsDataUrl(logoEmpresa).catch(() => null);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 24;
      const headerBottomY = addHeader(pdf, title, subtitle, logoDataUrl);
      const availableWidth = pageWidth - marginX * 2;
      const pageContentHeight = pageHeight - headerBottomY - 16;
      const sectionGap = 12;
      const naturalSizes = sectionCanvases.map((canvas) => {
        const width = availableWidth;
        const height = (canvas.height * width) / canvas.width;
        return { width, height };
      });

      const totalNaturalHeight = naturalSizes.reduce((sum, size) => sum + size.height, 0);
      const totalGaps = Math.max(0, sectionCanvases.length - 1) * sectionGap;
      const availableHeightForCharts = Math.max(1, pageContentHeight - totalGaps);
      const fitScale = totalNaturalHeight > availableHeightForCharts
        ? (availableHeightForCharts / totalNaturalHeight)
        : 1;

      let y = headerBottomY;

      for (let i = 0; i < sectionCanvases.length; i++) {
        const canvas = sectionCanvases[i];
        const imgData = canvas.toDataURL('image/png');

        const renderWidth = naturalSizes[i].width * fitScale;
        const renderHeight = naturalSizes[i].height * fitScale;
        const x = marginX + (availableWidth - renderWidth) / 2;

        if (y + renderHeight > pageHeight - 16) {
          pdf.addPage();
          y = addHeader(pdf, title, subtitle, logoDataUrl);
        }

        pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
        y += renderHeight + sectionGap;
      }

      pdf.save(fileName);
    } finally {
      document.body.removeChild(cloneRoot);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const data = await dashboardService.getSegmentadoresFiltrados({});
        setSegmentadores({
          meses: data.meses || [],
          transportados: data.transportados || [],
          clientes: data.clientes || []
        });
      } catch (error) {
        console.error('Error cargando segmentadores:', error);
      }
    };
    init();
  }, []);

  useEffect(() => {
    loadData();
  }, [localFilters]);

  const handleLocalFilterChange = async (key, value) => {
    const newFilters = { ...localFilters };
    newFilters[key] = value;

    setFiltersLoading(true);
    try {
      const activeForCascade = {};
      if (newFilters.mes) activeForCascade.mes = newFilters.mes;
      if (newFilters.transportado) activeForCascade.transportado = newFilters.transportado;
      if (newFilters.cliente) activeForCascade.cliente = newFilters.cliente;

      const newSeg = await dashboardService.getSegmentadoresFiltrados(activeForCascade);

      // Resetear filtros cuyo valor actual ya no esté disponible
      if (newFilters.mes && !newSeg.meses.includes(newFilters.mes)) newFilters.mes = '';
      if (newFilters.transportado && !newSeg.transportados.includes(newFilters.transportado)) newFilters.transportado = '';
      if (newFilters.cliente && !newSeg.clientes.includes(newFilters.cliente)) newFilters.cliente = '';

      setSegmentadores({
        meses: newSeg.meses || [],
        transportados: newSeg.transportados || [],
        clientes: newSeg.clientes || []
      });
      setLocalFilters(newFilters);
    } catch (error) {
      console.error('Error actualizando filtros en cascada:', error);
      setLocalFilters(newFilters);
    } finally {
      setFiltersLoading(false);
    }
  };

  const clearLocalFilters = async () => {
    setFiltersLoading(true);
    try {
      const data = await dashboardService.getSegmentadoresFiltrados({});
      setSegmentadores({
        meses: data.meses || [],
        transportados: data.transportados || [],
        clientes: data.clientes || []
      });
    } catch (error) {
      console.error('Error limpiando filtros:', error);
    } finally {
      setFiltersLoading(false);
    }
    setLocalFilters({ mes: '', transportado: '', cliente: '' });
  };

  const openGuiasModal = async () => {
    setLoadingModal(true);
    setModal({ title: 'Guías por verificar', items: [] });
    try {
      const activeFilters = getActiveFilters();
      const items = await dashboardService.getGuiasPorVerificarList(activeFilters);
      setModal({ title: 'Guías por verificar', items: items || [] });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingModal(false);
    }
  };

  // Combinar filtros locales (solo los que tienen valor)
  const getActiveFilters = () => {
    const filters = {};
    if (localFilters.mes) filters.mes = localFilters.mes;
    if (localFilters.transportado) filters.transportado = localFilters.transportado;
    if (localFilters.cliente) filters.cliente = localFilters.cliente;
    return filters;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const activeFilters = getActiveFilters();
      const [enviado, recibido, concentradoRecibido, guiasRes] = await Promise.all([
        dashboardService.getTnEnviadoPorSemana(activeFilters),
        dashboardService.getTnRecibidoPorSemana(activeFilters),
        dashboardService.getTnRecibidoPorConcentrado(activeFilters),
        dashboardService.getGuiasPorVerificarCount(activeFilters),
      ]);
      // Parsear valores a números
      setTnEnviadoPorSemana((enviado || []).map(item => ({
        ...item,
        total: parseFloat(item.total) || 0
      })));
      setTnRecibidoPorSemana((recibido || []).map(item => ({
        ...item,
        total: parseFloat(item.total) || 0
      })));
      setTnRecibidoPorConcentrado((concentradoRecibido || []).map(item => ({
        ...item,
        total: parseFloat(item.total) || 0
      })));
      setGuiasPorVerificar(guiasRes?.count || 0);
    } catch (error) {
      console.error('Error cargando datos semanales:', error);
    } finally {
      setLoading(false);
    }
  };

  // Combinar datos semanales para gráfico comparativo
  const datosComparativos = tnEnviadoPorSemana.map((item, index) => ({
    semana: item.semana,
    tn_enviado: parseFloat(item.total) || 0,
    tn_recibido: parseFloat(tnRecibidoPorSemana[index]?.total) || 0,
  }));

  return (
    <div className="dashboard-semanal">
      <div className="pdf-btn-wrapper">
        <button className="btn-download-pdf" onClick={descargarPDF} disabled={exportingPdf}>
          {exportingPdf ? 'Generando...' : '📥 Descargar PDF'}
        </button>
      </div>
      {modal && (
        <Modal
          title={loadingModal ? 'Cargando...' : modal.title}
          items={modal.items}
          onClose={() => setModal(null)}
        />
      )}

      {/* Indicadores de verificación */}
      <div className="verificacion-indicators">
        <div className="verificacion-card warning clickable" onClick={openGuiasModal} title="Ver detalle">
          <div className="verificacion-icon">📝</div>
          <div className="verificacion-content">
            <span className="verificacion-value">{guiasPorVerificar}</span>
            <span className="verificacion-label">Guías por verificar</span>
          </div>
          <span className="card-arrow">→</span>
        </div>

      </div>

      {/* Filtros exclusivos de esta sección */}
      <div className="section-filters">
        <div className="filter-row">
          <div className="filter-item">
            <label>Mes</label>
            <select
              value={localFilters.mes}
              onChange={(e) => handleLocalFilterChange('mes', e.target.value)}
              disabled={filtersLoading}
            >
              <option value="">Todos</option>
              {segmentadores.meses.map(mes => (
                <option key={mes} value={mes}>{toTitleCase(mes)}</option>
              ))}
            </select>
          </div>

          <div className="filter-item">
            <label>Transportado</label>
            <select
              value={localFilters.transportado}
              onChange={(e) => handleLocalFilterChange('transportado', e.target.value)}
              disabled={filtersLoading}
            >
              <option value="">Todos</option>
              {segmentadores.transportados.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="filter-item">
            <label>Cliente</label>
            <select
              value={localFilters.cliente}
              onChange={(e) => handleLocalFilterChange('cliente', e.target.value)}
              disabled={filtersLoading}
            >
              <option value="">Todos</option>
              {segmentadores.clientes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <button className="btn-clear-local" onClick={clearLocalFilters} disabled={filtersLoading}>
            {filtersLoading ? '...' : 'Limpiar'}
          </button>
        </div>
      </div>

      <div ref={contentRef}>
      {loading ? (
        <div className="loading-section"><div className="spinner"></div></div>
      ) : (
        <>
          {/* Gráfico TN Recibido por Semana */}
          <div className="chart-section" ref={pesoSemanaRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2>📦 Peso Ticket por Semana</h2>
          <button className="download-btn" onClick={descargarSemanaPDF} disabled={exportingSemanaPdf || tnRecibidoPorSemana.length === 0} style={{ fontSize: 13, padding: '6px 14px' }}>
            {exportingSemanaPdf ? 'Generando...' : '📥 Descargar PDF'}
          </button>
        </div>
        <div className="chart-container">
          {tnRecibidoPorSemana.length === 0 ? (
            <p className="empty-message">No hay datos para mostrar</p>
          ) : (
            <ResponsiveContainer width="100%" height={isMobile ? 250 : 320}>
              <BarChart data={tnRecibidoPorSemana} margin={{ top: 30, right: isMobile ? 10 : 20, left: 0, bottom: isMobile ? 10 : 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="semana"
                  tick={{ fontSize: isMobile ? 10 : 12, fill: '#555' }}
                  interval={0}
                />
                <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 35 : 60} />
                <Tooltip formatter={(value) => [`${fmtNum(value)} TN`, 'Peso Ticket']} contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' }} />
                {!isMobile && <Legend />}
                <Bar dataKey="total" name="Peso Ticket" radius={[4, 4, 0, 0]}>
                  {tnRecibidoPorSemana.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeOpacity={0.3} />
                  ))}
                  <LabelList dataKey="total" position="top" formatter={(v) => `${fmtNum(v)} TN`} style={{ fontSize: isMobile ? 9 : 11, fill: '#1B7430', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* TN Recibido por Tipo de Concentrado */}
      <div className="chart-section" ref={pesoConcentradoRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2>⛏️ Peso Ticket por Tipo de Concentrado</h2>
          <button className="download-btn" onClick={descargarConcentradoPDF} disabled={exportingConcentradoPdf || tnRecibidoPorConcentrado.length === 0} style={{ fontSize: 13, padding: '6px 14px' }}>
            {exportingConcentradoPdf ? 'Generando...' : '📥 Descargar PDF'}
          </button>
        </div>
        <div className="chart-container">
          {tnRecibidoPorConcentrado.length === 0 ? (
            <p className="empty-message">No hay datos para mostrar</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(150, tnRecibidoPorConcentrado.length * (isMobile ? 40 : 45))}>
              <BarChart
                data={tnRecibidoPorConcentrado}
                layout="vertical"
                margin={{ top: 10, right: isMobile ? 45 : 70, left: isMobile ? 5 : 10, bottom: 10 }}
                barSize={isMobile ? 20 : 25}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis type="number" tick={{ fontSize: isMobile ? 9 : 11 }} />
                <YAxis 
                  dataKey="tipo_concentrado" 
                  type="category" 
                  width={isMobile ? 70 : 120}
                  tick={{ fontSize: isMobile ? 9 : 11, fill: '#333' }}
                  tickMargin={isMobile ? 4 : 8}
                />
                <Tooltip formatter={(value) => [`${fmtNum(value)} TN`, 'Peso Ticket']} contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' }} />
                <Bar dataKey="total" name="Peso Ticket" radius={[0, 6, 6, 0]}>
                  {tnRecibidoPorConcentrado.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeOpacity={0.3} />
                  ))}
                  <LabelList dataKey="total" position="right" formatter={(v) => `${fmtNum(v)} TN`} style={{ fontSize: isMobile ? 9 : 11, fill: '#333', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
        </>
      )}
      </div>
    </div>
  );
};

export default DashboardSemanal;
