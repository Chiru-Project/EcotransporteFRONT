import { Fragment, useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { dashboardService } from '../../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList
} from 'recharts';
import { useIsMobile } from '../../hooks/useIsMobile';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import logoEmpresa from '../../assets/Images/logo-empresa.png';
import './DashboardComponents.css';

const fmtNum = (n) => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const normalizeName = (name) => String(name || '').trim().replace(/\s+/g, ' ').toUpperCase();

// Paleta de colores equilibrada para gráficos
const COLORS = [
  '#1B7430', '#4A86B8', '#E8913A', '#8E6BAD',
  '#E05555', '#2BBBAD', '#F7C948', '#6C5CE7',
  '#FF6B81', '#17A2B8'
];

const DashboardTransportista = () => {
  const isMobile = useIsMobile();
  const contentRef = useRef(null);
  const [tnPorUnidad, setTnPorUnidad] = useState([]);
  const [tnPorCliente, setTnPorCliente] = useState([]);
  const [trasladosPorUnidad, setTrasladosPorUnidad] = useState([]);
  const [detalleTransportista, setDetalleTransportista] = useState([]);
  const [detalleTransportistaViajes, setDetalleTransportistaViajes] = useState([]);
  const [expandedTransportistas, setExpandedTransportistas] = useState({});
  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [divisaFiltro, setDivisaFiltro] = useState('');

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

  const capitalizeText = (text) => {
    if (!text) return '';
    return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  const getSubtitle = () => {
    const filterParts = [];
    if (localFilters.mes) filterParts.push(capitalizeText(localFilters.mes));
    if (localFilters.cliente) filterParts.push(capitalizeText(localFilters.cliente));
    if (localFilters.transportista) filterParts.push(capitalizeText(localFilters.transportista));
    if (localFilters.unidad) filterParts.push(`Placa: ${localFilters.unidad.toUpperCase()}`);
    if (divisaFiltro) filterParts.push(divisaFiltro.toUpperCase());
    return filterParts.length > 0 ? filterParts.join(' - ') : 'General';
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

  const exportVisualPdfFromSections = async ({
    rootElement,
    sectionSelector,
    fileName,
    title,
    subtitle,
  }) => {
    const cloneRoot = rootElement.cloneNode(true);
    cloneRoot.querySelectorAll('button, .pdf-btn-wrapper, .btn-download-excel').forEach((btn) => btn.remove());
    cloneRoot.querySelectorAll('select').forEach((sel) => sel.remove());

    // Ensure table text remains high-contrast in PDF capture.
    cloneRoot.querySelectorAll('.data-table td, .data-table td *').forEach((node) => {
      node.style.color = '#1f2937';
      node.style.opacity = '1';
    });
    cloneRoot.querySelectorAll('.data-table tbody tr').forEach((row) => {
      row.style.opacity = '1';
    });

    // Print mode: expand internal scroll areas so all rows/items are rendered.
    cloneRoot.querySelectorAll('.table-container').forEach((node) => {
      node.style.maxHeight = 'none';
      node.style.height = 'auto';
      node.style.overflow = 'visible';
    });
    cloneRoot.querySelectorAll('.chart-container').forEach((node) => {
      node.style.maxHeight = 'none';
      node.style.height = 'auto';
      node.style.overflow = 'visible';
      node.style.overflowX = 'visible';
      node.style.overflowY = 'visible';
    });

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
        // Ensure each section captures full width/height (including hidden horizontal content).
        section.style.overflow = 'visible';
        section.style.maxHeight = 'none';
        section.style.height = 'auto';
        section.style.width = `${Math.max(section.scrollWidth, section.offsetWidth)}px`;

        section.querySelectorAll('.chart-container, .table-container').forEach((node) => {
          node.style.overflow = 'visible';
          node.style.overflowX = 'visible';
          node.style.overflowY = 'visible';
          node.style.maxHeight = 'none';
          node.style.height = 'auto';
          node.style.width = `${Math.max(node.scrollWidth, node.offsetWidth)}px`;
        });

        const canvas = await html2canvas(section, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          windowWidth: Math.max(cloneRoot.scrollWidth, section.scrollWidth),
          windowHeight: section.scrollHeight,
        });
        sectionCanvases.push(canvas);
      }

      const logoDataUrl = await loadImageAsDataUrl(logoEmpresa).catch(() => null);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 24;
      const availableWidth = pageWidth - marginX * 2;
      const pageContentHeight = pageHeight - 60 - 16;

      let y = addHeader(pdf, title, subtitle, logoDataUrl);

      for (const canvas of sectionCanvases) {
        const imgData = canvas.toDataURL('image/png');
        let renderWidth = availableWidth;
        let renderHeight = (canvas.height * renderWidth) / canvas.width;

        if (renderHeight > pageContentHeight) {
          const fitRatio = pageContentHeight / renderHeight;
          renderWidth = renderWidth * fitRatio;
          renderHeight = pageContentHeight;
        }

        if (y + renderHeight > pageHeight - 16) {
          pdf.addPage();
          y = addHeader(pdf, title, subtitle, logoDataUrl);
        }

        const x = marginX + (availableWidth - renderWidth) / 2;
        pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
        y += renderHeight + 12;
      }

      pdf.save(fileName);
    } finally {
      document.body.removeChild(cloneRoot);
    }
  };

  const descargarPDF = async () => {
    if (!contentRef.current) return;
    setExportingPdf(true);
    try {
      await exportVisualPdfFromSections({
        rootElement: contentRef.current,
        sectionSelector: '.section-card',
        fileName: 'Detalle_Transportista.pdf',
        title: 'Detalle Transportista',
        subtitle: getSubtitle(),
      });
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  const descargarDetalleExcel = async () => {
    const filtered = detalleTransportista.filter(item => !divisaFiltro || (item.divisa_cost || 'PEN') === divisaFiltro);
    if (filtered.length === 0) return;

    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Detalle Transportista');
    worksheet.views = [{ state: 'frozen', ySplit: 6 }];

    worksheet.columns = [
      { key: 'transportista', width: 38 },
      { key: 'traslados', width: 12 },
      { key: 'peso', width: 18 },
      { key: 'divisa', width: 10 },
      { key: 'precio', width: 18 },
    ];

    const generatedAt = new Date().toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    worksheet.mergeCells('A1:A2');
    worksheet.getCell('A1').value = '';

    worksheet.mergeCells('B1:E1');
    worksheet.getCell('B1').value = 'ECOTRANSPORTE - DETALLE POR TRANSPORTISTA';
    worksheet.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1B7430' } };
    worksheet.getCell('B1').alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.mergeCells('B2:E2');
    worksheet.getCell('B2').value = `Generado: ${generatedAt}`;
    worksheet.getCell('B2').font = { size: 10, color: { argb: 'FF4B5563' } };
    worksheet.getCell('B2').alignment = { horizontal: 'left', vertical: 'middle' };

    const filterParts = [];
    if (localFilters.mes) filterParts.push(capitalizeText(localFilters.mes));
    if (localFilters.cliente) filterParts.push(capitalizeText(localFilters.cliente));
    if (localFilters.transportista) filterParts.push(capitalizeText(localFilters.transportista));
    if (localFilters.unidad) filterParts.push(`Placa: ${localFilters.unidad.toUpperCase()}`);
    if (divisaFiltro) filterParts.push(divisaFiltro.toUpperCase());
    const filterText = filterParts.length > 0 ? filterParts.join(' — ') : 'Sin filtros';

    worksheet.mergeCells('A4:E4');
    worksheet.getCell('A4').value = filterText;
    worksheet.getCell('A4').font = { bold: true, size: 10, color: { argb: 'FF374151' } };
    worksheet.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };

    try {
      const logoBase64 = await loadImageAsDataUrl(logoEmpresa);
      const imageId = workbook.addImage({
        base64: logoBase64,
        extension: 'png',
      });
      worksheet.addImage(imageId, {
        tl: { col: 0.08, row: 0.12 },
        ext: { width: 132, height: 52 },
        editAs: 'oneCell',
      });
    } catch (logoError) {
      console.warn('No se pudo insertar el logo en Excel de transportista:', logoError);
    }

    const headerRow = worksheet.getRow(6);
    headerRow.values = ['Transportista', 'Traslados', 'Peso Ticket (TN)', 'Divisa', 'Precio con IGV'];
    headerRow.height = 22;

    for (let col = 1; col <= 5; col++) {
      const cell = headerRow.getCell(col);
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B7430' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF15803D' } },
        left: { style: 'thin', color: { argb: 'FF15803D' } },
        bottom: { style: 'thin', color: { argb: 'FF15803D' } },
        right: { style: 'thin', color: { argb: 'FF15803D' } },
      };
    }

    filtered
      .sort((a, b) => (parseInt(b.cantidad_traslados) || 0) - (parseInt(a.cantidad_traslados) || 0))
      .forEach((item) => {
        const divisa = item.divisa_cost || 'PEN';

        const row = worksheet.addRow({
          transportista: item.transportista || 'Sin asignar',
          traslados: parseInt(item.cantidad_traslados) || 0,
          peso: Math.round((parseFloat(item.tn_recibido) || 0) * 100) / 100,
          divisa,
          precio: Math.round((parseFloat(item.precio_total) || 0) * 100) / 100,
        });

        row.getCell(2).numFmt = '#,##0';
        row.getCell(3).numFmt = '#,##0.00';
        row.getCell(5).numFmt = '#,##0.00';

        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          cell.font = { size: 10, color: { argb: 'FF1E2A3A' } };
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 1 ? 'left' : (colNumber === 4 ? 'center' : 'right'),
          };
        });
      });

    worksheet.getRow(1).height = 34;
    worksheet.getRow(2).height = 22;
    worksheet.getRow(4).height = 20;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Detalle_Transportista.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const [localFilters, setLocalFilters] = useState({
    mes: '', cliente: '', transportista: '', unidad: ''
  });

  const [segmentadores, setSegmentadores] = useState({
    meses: [], clientes: [], transportistas: [], unidades: []
  });

  useEffect(() => {
    const init = async () => {
      try {
        const data = await dashboardService.getSegmentadoresFiltrados({});
        setSegmentadores({
          meses: data.meses || [],
          clientes: data.clientes || [],
          transportistas: data.transportistas || [],
          unidades: data.unidades || []
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

  const getActiveFilters = () => {
    const f = {};
    if (localFilters.mes) f.mes = localFilters.mes;
    if (localFilters.cliente) f.cliente = localFilters.cliente;
    if (localFilters.transportista) f.transportista = localFilters.transportista;
    if (localFilters.unidad) f.unidad = localFilters.unidad;
    return f;
  };

  const handleFilterChange = async (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setFiltersLoading(true);
    try {
      const activeForCascade = {};
      if (newFilters.mes) activeForCascade.mes = newFilters.mes;
      if (newFilters.cliente) activeForCascade.cliente = newFilters.cliente;
      if (newFilters.transportista) activeForCascade.transportista = newFilters.transportista;
      if (newFilters.unidad) activeForCascade.unidad = newFilters.unidad;

      const newSeg = await dashboardService.getSegmentadoresFiltrados(activeForCascade);

      // Resetear filtros que ya no son válidos
      if (newFilters.mes && !newSeg.meses.includes(newFilters.mes)) newFilters.mes = '';
      if (newFilters.cliente && !newSeg.clientes.includes(newFilters.cliente)) newFilters.cliente = '';
      if (newFilters.transportista && !newSeg.transportistas.includes(newFilters.transportista)) newFilters.transportista = '';
      if (newFilters.unidad && !newSeg.unidades.includes(newFilters.unidad)) newFilters.unidad = '';

      setSegmentadores({
        meses: newSeg.meses || [],
        clientes: newSeg.clientes || [],
        transportistas: newSeg.transportistas || [],
        unidades: newSeg.unidades || []
      });
      setLocalFilters(newFilters);
    } catch (error) {
      console.error('Error en filtros en cascada:', error);
      setLocalFilters(newFilters);
    } finally {
      setFiltersLoading(false);
    }
  };

  const clearFilters = async () => {
    setFiltersLoading(true);
    try {
      const data = await dashboardService.getSegmentadoresFiltrados({});
      setSegmentadores({
        meses: data.meses || [],
        clientes: data.clientes || [],
        transportistas: data.transportistas || [],
        unidades: data.unidades || []
      });
    } catch (error) {
      console.error('Error limpiando filtros:', error);
    } finally {
      setFiltersLoading(false);
    }
    setLocalFilters({ mes: '', cliente: '', transportista: '', unidad: '' });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const activeFilters = getActiveFilters();
      const [unidad, cliente, traslados, detalle, detalleViajes] = await Promise.all([
        dashboardService.getTnPorUnidad(activeFilters),
        dashboardService.getTnPorCliente(activeFilters),
        dashboardService.getTrasladosPorUnidad(activeFilters),
        dashboardService.getDetalleTransportista(activeFilters),
        dashboardService.getDetalleTransportistaViajes(activeFilters),
      ]);
      setTnPorUnidad((unidad || []).map(item => ({ ...item, total: parseFloat(item.total) || 0 })));
      setTnPorCliente((cliente || []).map(item => ({ ...item, total: parseFloat(item.total) || 0 })));
      setTrasladosPorUnidad((traslados || []).map(item => ({ ...item, cantidad: parseInt(item.cantidad) || 0, tn_recibido: parseFloat(item.tn_recibido) || 0 })));
      setDetalleTransportista(detalle || []);
      setDetalleTransportistaViajes(detalleViajes || []);
      setExpandedTransportistas({});
    } catch (error) {
      console.error('Error cargando datos de transportista:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    const dateStr = typeof d === 'string' ? d.substring(0, 10) : new Date(d).toISOString().substring(0, 10);
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const makeDetalleKey = (transportista, divisa) => `${normalizeName(transportista) || 'SIN ASIGNAR'}|${divisa || 'PEN'}`;

  const toggleTransportista = (key) => {
    setExpandedTransportistas((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getViajesForItem = (item) => {
    const transportista = normalizeName(item.transportista);
    const divisa = item.divisa_cost || 'PEN';
    return (detalleTransportistaViajes || []).filter((v) => normalizeName(v.transportista) === transportista && (v.divisa_cost || 'PEN') === divisa);
  };

  const getRecorridoLabel = (viaje) => {
    if (viaje.recorrido) return viaje.recorrido;
    const partida = (viaje.partida || '').split('-').pop()?.trim() || '';
    const llegada = (viaje.llegada || '').split('-').pop()?.trim() || '';
    if (!partida && !llegada) return '-';
    return `${partida}-${llegada}`;
  };

  if (loading) {
    return <div className="loading-section"><div className="spinner"></div></div>;
  }

  return (
    <div className="dashboard-transportista">
      <div className="pdf-btn-wrapper">
        <button className="btn-download-pdf" onClick={descargarPDF} disabled={exportingPdf}>
          {exportingPdf ? 'Generando...' : '📥 Descargar PDF'}
        </button>
      </div>
      {/* Filtros en cascada */}
      <div className="section-filters">
        <div className="filter-row">
          <div className="filter-item">
            <label>Mes</label>
            <select value={localFilters.mes} onChange={(e) => handleFilterChange('mes', e.target.value)} disabled={filtersLoading}>
              <option value="">Todos</option>
              {segmentadores.meses.map(m => <option key={m} value={m}>{capitalizeText(m)}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label>Cliente</label>
            <select value={localFilters.cliente} onChange={(e) => handleFilterChange('cliente', e.target.value)} disabled={filtersLoading}>
              <option value="">Todos</option>
              {segmentadores.clientes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label>Transportista</label>
            <select value={localFilters.transportista} onChange={(e) => handleFilterChange('transportista', e.target.value)} disabled={filtersLoading}>
              <option value="">Todos</option>
              {segmentadores.transportistas.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label>Unidad</label>
            <select value={localFilters.unidad} onChange={(e) => handleFilterChange('unidad', e.target.value)} disabled={filtersLoading}>
              <option value="">Todas</option>
              {segmentadores.unidades.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <button className="btn-clear-local" onClick={clearFilters} disabled={filtersLoading}>
            {filtersLoading ? '...' : 'Limpiar'}
          </button>
        </div>
      </div>

      <div ref={contentRef}>
      {/* Detalle por Transportista */}
      <div className="section-card full-width">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <h2 style={{ margin: 0 }}>📋 Detalle por Transportista</h2>
          <button className="btn-download-excel" onClick={descargarDetalleExcel} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #1B7430', background: '#e8f5e9', color: '#1B7430', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>📊 Excel</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>Divisa:</label>
            <select
              value={divisaFiltro}
              onChange={e => setDivisaFiltro(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.875rem', cursor: 'pointer' }}
            >
              <option value="">Todas</option>
              <option value="USD">$ Dólares (USD)</option>
              <option value="PEN">S/ Soles (PEN)</option>
            </select>
          </div>
        </div>
        {detalleTransportista.length === 0 ? (
          <p className="empty-message">No hay datos para mostrar</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transportista</th>
                  <th>Traslados</th>
                  <th>Peso Ticket</th>
                  <th>Divisa</th>
                  <th>Precio con IGV</th>
                </tr>
              </thead>
              <tbody>
                {[...detalleTransportista]
                  .filter(item => !divisaFiltro || (item.divisa_cost || 'PEN') === divisaFiltro)
                  .sort((a, b) => (parseInt(b.cantidad_traslados) || 0) - (parseInt(a.cantidad_traslados) || 0)).map((item) => {
                    const rowKey = makeDetalleKey(item.transportista, item.divisa_cost);
                    const isExpanded = !!expandedTransportistas[rowKey];
                    const viajes = isExpanded ? getViajesForItem(item) : [];
                    return (
                      <Fragment key={rowKey}>
                        <tr key={`sum-${rowKey}`} className="fila-transportista-resumen" onClick={() => toggleTransportista(rowKey)}>
                          <td>
                            <button className="btn-toggle-transportista" type="button" aria-label={`Expandir ${item.transportista || 'Sin asignar'}`}>
                              {isExpanded ? '▼' : '▶'}
                            </button>
                            <span className="cliente-name">{item.transportista || 'Sin asignar'}</span>
                          </td>
                          <td>{item.cantidad_traslados}</td>
                          <td>{fmtNum(item.tn_recibido)}</td>
                          <td>{(item.divisa_cost || 'PEN')}</td>
                          <td>{(item.divisa_cost || 'PEN') === 'USD' ? '$' : 'S/'} {(parseFloat(item.precio_total) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <tr key={`det-${rowKey}`} className="fila-transportista-detalle">
                              <td colSpan={5}>
                                <motion.div
                                  className="transportista-curtain-content"
                                  initial={{ height: 0, opacity: 0, y: -6 }}
                                  animate={{ height: 'auto', opacity: 1, y: 0 }}
                                  exit={{ height: 0, opacity: 0, y: -6 }}
                                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                                >
                                <div className="transportista-curtain-meta">
                                  <strong>{item.transportista || 'Sin asignar'}</strong> | {item.cantidad_traslados} traslados | {fmtNum(item.tn_recibido)} TN | {(item.divisa_cost || 'PEN') === 'USD' ? '$' : 'S/'} {(parseFloat(item.precio_total) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                {viajes.length === 0 ? (
                                  <div className="transportista-empty-detail">No hay detalle de traslados para este transportista.</div>
                                ) : (
                                  <div className="transportista-curtain-wrap">
                                    <table className="transportista-curtain-table">
                                      <thead>
                                        <tr>
                                          <th>Fecha</th>
                                          <th>Placa</th>
                                          <th>Cliente</th>
                                          <th>Recorrido</th>
                                          <th>Material</th>
                                          <th>Guía</th>
                                          <th>Ticket</th>
                                          <th>TN Recibida</th>
                                          <th>Precio</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {viajes.map((v, i) => (
                                          <tr key={`${rowKey}-v-${i}`}>
                                            <td>{formatDate(v.fecha)}</td>
                                            <td>{v.unidad || '-'}</td>
                                            <td>{v.cliente || '-'}</td>
                                            <td>{getRecorridoLabel(v)}</td>
                                            <td>{v.material || '-'}</td>
                                            <td>{v.grt || '-'}</td>
                                            <td>{v.ticket || '-'}</td>
                                            <td>{fmtNum(v.tn_recibida)} TN</td>
                                            <td>{(v.divisa_cost || 'PEN') === 'USD' ? '$' : 'S/'} {(parseFloat(v.precio_total) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts row */}
      {(() => {
        const chartHeight = Math.max(300, tnPorUnidad.length * (isMobile ? 40 : 50));
        const pieRadius = Math.min(isMobile ? 110 : 200, Math.floor((chartHeight - 20) / 2));
        return (
        <>
        {/* TN por Unidad (Placa) */}
        <div className="section-card">
          <h2>🚚 TN por Unidad</h2>
          <div className="chart-container" style={{ overflowX: tnPorUnidad.length > (isMobile ? 6 : 12) ? 'auto' : 'hidden' }}>
            {tnPorUnidad.length === 0 ? (
              <p className="empty-message">No hay datos para mostrar</p>
            ) : (
              <>
              <ResponsiveContainer width={tnPorUnidad.length > (isMobile ? 6 : 12) ? Math.max(tnPorUnidad.length * (isMobile ? 60 : 80), 600) : '100%'} height={isMobile ? 300 : 400} debounce={50}>
                <BarChart data={tnPorUnidad} margin={{ left: 10, right: 20, top: 20, bottom: isMobile ? 60 : 50 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#b0b0b0" strokeOpacity={0.7} />
                  <XAxis dataKey="placa" tick={{ fontSize: isMobile ? 9 : 11, angle: -45, textAnchor: 'end' }} height={isMobile ? 70 : 60} interval={0} />
                  <YAxis tick={{ fontSize: isMobile ? 9 : 11 }} width={isMobile ? 50 : 65} tickFormatter={(v) => `${v} TN`} />
                  <Tooltip formatter={(value) => `${fmtNum(value)} TN`} contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' }} />
                  <Bar dataKey="total" name="TN" radius={[6, 6, 0, 0]} maxBarSize={isMobile ? 40 : 60}>
                    {tnPorUnidad.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    <LabelList dataKey="total" position="top" formatter={(v) => `${fmtNum(v)}`} style={{ fontSize: isMobile ? 8 : 10, fill: '#333' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Leyenda unidades */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10, fontSize: 12, minWidth: tnPorUnidad.length > (isMobile ? 6 : 12) ? Math.max(tnPorUnidad.length * (isMobile ? 60 : 80), 600) : undefined }}>
                {tnPorUnidad.map((item, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS[index % COLORS.length], flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ color: '#333' }}>{item.placa || 'Sin placa'} — {fmtNum(item.total)} TN</span>
                  </div>
                ))}
              </div>
              </>
            )}
          </div>
        </div>

        {/* TN por Cliente */}
        <div className="section-card">
          <h2>🧑‍💼 TN por Cliente</h2>
          <div className="chart-container pie-chart">
            {tnPorCliente.length === 0 ? (
              <p className="empty-message">No hay datos para mostrar</p>
            ) : (
              <>
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <Pie
                    data={tnPorCliente}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={false}
                    outerRadius={isMobile ? 80 : 120}
                    fill="#8884d8"
                    dataKey="total"
                    nameKey="cliente"
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {tnPorCliente.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, props) => {
                      const total = tnPorCliente.reduce((s, i) => s + i.total, 0);
                      const pct = total > 0 ? ((parseFloat(value) / total) * 100).toFixed(2) : '0.00';
                      return [`${fmtNum(value)} TN (${pct}%)`, props.payload.cliente || 'Sin cliente'];
                    }}
                    contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Leyenda */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 4, fontSize: 12 }}>
                {tnPorCliente.map((item, index) => {
                  const total = tnPorCliente.reduce((s, i) => s + i.total, 0);
                  const pct = total > 0 ? ((item.total / total) * 100).toFixed(2) : '0.00';
                  return (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS[index % COLORS.length], flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ color: '#333' }}>{item.cliente || 'Sin cliente'} — {fmtNum(item.total)} TN ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </div>
        </div>
        </>
        );
      })()}

      {/* Traslados por Unidad */}
      <div className="section-card">
        <h2>📦 Traslados por Unidad</h2>
        {trasladosPorUnidad.length === 0 ? (
          <p className="empty-message">No hay datos para mostrar</p>
        ) : (
          <div className="chart-container">
<ResponsiveContainer width="100%" height={Math.max(isMobile ? 250 : 300, trasladosPorUnidad.length * (isMobile ? 22 : 28))}>
              <BarChart data={trasladosPorUnidad} margin={{ top: isMobile ? 25 : 35, right: isMobile ? 10 : 20, left: 0, bottom: isMobile ? 10 : 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="placa" tick={{ fontSize: isMobile ? 9 : 11 }} interval={0} angle={isMobile ? -45 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 50 : 30} />
                <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 30 : 60} />
                <Tooltip formatter={(value, name) => name === 'Traslados' ? [value, 'Traslados'] : [`${fmtNum(value)} TN`, 'Peso Ticket']} contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' }} />
                {!isMobile && <Legend />}
                <Bar dataKey="cantidad" name="Traslados" radius={[4, 4, 0, 0]}>
                  {trasladosPorUnidad.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                  <LabelList
                    content={({ x, y, width, value, index }) => {
                      const item = trasladosPorUnidad[index];
                      const tnRaw = item ? parseFloat(item.tn_recibido) : NaN;
                      const tn = !isNaN(tnRaw) && tnRaw > 0 ? `${fmtNum(tnRaw)} TN` : null;
                      const fs = isMobile ? 8 : 10;
                      return (
                        <g>
                          {tn && !isMobile && <text x={x + width / 2} y={y - 18} textAnchor="middle" fontSize={fs} fill="#1B7430" fontWeight={600}>{tn}</text>}
                          <text x={x + width / 2} y={tn && !isMobile ? y - 6 : y - 6} textAnchor="middle" fontSize={fs} fill="#555">{value}</text>
                        </g>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Lista detallada de TN por Cliente */}
      <div className="section-card">
        <h2>📝 Detalle TN por Cliente</h2>
        {tnPorCliente.length === 0 ? (
          <p className="empty-message">No hay datos para mostrar</p>
        ) : (
          <div className="detail-list">
            {tnPorCliente.map((item, index) => (
              <div className="detail-item" key={index}>
                <span className="legend-color" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                <span className="detail-name">{item.cliente || 'Sin cliente'}</span>
                <span className="detail-value">{fmtNum(item.total)} TN</span>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default DashboardTransportista;
