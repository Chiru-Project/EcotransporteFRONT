import { useState, useEffect, useRef } from 'react';
import { dashboardService } from '../../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, Cell
} from 'recharts';
import { useIsMobile } from '../../hooks/useIsMobile';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import logoEmpresa from '../../assets/Images/logo-empresa.png';
import './DashboardComponents.css';

const fmtNum = (n) => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FILTER_FIELDS = ['mes', 'semana', 'cliente', 'transportista', 'unidad', 'transportado'];
const toTitleCase = (text) => {
  if (!text) return '';
  return String(text)
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

const DashboardResumen = () => {
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const resumenRef = useRef(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [segmentadores, setSegmentadores] = useState({
    meses: [],
    semanas: [],
    clientes: [],
    transportistas: [],
    unidades: [],
    transportados: [],
  });

  // Mapa de campo → array de opciones en segmentadores
  const fieldToOptions = {
    mes: segmentadores.meses,
    semana: segmentadores.semanas,
    cliente: segmentadores.clientes,
    transportista: segmentadores.transportistas,
    unidad: segmentadores.unidades,
    transportado: segmentadores.transportados,
  };

  // Carga inicial: todas las opciones sin filtro
  useEffect(() => {
    const init = async () => {
      try {
        const seg = await dashboardService.getSegmentadoresFiltrados({});
        setSegmentadores(seg);
      } catch (error) {
        console.error('Error cargando segmentadores:', error);
      }
    };
    init();
  }, []);

  // Cada vez que cambian los filtros, recarga los datos del dashboard
  useEffect(() => {
    loadData();
  }, [filters]);

  /**
   * Maneja el cambio de un filtro:
   * 1. Actualiza el filtro cambiado
   * 2. Pide al backend las opciones válidas con los nuevos filtros
   * 3. Resetea cualquier filtro cuyo valor actual ya no esté disponible (conflicto)
   */
  const handleFilterChange = async (key, value) => {
    const newFilters = { ...filters };
    if (value === '') {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }

    setFiltersLoading(true);
    try {
      const newSeg = await dashboardService.getSegmentadoresFiltrados(newFilters);

      const newFieldToOptions = {
        mes: newSeg.meses,
        semana: newSeg.semanas,
        cliente: newSeg.clientes,
        transportista: newSeg.transportistas,
        unidad: newSeg.unidades,
        transportado: newSeg.transportados,
      };

      // Resetear filtros que ya no tienen valor válido en las nuevas opciones
      const validatedFilters = { ...newFilters };
      for (const field of FILTER_FIELDS) {
        if (field !== key && validatedFilters[field]) {
          if (!newFieldToOptions[field].includes(validatedFilters[field])) {
            delete validatedFilters[field];
          }
        }
      }

      setSegmentadores(newSeg);
      setFilters(validatedFilters);
    } catch (error) {
      console.error('Error actualizando filtros en cascada:', error);
      setFilters(newFilters);
    } finally {
      setFiltersLoading(false);
    }
  };

  const clearFilters = async () => {
    setFiltersLoading(true);
    try {
      const seg = await dashboardService.getSegmentadoresFiltrados({});
      setSegmentadores(seg);
    } catch (error) {
      console.error('Error limpiando filtros:', error);
    } finally {
      setFiltersLoading(false);
    }
    setFilters({});
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const resumen = await dashboardService.getResumen(filters);
      setData(resumen);
    } catch (error) {
      console.error('Error cargando resumen:', error);
    } finally {
      setLoading(false);
    }
  };

  const descargarResumenPDF = async () => {
    if (!resumenRef.current) return;
    setExportingPdf(true);
    try {
      const loadImageAsDataUrl = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          if (!ctx) return reject(new Error('No se pudo obtener contexto del canvas'));
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = src;
      });

      const addPdfHeader = (pdf, title, subtitle, logoDataUrl) => {
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 24;

        pdf.setFillColor(247, 250, 247);
        pdf.rect(0, 0, pageWidth, 76, 'F');

        if (logoDataUrl) {
          pdf.addImage(logoDataUrl, 'PNG', margin, 10, 56, 56);
        }

        pdf.setTextColor(27, 116, 48);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.text(title, logoDataUrl ? margin + 66 : margin, 30);

        pdf.setTextColor(70, 70, 70);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        if (subtitle) {
          const safeSubtitle = pdf.splitTextToSize(subtitle, pageWidth - (logoDataUrl ? margin + 66 : margin) - margin);
          pdf.text(safeSubtitle, logoDataUrl ? margin + 66 : margin, 46);
        }

        const fecha = new Date().toLocaleString();
        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(9);
        pdf.text(fecha, pageWidth - margin, 24, { align: 'right' });

        pdf.setDrawColor(27, 116, 48);
        pdf.setLineWidth(1.2);
        pdf.line(margin, 74, pageWidth - margin, 74);

        return 82;
      };

      const capitalizeText = (text) => {
        if (!text) return '';
        return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      };
      const filterParts = [];
      if (filters.mes) filterParts.push(capitalizeText(filters.mes));
      if (filters.semana) filterParts.push(capitalizeText(filters.semana));
      if (filters.cliente) filterParts.push(capitalizeText(filters.cliente));
      if (filters.transportista) filterParts.push(capitalizeText(filters.transportista));
      if (filters.unidad) filterParts.push(filters.unidad.toUpperCase());
      if (filters.transportado) filterParts.push(capitalizeText(filters.transportado));
      const subtitle = filterParts.length > 0 ? filterParts.join(' — ') : 'General';

      const canvas = await html2canvas(resumenRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: -window.scrollY,
      });

      const logoDataUrl = await loadImageAsDataUrl(logoEmpresa).catch(() => null);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 24;
      const contentTop = addPdfHeader(pdf, 'Control de Peso', subtitle, logoDataUrl);
      const maxWidth = pageWidth - marginX * 2;
      const maxHeight = pageHeight - contentTop - 18;
      const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
      const renderWidth = canvas.width * ratio;
      const renderHeight = canvas.height * ratio;
      const imgData = canvas.toDataURL('image/png');

      pdf.addImage(imgData, 'PNG', (pageWidth - renderWidth) / 2, contentTop, renderWidth, renderHeight);
      pdf.save('Control_Peso.pdf');
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return <div className="loading-section"><div className="spinner"></div></div>;
  }

  if (!data) {
    return <div className="empty-section">No hay datos disponibles</div>;
  }

  return (
    <div className="dashboard-resumen">
      {/* Filtros */}
      <div className="section-filters">
        <div className="filter-row">
          <div className="filter-item">
            <label>Mes</label>
            <select
              value={filters.mes || ''}
              onChange={(e) => handleFilterChange('mes', e.target.value)}
              disabled={filtersLoading}
            >
              <option value="">Todos</option>
              {segmentadores.meses.map(mes => <option key={mes} value={mes}>{toTitleCase(mes)}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label>Semana</label>
            <select
              value={filters.semana || ''}
              onChange={(e) => handleFilterChange('semana', e.target.value)}
              disabled={filtersLoading}
            >
              <option value="">Todas</option>
              {segmentadores.semanas.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label>Cliente</label>
            <select
              value={filters.cliente || ''}
              onChange={(e) => handleFilterChange('cliente', e.target.value)}
              disabled={filtersLoading}
            >
              <option value="">Todos</option>
              {segmentadores.clientes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label>Transportista</label>
            <select
              value={filters.transportista || ''}
              onChange={(e) => handleFilterChange('transportista', e.target.value)}
              disabled={filtersLoading}
            >
              <option value="">Todos</option>
              {segmentadores.transportistas.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label>Unidad</label>
            <select
              value={filters.unidad || ''}
              onChange={(e) => handleFilterChange('unidad', e.target.value)}
              disabled={filtersLoading}
            >
              <option value="">Todas</option>
              {segmentadores.unidades.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label>Transportado</label>
            <select
              value={filters.transportado || ''}
              onChange={(e) => handleFilterChange('transportado', e.target.value)}
              disabled={filtersLoading}
            >
              <option value="">Todos</option>
              {segmentadores.transportados.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button className="btn-clear-local" onClick={clearFilters} disabled={filtersLoading}>
            {filtersLoading ? '...' : 'Limpiar filtros'}
          </button>
          <button
            className="btn-clear-local"
            onClick={descargarResumenPDF}
            disabled={exportingPdf}
            style={{ marginLeft: 'auto', background: '#1B7430', color: '#fff', border: 'none' }}
          >
            {exportingPdf ? 'Generando...' : '\uD83D\uDCE5 Descargar PDF'}
          </button>
        </div>
      </div>

      {/* Contenido capturado para PDF */}
      <div ref={resumenRef}>
      {/* Indicadores principales */}
      <div className="indicators-grid">
        <div className="indicator-card">
          <div className="indicator-icon">🚛</div>
          <div className="indicator-content">
            <h3>Traslados</h3>
            <p className="indicator-value">{data.indicadores.traslados}</p>
            <span className="indicator-label">Total de documentos</span>
          </div>
        </div>

        <div className="indicator-card">
          <div className="indicator-icon">⛏️</div>
          <div className="indicator-content">
            <h3>Peso Ticket (TN Recibida) - Filtrado</h3>
            <p className="indicator-value">{data.indicadores.tnRecibidaFiltrado ? fmtNum(data.indicadores.tnRecibidaFiltrado) : '0.00'}</p>
            <span className="indicator-label">Con filtros aplicados</span>
          </div>
        </div>
      </div>

      {/* Control de Peso */}
      <div className="section-card">
        <h2>⚖️ Control de Peso</h2>
        <div className="control-peso-grid">
          <div className="peso-item">
            <label>Peso Guía (TN Enviado)</label>
            <span className="peso-value enviado">
              {data.controlPeso.tn_enviado_total > 0
                ? fmtNum(data.controlPeso.tn_enviado_total)
                : 'Pendiente'}
            </span>
          </div>
          <div className="peso-item">
            <label>Peso Ticket (TN Recibido)</label>
            <span className="peso-value recibido">
              {data.controlPeso.tn_recibida_total > 0
                ? fmtNum(data.controlPeso.tn_recibida_total)
                : 'Pendiente'}
            </span>
          </div>
        </div>
      </div>

      {/* Gráfico Peso Guía vs Peso Ticket */}
      <div className="section-card">
        <h2>📊 Peso Guía vs Peso Ticket</h2>
        <div className="chart-container">
          {(() => {
            const pesoGuia = data.controlPeso.tn_enviado_total || 0;
            const pesoTicket = data.controlPeso.tn_recibida_total || 0;
            if (pesoGuia === 0 && pesoTicket === 0) return <p className="empty-message">No hay datos para mostrar</p>;
            const chartData = [
              { nombre: 'Peso Guía', valor: pesoGuia },
              { nombre: 'Peso Ticket', valor: pesoTicket },
            ];
            const COLORS = ['#1B7430', '#E8913A'];
            return (
              <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: isMobile ? 45 : 80, left: isMobile ? 5 : 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} hide />
                  <YAxis dataKey="nombre" type="category" width={isMobile ? 70 : 100} tick={{ fontSize: isMobile ? 11 : 13, fontWeight: 600 }} />
                  <Tooltip formatter={(value) => `${fmtNum(value)} TN`} contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' }} />
                  <Bar dataKey="valor" name="TN" radius={[0, 6, 6, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index]} />
                    ))}
                    <LabelList dataKey="valor" position="right" formatter={(v) => `${fmtNum(v)} TN`} style={{ fontSize: isMobile ? 10 : 12, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </div>
      </div>
      </div>

    </div>
  );
};

export default DashboardResumen;
