import { useState, useEffect, useRef } from 'react';
import { dashboardService } from '../../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, LabelList
} from 'recharts';
import { useIsMobile } from '../../hooks/useIsMobile';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import XLSX from 'xlsx-js-style';
import logoEmpresa from '../../assets/Images/logo-empresa.png';
import './DashboardComponents.css';

const fmtNum = (n) => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Colores para divisas - contrastantes
const COLORS = {
  PEN: '#1B7430',    // Verde principal para Soles
  USD: '#4A86B8',    // Azul medio para Dólares
  dolares: '#4A86B8',
  soles: '#1B7430',
};

// Paleta de colores equilibrada para gráficos
const CHART_COLORS = [
  '#1B7430', // Verde principal
  '#4A86B8', // Azul medio
  '#C4883A', // Dorado suave
  '#8E6BAD', // Lila
  '#3A9E9E', // Teal medio
  '#C06050', // Terracota
  '#5D8A5D', // Verde salvia
  '#6882A8', // Azul grisáceo
  '#B87840', // Bronce
  '#9E6575'  // Rosa antiguo
];

const MultiLineYAxisTick = ({ x, y, payload, compact = false }) => {
  const value = String(payload?.value ?? '');
  const lines = value.split('\n').slice(0, 2);
  const lineHeight = compact ? 10 : 12;

  return (
    <text x={x} y={y} textAnchor="end" fill="#44546A" fontSize={compact ? 9 : 10}>
      {lines.map((line, idx) => (
        <tspan key={`${line}-${idx}`} x={x} dy={idx === 0 ? 3 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
};

// SVG path for bar with rounded end (right for positive, left for negative)
const roundedBarPath = (x, y, w, h) => {
  if (!w || !h) return '';
  const r = Math.min(7, Math.abs(w) / 2, h / 2);
  if (w >= 0) {
    return `M${x},${y} L${x+w-r},${y} Q${x+w},${y} ${x+w},${y+r} L${x+w},${y+h-r} Q${x+w},${y+h} ${x+w-r},${y+h} L${x},${y+h} Z`;
  }
  const ax = x + w;
  return `M${x},${y} L${x},${y+h} L${ax+r},${y+h} Q${ax},${y+h} ${ax},${y+h-r} L${ax},${y+r} Q${ax},${y} ${ax+r},${y} Z`;
};

// Custom bar shape that centers when the other currency is absent
const makeCenteredBar = (dataKey, otherKey, color, fmtLabel) => (props) => {
  const { x, y, width, height, payload } = props;
  if (!width || Math.abs(width) < 0.5) return null;
  const value = payload[dataKey];
  const otherValue = payload[otherKey];
  const hasOther = otherValue != null && otherValue !== 0;
  // USD=top bar, PEN=bottom bar; center if other is missing
  const adjustedY = hasOther ? y : (dataKey === 'USD' ? y + height / 2 : y - height / 2);
  const d = roundedBarPath(x, adjustedY, width, height);
  const label = fmtLabel(value);
  const labelX = width >= 0 ? x + width + 5 : x + width - 5;
  const anchor = width >= 0 ? 'start' : 'end';
  return (
    <g>
      <path d={d} fill={color} />
      {label && (
        <text x={labelX} y={adjustedY + height / 2} dy="0.35em" fill={color} fontSize={11} fontWeight={700} textAnchor={anchor}>
          {label}
        </text>
      )}
    </g>
  );
};

const CobrarUsdBar = makeCenteredBar('USD', 'PEN', COLORS.USD, v => v > 0 ? `$ ${fmtNum(v)}` : '');
const CobrarPenBar = makeCenteredBar('PEN', 'USD', COLORS.PEN, v => v > 0 ? `S/ ${fmtNum(v)}` : '');
const MargenUsdBar = makeCenteredBar('USD', 'PEN', COLORS.USD, v => v !== 0 ? `$ ${fmtNum(v)}` : '');
const MargenPenBar = makeCenteredBar('PEN', 'USD', COLORS.PEN, v => v !== 0 ? `S/ ${fmtNum(v)}` : '');

const DashboardFinanciero = ({ filters }) => {
  const isMobile = useIsMobile();
  const [porCobrar, setPorCobrar] = useState([]);
  const [porPagar, setPorPagar] = useState([]);
  const [margenOperativo, setMargenOperativo] = useState([]);
  const [tnClienteEmpresa, setTnClienteEmpresa] = useState([]);
  const [seguimiento, setSeguimiento] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cobrar');
  const tnSectionRef = useRef(null);
  const pagarSectionRef = useRef(null);
  const cobrarSectionRef = useRef(null);
  const margenSectionRef = useRef(null);
  const segSectionRef = useRef(null);
  const cobrarChartRef = useRef(null);
  const pagarChartRef = useRef(null);
  const margenChartRef = useRef(null);
  const [exportingTnPdf, setExportingTnPdf] = useState(false);
  const [exportingPagarPdf, setExportingPagarPdf] = useState(false);
  const [exportingCobrarPdf, setExportingCobrarPdf] = useState(false);
  const [exportingMargenPdf, setExportingMargenPdf] = useState(false);
  const [exportingSegPdf, setExportingSegPdf] = useState(false);
  const [exportingCobrarChartPdf, setExportingCobrarChartPdf] = useState(false);
  const [exportingPagarChartPdf, setExportingPagarChartPdf] = useState(false);
  const [exportingMargenChartPdf, setExportingMargenChartPdf] = useState(false);

  const [localFilters, setLocalFilters] = useState({ mes: '', semana: '', cliente: '', transportista: '', unidad: '', divisa: '' });
  const [filterOptions, setFilterOptions] = useState({ meses: [], semanas: [], clientes: [], transportistas: [], unidades: [], divisas: [] });
  const [filtersLoading, setFiltersLoading] = useState(false);

  const [localFiltersPagar, setLocalFiltersPagar] = useState({ mes: '', semana: '', cliente: '', transportista: '', unidad: '', divisa: '' });
  const [filterOptionsPagar, setFilterOptionsPagar] = useState({ meses: [], semanas: [], clientes: [], transportistas: [], unidades: [], divisas: [] });
  const [filtersLoadingPagar, setFiltersLoadingPagar] = useState(false);

  const [localFiltersMargen, setLocalFiltersMargen] = useState({ mes: '', semana: '', cliente: '', transportista: '', unidad: '', divisa: '' });
  const [filterOptionsMargen, setFilterOptionsMargen] = useState({ meses: [], semanas: [], clientes: [], transportistas: [], unidades: [], divisas: [] });
  const [filtersLoadingMargen, setFiltersLoadingMargen] = useState(false);

  const [localFiltersTn, setLocalFiltersTn] = useState({ mes: '', semana: '', cliente: '', transportista: '', unidad: '', divisa: '' });
  const [filterOptionsTn, setFilterOptionsTn] = useState({ meses: [], semanas: [], clientes: [], transportistas: [], unidades: [], divisas: [] });
  const [filtersLoadingTn, setFiltersLoadingTn] = useState(false);

  const [localFiltersSeg, setLocalFiltersSeg] = useState({ mes: '', semana: '', cliente: '', unidad: '' });
  const [filterOptionsSeg, setFilterOptionsSeg] = useState({ meses: [], semanas: [], clientes: [], unidades: [] });
  const [filtersLoadingSeg, setFiltersLoadingSeg] = useState(false);

  const getActiveFilters = () => {
    const active = {};
    Object.entries(localFilters).forEach(([k, v]) => { if (v) active[k] = v; });
    return active;
  };

  useEffect(() => {
    const init = async () => {
      try {
        const data = await dashboardService.getSegmentadoresFiltrados({});
        const opts = {
          meses: data.meses || [],
          semanas: data.semanas || [],
          clientes: data.clientes || [],
          transportistas: data.transportistas || [],
          unidades: data.unidades || [],
          divisas: data.divisas || [],
        };
        setFilterOptions(opts);
        setFilterOptionsPagar(opts);
        setFilterOptionsMargen(opts);
        setFilterOptionsTn(opts);
        setFilterOptionsSeg({ meses: data.meses || [], semanas: data.semanas || [], clientes: data.clientes || [], unidades: data.unidades || [] });
      } catch (e) { console.error(e); }
    };
    init();
  }, []);

  useEffect(() => {
    loadCobrar();
  }, [localFilters]);

  useEffect(() => {
    loadPagar();
  }, [localFiltersPagar]);

  useEffect(() => {
    loadMargen();
  }, [localFiltersMargen]);

  useEffect(() => {
    loadTnClienteEmpresa();
  }, [localFiltersTn]);

  useEffect(() => {
    if (localFiltersSeg.mes) loadSeguimiento();
    else setSeguimiento([]);
  }, [localFiltersSeg]);

  const getActivePagarFilters = () => {
    const active = {};
    Object.entries(localFiltersPagar).forEach(([k, v]) => { if (v) active[k] = v; });
    return active;
  };

  const loadCobrar = async () => {
    setLoading(true);
    try {
      const activeFilters = getActiveFilters();
      const cobrar = await dashboardService.getPorCobrar(activeFilters);
      setPorCobrar((cobrar || []).map(item => ({ ...item, total: parseFloat(item.total) || 0 })));
    } catch (error) {
      console.error('Error cargando Por Cobrar:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPagar = async () => {
    setLoading(true);
    try {
      const activeFilters = getActivePagarFilters();
      const pagar = await dashboardService.getPorPagar(activeFilters);
      setPorPagar((pagar || []).map(item => ({ ...item, total: parseFloat(item.total) || 0 })));
    } catch (error) {
      console.error('Error cargando Por Pagar:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActiveMargenFilters = () => {
    const active = {};
    Object.entries(localFiltersMargen).forEach(([k, v]) => { if (v) active[k] = v; });
    return active;
  };

  const loadMargen = async () => {
    setLoading(true);
    try {
      const activeFilters = getActiveMargenFilters();
      const margen = await dashboardService.getMargenOperativo(activeFilters);
      setMargenOperativo((margen || []).map(item => ({ ...item, total: parseFloat(item.total) || 0 })));
    } catch (error) {
      console.error('Error cargando Margen Operativo:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActiveTnFilters = () => {
    const active = {};
    Object.entries(localFiltersTn).forEach(([k, v]) => { if (v) active[k] = v; });
    return active;
  };

  const loadTnClienteEmpresa = async () => {
    setLoading(true);
    try {
      const activeFilters = getActiveTnFilters();
      const tnCE = await dashboardService.getTnClienteEmpresa(activeFilters);
      setTnClienteEmpresa((tnCE || []).map(item => ({ ...item, total: parseFloat(item.total) || 0 })));
    } catch (error) {
      console.error('Error cargando TN Recibido:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSeguimiento = async () => {
    setLoading(true);
    try {
      const active = {};
      Object.entries(localFiltersSeg).forEach(([k, v]) => { if (v) active[k] = v; });
      const seg = await dashboardService.getSeguimientoTransporte(active);
      setSeguimiento(seg || []);
    } catch (error) {
      console.error('Error cargando Seguimiento:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChangeSeg = async (key, value) => {
    const newFilters = { ...localFiltersSeg, [key]: value };
    setFiltersLoadingSeg(true);
    try {
      const active = {};
      Object.entries(newFilters).forEach(([k, v]) => { if (v) active[k] = v; });
      const data = await dashboardService.getSegmentadoresFiltrados(active);
      const newOptions = {
        meses: data.meses || [],
        semanas: data.semanas || [],
        clientes: data.clientes || [],
        unidades: data.unidades || [],
      };
      const validated = { ...newFilters };
      if (validated.mes && !newOptions.meses.includes(validated.mes)) validated.mes = '';
      if (validated.semana && !newOptions.semanas.includes(validated.semana)) validated.semana = '';
      if (validated.cliente && !newOptions.clientes.includes(validated.cliente)) validated.cliente = '';
      if (validated.unidad && !newOptions.unidades.includes(validated.unidad)) validated.unidad = '';
      setFilterOptionsSeg(newOptions);
      setLocalFiltersSeg(validated);
    } catch (e) { console.error(e); } finally { setFiltersLoadingSeg(false); }
  };

  const clearFiltersSeg = async () => {
    setFiltersLoadingSeg(true);
    try {
      const data = await dashboardService.getSegmentadoresFiltrados({});
      setFilterOptionsSeg({ meses: data.meses || [], semanas: data.semanas || [], clientes: data.clientes || [], unidades: data.unidades || [] });
    } catch (e) { console.error(e); } finally { setFiltersLoadingSeg(false); }
    setLocalFiltersSeg({ mes: '', semana: '', cliente: '', unidad: '' });
  };

  const handleFilterChange = async (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setFiltersLoading(true);
    try {
      const active = {};
      Object.entries(newFilters).forEach(([k, v]) => { if (v) active[k] = v; });
      const data = await dashboardService.getSegmentadoresFiltrados(active);
      const newOptions = {
        meses: data.meses || [],
        semanas: data.semanas || [],
        clientes: data.clientes || [],
        transportistas: data.transportistas || [],
        unidades: data.unidades || [],
        divisas: data.divisas || [],
      };
      const validated = { ...newFilters };
      if (validated.mes && !newOptions.meses.includes(validated.mes)) validated.mes = '';
      if (validated.semana && !newOptions.semanas.includes(validated.semana)) validated.semana = '';
      if (validated.cliente && !newOptions.clientes.includes(validated.cliente)) validated.cliente = '';
      if (validated.transportista && !newOptions.transportistas.includes(validated.transportista)) validated.transportista = '';
      if (validated.unidad && !newOptions.unidades.includes(validated.unidad)) validated.unidad = '';
      if (validated.divisa && !newOptions.divisas.includes(validated.divisa)) validated.divisa = '';
      setFilterOptions(newOptions);
      setLocalFilters(validated);
    } catch (e) { console.error(e); } finally { setFiltersLoading(false); }
  };

  const clearFilters = async () => {
    setFiltersLoading(true);
    try {
      const data = await dashboardService.getSegmentadoresFiltrados({});
      setFilterOptions({ meses: data.meses || [], semanas: data.semanas || [], clientes: data.clientes || [], transportistas: data.transportistas || [], unidades: data.unidades || [], divisas: data.divisas || [] });
    } catch (e) { console.error(e); } finally { setFiltersLoading(false); }
    setLocalFilters({ mes: '', semana: '', cliente: '', transportista: '', unidad: '', divisa: '' });
  };

  const handleFilterChangePagar = async (key, value) => {
    const newFilters = { ...localFiltersPagar, [key]: value };
    setFiltersLoadingPagar(true);
    try {
      const active = {};
      Object.entries(newFilters).forEach(([k, v]) => { if (v) active[k] = v; });
      const data = await dashboardService.getSegmentadoresFiltrados(active);
      const newOptions = {
        meses: data.meses || [],
        semanas: data.semanas || [],
        clientes: data.clientes || [],
        transportistas: data.transportistas || [],
        unidades: data.unidades || [],
        divisas: data.divisas || [],
      };
      const validated = { ...newFilters };
      if (validated.mes && !newOptions.meses.includes(validated.mes)) validated.mes = '';
      if (validated.semana && !newOptions.semanas.includes(validated.semana)) validated.semana = '';
      if (validated.cliente && !newOptions.clientes.includes(validated.cliente)) validated.cliente = '';
      if (validated.transportista && !newOptions.transportistas.includes(validated.transportista)) validated.transportista = '';
      if (validated.unidad && !newOptions.unidades.includes(validated.unidad)) validated.unidad = '';
      if (validated.divisa && !newOptions.divisas.includes(validated.divisa)) validated.divisa = '';
      setFilterOptionsPagar(newOptions);
      setLocalFiltersPagar(validated);
    } catch (e) { console.error(e); } finally { setFiltersLoadingPagar(false); }
  };

  const clearFiltersPagar = async () => {
    setFiltersLoadingPagar(true);
    try {
      const data = await dashboardService.getSegmentadoresFiltrados({});
      setFilterOptionsPagar({ meses: data.meses || [], semanas: data.semanas || [], clientes: data.clientes || [], transportistas: data.transportistas || [], unidades: data.unidades || [], divisas: data.divisas || [] });
    } catch (e) { console.error(e); } finally { setFiltersLoadingPagar(false); }
    setLocalFiltersPagar({ mes: '', semana: '', cliente: '', transportista: '', unidad: '', divisa: '' });
  };

  const handleFilterChangeMargen = async (key, value) => {
    const newFilters = { ...localFiltersMargen, [key]: value };
    setFiltersLoadingMargen(true);
    try {
      const active = {};
      Object.entries(newFilters).forEach(([k, v]) => { if (v) active[k] = v; });
      const data = await dashboardService.getSegmentadoresFiltrados(active);
      const newOptions = {
        meses: data.meses || [],
        semanas: data.semanas || [],
        clientes: data.clientes || [],
        transportistas: data.transportistas || [],
        unidades: data.unidades || [],
        divisas: data.divisas || [],
      };
      const validated = { ...newFilters };
      if (validated.mes && !newOptions.meses.includes(validated.mes)) validated.mes = '';
      if (validated.semana && !newOptions.semanas.includes(validated.semana)) validated.semana = '';
      if (validated.cliente && !newOptions.clientes.includes(validated.cliente)) validated.cliente = '';
      if (validated.transportista && !newOptions.transportistas.includes(validated.transportista)) validated.transportista = '';
      if (validated.unidad && !newOptions.unidades.includes(validated.unidad)) validated.unidad = '';
      if (validated.divisa && !newOptions.divisas.includes(validated.divisa)) validated.divisa = '';
      setFilterOptionsMargen(newOptions);
      setLocalFiltersMargen(validated);
    } catch (e) { console.error(e); } finally { setFiltersLoadingMargen(false); }
  };

  const clearFiltersMargen = async () => {
    setFiltersLoadingMargen(true);
    try {
      const data = await dashboardService.getSegmentadoresFiltrados({});
      setFilterOptionsMargen({ meses: data.meses || [], semanas: data.semanas || [], clientes: data.clientes || [], transportistas: data.transportistas || [], unidades: data.unidades || [], divisas: data.divisas || [] });
    } catch (e) { console.error(e); } finally { setFiltersLoadingMargen(false); }
    setLocalFiltersMargen({ mes: '', semana: '', cliente: '', transportista: '', unidad: '', divisa: '' });
  };

  const handleFilterChangeTn = async (key, value) => {
    const newFilters = { ...localFiltersTn, [key]: value };
    setFiltersLoadingTn(true);
    try {
      const active = {};
      Object.entries(newFilters).forEach(([k, v]) => { if (v) active[k] = v; });
      const data = await dashboardService.getSegmentadoresFiltrados(active);
      const newOptions = {
        meses: data.meses || [],
        semanas: data.semanas || [],
        clientes: data.clientes || [],
        transportistas: data.transportistas || [],
        unidades: data.unidades || [],
        divisas: data.divisas || [],
      };
      const validated = { ...newFilters };
      if (validated.mes && !newOptions.meses.includes(validated.mes)) validated.mes = '';
      if (validated.semana && !newOptions.semanas.includes(validated.semana)) validated.semana = '';
      if (validated.cliente && !newOptions.clientes.includes(validated.cliente)) validated.cliente = '';
      if (validated.transportista && !newOptions.transportistas.includes(validated.transportista)) validated.transportista = '';
      if (validated.unidad && !newOptions.unidades.includes(validated.unidad)) validated.unidad = '';
      if (validated.divisa && !newOptions.divisas.includes(validated.divisa)) validated.divisa = '';
      setFilterOptionsTn(newOptions);
      setLocalFiltersTn(validated);
    } catch (e) { console.error(e); } finally { setFiltersLoadingTn(false); }
  };

  const clearFiltersTn = async () => {
    setFiltersLoadingTn(true);
    try {
      const data = await dashboardService.getSegmentadoresFiltrados({});
      setFilterOptionsTn({ meses: data.meses || [], semanas: data.semanas || [], clientes: data.clientes || [], transportistas: data.transportistas || [], unidades: data.unidades || [], divisas: data.divisas || [] });
    } catch (e) { console.error(e); } finally { setFiltersLoadingTn(false); }
    setLocalFiltersTn({ mes: '', semana: '', cliente: '', transportista: '', unidad: '', divisa: '' });
  };

  // Normalizar divisa a USD o PEN
  const normalizeDivisa = (divisa) => {
    if (!divisa) return 'PEN';
    const d = divisa.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (d.includes('dolar') || d.includes('dollar') || d === 'usd') return 'USD';
    if (d.includes('sol') || d === 'pen') return 'PEN';
    return 'USD';
  };

  // Helper: capitalizar correctamente textos (meses, nombres, apellidos, etc.)
  const capitalizeText = (text) => {
    if (!text) return '';
    return text
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Helper: generar filas de título y filtros para Excel
  const excelTitleRows = (title, filterObj, colCount) => {
    const titleStyle = { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1B7430' } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const filterStyle = { font: { bold: false, sz: 11, color: { rgb: '333333' } }, fill: { fgColor: { rgb: 'E8F5E9' } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const filterParts = [];
    if (filterObj.mes) filterParts.push(capitalizeText(filterObj.mes));
    if (filterObj.semana) filterParts.push(`Semana ${filterObj.semana}`);
    if (filterObj.cliente) filterParts.push(capitalizeText(filterObj.cliente));
    if (filterObj.transportista) filterParts.push(capitalizeText(filterObj.transportista));
    if (filterObj.unidad) filterParts.push(`Placa: ${filterObj.unidad.toUpperCase()}`);
    if (filterObj.divisa) filterParts.push(filterObj.divisa.toUpperCase());
    const filterText = filterParts.length > 0 ? filterParts.join(' — ') : 'Sin filtros';

    const titleRow = Array(colCount).fill({ v: '', s: titleStyle });
    titleRow[0] = { v: title, s: titleStyle };
    const filterRow = Array(colCount).fill({ v: '', s: filterStyle });
    filterRow[0] = { v: filterText, s: filterStyle };
    const emptyRow = Array(colCount).fill({ v: '' });

    return {
      rows: [titleRow, filterRow, emptyRow],
      merges: [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
      ],
    };
  };

  const getPdfSubtitle = (filterObj = {}) => {
    const filterParts = [];
    if (filterObj.mes) filterParts.push(capitalizeText(filterObj.mes));
    if (filterObj.semana) filterParts.push(`Semana ${filterObj.semana}`);
    if (filterObj.cliente) filterParts.push(capitalizeText(filterObj.cliente));
    if (filterObj.transportista) filterParts.push(capitalizeText(filterObj.transportista));
    if (filterObj.unidad) filterParts.push(`Placa: ${filterObj.unidad.toUpperCase()}`);
    if (filterObj.divisa) filterParts.push(String(filterObj.divisa).toUpperCase());
    return filterParts.length > 0 ? filterParts.join(' - ') : 'General';
  };

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

  const addPdfHeader = (pdf, title, subtitle, logoDataUrl) => {
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

  const createPrintableClone = (rootElement) => {
    const cloneRoot = rootElement.cloneNode(true);

    cloneRoot.querySelectorAll('button, .pdf-btn-wrapper, .btn-download-excel, .download-btn').forEach((btn) => btn.remove());
    cloneRoot.querySelectorAll('select').forEach((sel) => sel.remove());

    cloneRoot.querySelectorAll('.data-table td, .data-table td *, .data-table th, .data-table th *').forEach((node) => {
      node.style.color = '#1f2937';
      node.style.opacity = '1';
    });
    cloneRoot.querySelectorAll('.data-table tbody tr').forEach((row) => {
      row.style.opacity = '1';
      row.style.filter = 'none';
    });

    cloneRoot.querySelectorAll('.table-container, .chart-container').forEach((node) => {
      node.style.maxHeight = 'none';
      node.style.height = 'auto';
      node.style.overflow = 'visible';
      node.style.overflowX = 'visible';
      node.style.overflowY = 'visible';
      node.style.width = `${Math.max(node.scrollWidth, node.offsetWidth)}px`;
    });

    // Use full horizontal space for financial tables in PDF.
    cloneRoot.querySelectorAll('.table-container').forEach((node) => {
      node.style.width = '100%';
      node.style.display = 'block';
    });
    cloneRoot.querySelectorAll('.data-table').forEach((table) => {
      table.style.width = '100%';
      table.style.minWidth = '100%';
      table.style.tableLayout = 'fixed';
      table.style.borderCollapse = 'collapse';
    });
    cloneRoot.querySelectorAll('.data-table th, .data-table td').forEach((cell) => {
      cell.style.whiteSpace = 'normal';
      cell.style.wordBreak = 'break-word';
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
    return cloneRoot;
  };

  const exportVisualPdfFromElement = async ({ element, fileName, title, subtitle }) => {
    const cloneRoot = createPrintableClone(element);
    try {
      const canvas = await html2canvas(cloneRoot, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: cloneRoot.scrollWidth,
        windowHeight: cloneRoot.scrollHeight,
      });

      const logoDataUrl = await loadImageAsDataUrl(logoEmpresa).catch(() => null);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 24;
      const headerBottomY = addPdfHeader(pdf, title, subtitle, logoDataUrl);
      const availableWidth = pageWidth - marginX * 2;
      const pageContentHeight = pageHeight - headerBottomY - 16;
      const verticalCompression = 0.86;

      const imgData = canvas.toDataURL('image/png');
      let renderWidth = availableWidth;
      let renderHeight = (canvas.height * renderWidth) / canvas.width;

      // Keep full width and reduce only vertical size to avoid hard cuts.
      renderHeight = Math.min(renderHeight * verticalCompression, pageContentHeight);
      pdf.addImage(imgData, 'PNG', marginX, headerBottomY, renderWidth, renderHeight);

      pdf.save(fileName);
    } finally {
      document.body.removeChild(cloneRoot);
    }
  };

  const exportVisualPdfFromSections = async ({
    rootElement,
    sectionSelector,
    fileName,
    title,
    subtitle,
  }) => {
    const cloneRoot = createPrintableClone(rootElement);
    try {
      const sectionNodes = Array.from(cloneRoot.querySelectorAll(sectionSelector));
      const nodesToCapture = sectionNodes.length > 0 ? sectionNodes : [cloneRoot];
      const sectionCanvases = [];

      for (const section of nodesToCapture) {
        section.style.overflow = 'visible';
        section.style.maxHeight = 'none';
        section.style.height = 'auto';
        section.style.width = `${Math.max(section.scrollWidth, section.offsetWidth)}px`;

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
      const verticalCompression = 0.86;

      const headerStartY = addPdfHeader(pdf, title, subtitle, logoDataUrl);
      let y = headerStartY;

      for (const canvas of sectionCanvases) {
        const imgData = canvas.toDataURL('image/png');
        const renderWidth = availableWidth;
        let renderHeight = (canvas.height * renderWidth) / canvas.width;
        renderHeight = Math.min(renderHeight * verticalCompression, pageContentHeight);

        if (y + renderHeight > pageHeight - 16) {
          pdf.addPage();
          y = addPdfHeader(pdf, title, subtitle, logoDataUrl);
        }

        pdf.addImage(imgData, 'PNG', marginX, y, renderWidth, renderHeight);
        y += renderHeight + 12;
      }

      pdf.save(fileName);
    } finally {
      document.body.removeChild(cloneRoot);
    }
  };

  const descargarCobrarPDF = async () => {
    if (!cobrarSectionRef.current) return;
    setExportingCobrarPdf(true);
    try {
      await exportVisualPdfFromSections({
        rootElement: cobrarSectionRef.current,
        sectionSelector: '.section-card, .chart-section',
        fileName: 'Por_Cobrar.pdf',
        title: 'Por Cobrar',
        subtitle: getPdfSubtitle(localFilters),
      });
    } catch (err) { console.error('Error generando PDF:', err); }
    finally { setExportingCobrarPdf(false); }
  };

  const descargarCobrarChartPDF = async () => {
    if (!cobrarChartRef.current) return;
    setExportingCobrarChartPdf(true);
    try {
      await exportVisualPdfFromElement({
        element: cobrarChartRef.current,
        fileName: 'Grafica_Por_Cobrar.pdf',
        title: 'Grafica - Por Cobrar',
        subtitle: getPdfSubtitle(localFilters),
      });
    } catch (err) { console.error('Error generando PDF:', err); }
    finally { setExportingCobrarChartPdf(false); }
  };

  const descargarPagarChartPDF = async () => {
    if (!pagarChartRef.current) return;
    setExportingPagarChartPdf(true);
    try {
      await exportVisualPdfFromElement({
        element: pagarChartRef.current,
        fileName: 'Grafica_Por_Pagar.pdf',
        title: 'Grafica - Por Pagar',
        subtitle: getPdfSubtitle(localFiltersPagar),
      });
    } catch (err) { console.error('Error generando PDF:', err); }
    finally { setExportingPagarChartPdf(false); }
  };

  const descargarMargenChartPDF = async () => {
    if (!margenChartRef.current) return;
    setExportingMargenChartPdf(true);
    try {
      await exportVisualPdfFromElement({
        element: margenChartRef.current,
        fileName: 'Grafica_Margen_Operativo.pdf',
        title: 'Grafica - Margen Operativo',
        subtitle: getPdfSubtitle(localFiltersMargen),
      });
    } catch (err) { console.error('Error generando PDF:', err); }
    finally { setExportingMargenChartPdf(false); }
  };

  const descargarCobrarExcel = () => {
    if (porCobrar.length === 0) return;
    const wb = XLSX.utils.book_new();
    const colCount = 4;
    const { rows: titleRows, merges } = excelTitleRows('Por Cobrar', localFilters, colCount);
    const hStyle = { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1B7430' } }, alignment: { horizontal: 'center' }, border: { bottom: { style: 'medium', color: { rgb: '145A25' } } } };
    const cellL = { font: { sz: 10 }, alignment: { horizontal: 'left' }, border: { bottom: { style: 'thin', color: { rgb: 'E0E0E0' } } } };
    const cellR = { font: { sz: 10 }, alignment: { horizontal: 'right' }, numFmt: '#,##0.00', border: { bottom: { style: 'thin', color: { rgb: 'E0E0E0' } } } };
    const rows = [
      ...titleRows,
      [{ v: 'Cliente', s: hStyle }, { v: 'Empresa', s: hStyle }, { v: 'Divisa', s: hStyle }, { v: 'Por Cobrar', s: hStyle }],
      ...porCobrar.map(item => [
        { v: item.cliente || 'Sin cliente', s: cellL },
        { v: formatEmpresa(item.empresa), s: cellL },
        { v: item.divisa || 'PEN', s: cellL },
        { v: Math.round((Number(item.total) || 0) * 100) / 100, t: 'n', s: cellR },
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 10 }, { wch: 18 }];
    ws['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, ws, 'Por Cobrar');
    XLSX.writeFile(wb, 'Por_Cobrar.xlsx');
  };

  const descargarMargenPDF = async () => {
    if (!margenSectionRef.current) return;
    setExportingMargenPdf(true);
    try {
      await exportVisualPdfFromSections({
        rootElement: margenSectionRef.current,
        sectionSelector: '.section-card, .chart-section',
        fileName: 'Margen_Operativo.pdf',
        title: 'Margen Operativo',
        subtitle: getPdfSubtitle(localFiltersMargen),
      });
    } catch (err) { console.error('Error generando PDF:', err); }
    finally { setExportingMargenPdf(false); }
  };

  const descargarMargenExcel = () => {
    if (margenOperativo.length === 0) return;
    const wb = XLSX.utils.book_new();
    const colCount = 4;
    const { rows: titleRows, merges } = excelTitleRows('Margen Operativo', localFiltersMargen, colCount);
    const hStyle = { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '4A86B8' } }, alignment: { horizontal: 'center' }, border: { bottom: { style: 'medium', color: { rgb: '3A6E9A' } } } };
    const cellL = { font: { sz: 10 }, alignment: { horizontal: 'left' }, border: { bottom: { style: 'thin', color: { rgb: 'E0E0E0' } } } };
    const cellPos = { font: { sz: 10, color: { rgb: '1B7430' } }, alignment: { horizontal: 'right' }, numFmt: '#,##0.00', border: { bottom: { style: 'thin', color: { rgb: 'E0E0E0' } } } };
    const cellNeg = { font: { sz: 10, color: { rgb: 'CC3333' } }, alignment: { horizontal: 'right' }, numFmt: '#,##0.00', border: { bottom: { style: 'thin', color: { rgb: 'E0E0E0' } } } };
    const rows = [
      ...titleRows,
      [{ v: 'Cliente', s: hStyle }, { v: 'Empresa', s: hStyle }, { v: 'Divisa', s: hStyle }, { v: 'Margen Operativo', s: hStyle }],
      ...margenOperativo.map(item => {
        const val = Math.round((Number(item.total) || 0) * 100) / 100;
        return [
          { v: item.cliente || 'Sin cliente', s: cellL },
          { v: formatEmpresa(item.empresa), s: cellL },
          { v: item.divisa || 'PEN', s: cellL },
          { v: val, t: 'n', s: val >= 0 ? cellPos : cellNeg },
        ];
      })
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 10 }, { wch: 20 }];
    ws['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, ws, 'Margen Operativo');
    XLSX.writeFile(wb, 'Margen_Operativo.xlsx');
  };

  const descargarSegPDF = async () => {
    if (!segSectionRef.current) return;
    setExportingSegPdf(true);
    try {
      const sData = prepareSeguimientoData(seguimiento || []);
      const logoDataUrl = await loadImageAsDataUrl(logoEmpresa).catch(() => null);
      const title = 'Seguimiento de Transporte';
      const subtitle = getPdfSubtitle(localFiltersSeg);

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 24;
      const bottomMargin = 16;
      const headerRowHeight = 24;
      const bodyRowHeight = 18;

      const drawHeader = () => addPdfHeader(pdf, title, subtitle, logoDataUrl);
      let y = drawHeader() + 6;

      // Dynamic column widths: fixed first columns + flexible week columns.
      const fixedCliente = 170;
      const fixedEmpresa = 165;
      const fixedPlaca = 85;
      const fixedTotal = 95;
      const weeks = sData.semanas || [];
      const availableTableWidth = pageWidth - marginX * 2;
      const weekArea = Math.max(200, availableTableWidth - (fixedCliente + fixedEmpresa + fixedPlaca + fixedTotal));
      const weekWidth = weeks.length > 0 ? weekArea / weeks.length : 0;

      const columns = [
        { key: 'cliente', label: 'Cliente', width: fixedCliente },
        { key: 'empresa', label: 'Empresa', width: fixedEmpresa },
        { key: 'placa', label: 'Placa', width: fixedPlaca },
        ...weeks.map((w) => ({ key: `sem_${w}`, label: `Sem. ${w} (TN Rec.)`, width: weekWidth })),
        { key: 'total', label: 'Total (TN)', width: fixedTotal },
      ];

      const drawTableHeader = () => {
        let x = marginX;
        pdf.setFillColor(27, 116, 48);
        pdf.rect(marginX, y, availableTableWidth, headerRowHeight, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.5);

        columns.forEach((col) => {
          const text = pdf.splitTextToSize(col.label, Math.max(12, col.width - 8)).slice(0, 2);
          const line1 = text[0] || '';
          const line2 = text[1] || '';
          const centerX = x + col.width / 2;
          if (line2) {
            pdf.text(line1, centerX, y + 10, { align: 'center' });
            pdf.text(line2, centerX, y + 19, { align: 'center' });
          } else {
            pdf.text(line1, centerX, y + 15, { align: 'center' });
          }

          pdf.setDrawColor(225, 236, 228);
          pdf.line(x + col.width, y, x + col.width, y + headerRowHeight);
          x += col.width;
        });
        y += headerRowHeight;
      };

      const ensureSpace = () => {
        if (y + bodyRowHeight > pageHeight - bottomMargin) {
          pdf.addPage();
          y = drawHeader() + 6;
          drawTableHeader();
        }
      };

      drawTableHeader();

      (sData.rows || []).forEach((row, idx) => {
        ensureSpace();
        let x = marginX;

        if (idx % 2 === 1) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(marginX, y, availableTableWidth, bodyRowHeight, 'F');
        }

        const total = weeks.reduce((sum, w) => sum + (Number(row[w]) || 0), 0);
        const values = [
          row.cliente || 'Sin cliente',
          formatEmpresa(row.empresa),
          row.placa || '-',
          ...weeks.map((w) => (row[w] ? `${fmtNum(row[w])} TN` : '-')),
          `${fmtNum(total)} TN`,
        ];

        pdf.setTextColor(31, 41, 55);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);

        values.forEach((value, colIdx) => {
          const col = columns[colIdx];
          const text = pdf.splitTextToSize(String(value), col.width - 6);
          pdf.text(text[0] || '', x + 3, y + 11);
          x += col.width;
        });

        pdf.setDrawColor(230, 230, 230);
        pdf.line(marginX, y + bodyRowHeight, marginX + availableTableWidth, y + bodyRowHeight);
        y += bodyRowHeight;
      });

      pdf.save('Seguimiento_Transporte.pdf');
    } catch (err) { console.error('Error generando PDF:', err); }
    finally { setExportingSegPdf(false); }
  };

  const descargarSegExcel = () => {
    if (seguimiento.length === 0) return;
    const sData = prepareSeguimientoData(seguimiento);
    const wb = XLSX.utils.book_new();
    const hStyle = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1B7430' } }, alignment: { horizontal: 'center', wrapText: true }, border: { bottom: { style: 'medium', color: { rgb: '145A25' } } } };
    const hSem = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '4A86B8' } }, alignment: { horizontal: 'center', wrapText: true }, border: { bottom: { style: 'medium', color: { rgb: '3A6E9A' } } } };
    const hTotal = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: 'C4883A' } }, alignment: { horizontal: 'center' }, border: { bottom: { style: 'medium', color: { rgb: 'A06B2D' } } } };
    const cellL = { font: { sz: 10 }, alignment: { horizontal: 'left' }, border: { bottom: { style: 'thin', color: { rgb: 'E0E0E0' } } } };
    const cellN = { font: { sz: 10 }, alignment: { horizontal: 'right' }, numFmt: '#,##0.00', border: { bottom: { style: 'thin', color: { rgb: 'E0E0E0' } } } };
    const cellT = { font: { bold: true, sz: 10 }, alignment: { horizontal: 'right' }, numFmt: '#,##0.00', fill: { fgColor: { rgb: 'FFF8E1' } }, border: { bottom: { style: 'thin', color: { rgb: 'E0E0E0' } } } };

    const colCount = 3 + sData.semanas.length + 1;
    const { rows: titleRows, merges } = excelTitleRows('Seguimiento de Transporte', localFiltersSeg, colCount);
    const header = [
      { v: 'Cliente', s: hStyle },
      { v: 'Empresa', s: hStyle },
      { v: 'Placa', s: hStyle },
      ...sData.semanas.map(s => ({ v: `Sem. ${s} (TN Rec.)`, s: hSem })),
      { v: 'Total (TN)', s: hTotal },
    ];
    const rows = [...titleRows, header];

    for (const row of sData.rows) {
      const total = sData.semanas.reduce((sum, s) => sum + (row[s] || 0), 0);
      rows.push([
        { v: row.cliente || 'Sin cliente', s: cellL },
        { v: formatEmpresa(row.empresa), s: cellL },
        { v: row.placa || '', s: cellL },
        ...sData.semanas.map(s => row[s] ? { v: Math.round((Number(row[s]) || 0) * 100) / 100, t: 'n', s: cellN } : { v: '', s: cellL }),
        { v: Math.round(total * 100) / 100, t: 'n', s: cellT },
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 10 }, ...sData.semanas.map(() => ({ wch: 16 })), { wch: 14 }];
    ws['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, ws, 'Seguimiento');
    XLSX.writeFile(wb, 'Seguimiento_Transporte.xlsx');
  };

  const descargarPagarPDF = async () => {
    if (!pagarSectionRef.current) return;
    setExportingPagarPdf(true);
    try {
      await exportVisualPdfFromSections({
        rootElement: pagarSectionRef.current,
        sectionSelector: '.section-card, .chart-section',
        fileName: 'Por_Pagar.pdf',
        title: 'Por Pagar',
        subtitle: getPdfSubtitle(localFiltersPagar),
      });
    } catch (err) { console.error('Error generando PDF:', err); }
    finally { setExportingPagarPdf(false); }
  };

  const descargarPagarExcel = () => {
    if (porPagar.length === 0) return;
    const wb = XLSX.utils.book_new();
    const colCount = 4;
    const { rows: titleRows, merges } = excelTitleRows('Por Pagar', localFiltersPagar, colCount);
    const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1B7430' } }, alignment: { horizontal: 'center' } };
    const cellStyle = { alignment: { horizontal: 'left' } };
    const numStyle = { alignment: { horizontal: 'right' }, numFmt: '#,##0.00' };
    const filtered = porPagar.filter(item => item.empresa !== 'ECOTRANSPORTE');
    const rows = [
      ...titleRows,
      [{ v: 'Cliente', s: headerStyle }, { v: 'Empresa', s: headerStyle }, { v: 'Divisa', s: headerStyle }, { v: 'Por Pagar', s: headerStyle }],
      ...filtered.map(item => [
        { v: item.cliente || 'Sin cliente', s: cellStyle },
        { v: item.empresa || 'SIN EMPRESA', s: cellStyle },
        { v: item.divisa || 'PEN', s: cellStyle },
        { v: Math.round((Number(item.total) || 0) * 100) / 100, t: 'n', s: numStyle },
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 10 }, { wch: 18 }];
    ws['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, ws, 'Por Pagar');
    XLSX.writeFile(wb, 'Por_Pagar.xlsx');
  };

  const descargarTnPDF = async () => {
    if (!tnSectionRef.current) return;
    setExportingTnPdf(true);
    try {
      const tnTitle = localFiltersTn.mes
        ? `TN Total Recibido / Cliente - ${capitalizeText(localFiltersTn.mes)} ${new Date().getFullYear()}`
        : 'TN por Cliente';
      await exportVisualPdfFromSections({
        rootElement: tnSectionRef.current.parentElement || tnSectionRef.current,
        sectionSelector: '.section-card, .chart-section',
        fileName: 'TN_Cliente_Empresa.pdf',
        title: tnTitle,
        subtitle: getPdfSubtitle(localFiltersTn),
      });
    } catch (err) { console.error('Error generando PDF:', err); }
    finally { setExportingTnPdf(false); }
  };

  const descargarTnExcel = () => {
    if (tnClienteEmpresa.length === 0) return;
    const wb = XLSX.utils.book_new();
    const colCount = 3;
    const tnTitle = localFiltersTn.mes
      ? `TN Total Recibido / Cliente - ${capitalizeText(localFiltersTn.mes)} ${new Date().getFullYear()}`
      : 'TN por Cliente';
    const { rows: titleRows, merges } = excelTitleRows(tnTitle, localFiltersTn, colCount);
    const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1B7430' } }, alignment: { horizontal: 'center' } };
    const cellStyle = { alignment: { horizontal: 'left' } };
    const numStyle = { alignment: { horizontal: 'right' }, numFmt: '#,##0.00' };
    const rows = [
      ...titleRows,
      [{ v: 'Cliente', s: headerStyle }, { v: 'Empresa', s: headerStyle }, { v: 'Peso Ticket (TN Recibida)', s: headerStyle }],
      ...tnClienteEmpresa.map(item => [
        { v: item.cliente || 'Sin cliente', s: cellStyle },
        { v: formatEmpresa(item.empresa), s: cellStyle },
        { v: Math.round((Number(item.total) || 0) * 100) / 100, t: 'n', s: numStyle },
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 25 }];
    ws['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, ws, 'TN Cliente Empresa');
    XLSX.writeFile(wb, 'TN_Cliente_Empresa.xlsx');
  };

  const formatEmpresa = (empresa) => {
    if (!empresa || empresa === 'SIN EMPRESA') return empresa || 'SIN EMPRESA';
    if (empresa === 'ECOTRANSPORTE') return 'ECOTRANSPORTE';
    return `ECOTRANSPORTE(${empresa})`;
  };

  // Agrupar datos para gráficos jerárquicos (Cliente → Empresa)
  const prepareChartData = (data) => {
    const grouped = {};
    data.forEach(item => {
      const key = `${item.cliente}|${item.empresa}`;
      if (!grouped[key]) {
        grouped[key] = {
          label: `${item.cliente} - ${formatEmpresa(item.empresa)}`,
          cliente: item.cliente,
          empresa: item.empresa,
          PEN: 0,
          USD: 0,
        };
      }
      const divisa = normalizeDivisa(item.divisa);
      grouped[key][divisa] = (grouped[key][divisa] || 0) + parseFloat(item.total || 0);
    });
    return Object.values(grouped);
  };

  // Para Pagar: usar nombre directo de empresa (sin prefijo ECOTRANSPORTE)
  const prepareChartDataPagar = (data) => {
    const grouped = {};
    data.forEach(item => {
      if (item.empresa === 'ECOTRANSPORTE') return;
      const key = `${item.cliente}|${item.empresa}`;
      if (!grouped[key]) {
        grouped[key] = {
          label: `${item.cliente} - ${item.empresa || 'SIN EMPRESA'}`,
          cliente: item.cliente,
          empresa: item.empresa,
          PEN: 0,
          USD: 0,
        };
      }
      const divisa = normalizeDivisa(item.divisa);
      grouped[key][divisa] = (grouped[key][divisa] || 0) + parseFloat(item.total || 0);
    });
    return Object.values(grouped);
  };

  // Preparar datos para TN por Cliente/Empresa
  const prepareTnData = (data) => data.map(item => ({
    label: `${item.cliente} - ${formatEmpresa(item.empresa)}`,
    cliente: item.cliente,
    empresa: item.empresa,
    total: parseFloat(item.total || 0),
  }));

  // Preparar datos de seguimiento (pivot por semana)
  const prepareSeguimientoData = (data) => {
    const semanas = [...new Set(data.map(d => d.semana))].sort((a, b) => Number(a) - Number(b));
    const grouped = {};
    
    data.forEach(item => {
      const key = `${item.cliente}|${item.empresa}|${item.placa}`;
      if (!grouped[key]) {
        grouped[key] = {
          cliente: item.cliente,
          empresa: item.empresa,
          placa: item.placa,
        };
        semanas.forEach(s => grouped[key][s] = 0);
      }
      grouped[key][item.semana] = parseFloat(item.tn_recibida || 0);
    });
    
    return { rows: Object.values(grouped), semanas };
  };

  if (loading) {
    return <div className="loading-section"><div className="spinner"></div></div>;
  }

  const cobrarChart = prepareChartData(porCobrar);
  const pagarChart = prepareChartDataPagar(porPagar);
  const margenChart = prepareChartData(margenOperativo);
  const tnChart = prepareTnData(tnClienteEmpresa);
  const seguimientoData = prepareSeguimientoData(seguimiento);

  const tabs = [
    { id: 'cobrar', label: 'Por Cobrar' },
    { id: 'pagar', label: 'Por Pagar' },
    { id: 'margen', label: 'Margen Operativo' },
    { id: 'tonelaje', label: 'TN Cliente/Empresa' },
    { id: 'seguimiento', label: 'Seguimiento' },
  ];

  const formatCurrency = (value, divisa = 'PEN') => {
    const normalizedDivisa = normalizeDivisa(divisa);
    const symbol = normalizedDivisa === 'USD' ? '$' : 'S/';
    return `${symbol} ${fmtNum(value)}`;
  };

  const dualBarSize = isMobile ? 24 : 28;
  const dualChartHeight = (items) => Math.max(180, items.length * (isMobile ? 64 : 74) + 56);
  const dualChartMargin = { right: isMobile ? 60 : 130, left: isMobile ? 8 : 12, top: 8, bottom: 8 };
  const dualAxisWidth = isMobile ? 92 : 220;

  const singleBarSize = isMobile ? 26 : 32;
  const singleChartHeight = (items) => Math.max(180, items.length * (isMobile ? 64 : 76) + 56);
  const singleChartMargin = { right: isMobile ? 60 : 110, left: isMobile ? 8 : 12, top: 8, bottom: 8 };
  const singleAxisWidth = isMobile ? 92 : 220;

  return (
    <div className="dashboard-financiero">
      {/* Sub-tabs */}
      <div className="sub-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`sub-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Por Cobrar */}
      {activeTab === 'cobrar' && (
        <div className="financiero-section">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
            <h2 style={{margin:0}}>💵 Por Cobrar por Cliente / Empresa</h2>
            {porCobrar.length > 0 && (
              <div style={{display:'flex',gap:'8px'}}>
                <button className="btn-download-excel" onClick={descargarCobrarExcel}>📊 Excel</button>
                <button className="btn-download-pdf" onClick={descargarCobrarPDF} disabled={exportingCobrarPdf}>
                  {exportingCobrarPdf ? 'Generando...' : '📥 PDF'}
                </button>
              </div>
            )}
          </div>

          {/* Filtros */}
          <div className="section-filters">
            <div className="filter-row">
              <div className="filter-item">
                <label>Mes</label>
                <select value={localFilters.mes} onChange={e => handleFilterChange('mes', e.target.value)} disabled={filtersLoading}>
                  <option value="">Todos</option>
                  {filterOptions.meses.map(m => <option key={m} value={m}>{capitalizeText(m)}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Semana</label>
                <select value={localFilters.semana} onChange={e => handleFilterChange('semana', e.target.value)} disabled={filtersLoading}>
                  <option value="">Todas</option>
                  {filterOptions.semanas.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Cliente</label>
                <select value={localFilters.cliente} onChange={e => handleFilterChange('cliente', e.target.value)} disabled={filtersLoading}>
                  <option value="">Todos</option>
                  {filterOptions.clientes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Transportista</label>
                <select value={localFilters.transportista} onChange={e => handleFilterChange('transportista', e.target.value)} disabled={filtersLoading}>
                  <option value="">Todos</option>
                  {filterOptions.transportistas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Unidad</label>
                <select value={localFilters.unidad} onChange={e => handleFilterChange('unidad', e.target.value)} disabled={filtersLoading}>
                  <option value="">Todas</option>
                  {filterOptions.unidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Divisa</label>
                <select value={localFilters.divisa} onChange={e => handleFilterChange('divisa', e.target.value)} disabled={filtersLoading}>
                  <option value="">Todas</option>
                  {filterOptions.divisas.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <button className="btn-clear-local" onClick={clearFilters} disabled={filtersLoading}>
                {filtersLoading ? '...' : 'Limpiar'}
              </button>
            </div>
          </div>
          
          <div ref={cobrarSectionRef}>
          {/* Tabla */}
          <div className="section-card">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px',marginBottom:'8px'}}>
              <h3 style={{margin:0}}>Tabla Dinámica - Por Cobrar</h3>
              {porCobrar.length > 0 && <button className="btn-download-excel" onClick={descargarCobrarExcel} style={{padding:'5px 12px',borderRadius:'6px',border:'1px solid #1B7430',background:'#e8f5e9',color:'#1B7430',fontWeight:600,fontSize:'0.8rem',cursor:'pointer'}}>📊 Excel</button>}
            </div>
            {porCobrar.length === 0 ? (
              <p className="empty-message">No hay datos de facturación</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Empresa</th>
                      <th>Divisa</th>
                      <th>Por Cobrar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porCobrar.map((item, index) => (
                      <tr key={index}>
                        <td>{item.cliente || 'Sin cliente'}</td>
                        <td>{formatEmpresa(item.empresa)}</td>
                        <td>{item.divisa || 'PEN'}</td>
                        <td className="amount">{formatCurrency(item.total, item.divisa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Gráfico */}
          <div className="chart-section" ref={cobrarChartRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3>Gráfica - Por Cobrar</h3>
              <button className="download-btn" onClick={descargarCobrarChartPDF} disabled={exportingCobrarChartPdf || cobrarChart.length === 0}>
                {exportingCobrarChartPdf ? 'Generando...' : '📥 Descargar PDF'}
              </button>
            </div>
            <div className="chart-container">
              {cobrarChart.length === 0 ? (
                <p className="empty-message">No hay datos para graficar</p>
              ) : (
                <ResponsiveContainer width="100%" height={dualChartHeight(cobrarChart)}>
                  <BarChart data={cobrarChart} layout="vertical" barSize={dualBarSize} barCategoryGap="22%" margin={dualChartMargin}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#D7DEE7" horizontal={true} vertical={true} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="label" type="category" width={dualAxisWidth} tick={<MultiLineYAxisTick compact={isMobile} />} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (<div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 12 }}>{d.label}</p>
                        {d.USD > 0 && <p style={{ margin: '4px 0 0', color: COLORS.USD, fontSize: 12 }}>Dólares (USD): $ {fmtNum(d.USD)}</p>}
                        {d.PEN > 0 && <p style={{ margin: '4px 0 0', color: COLORS.PEN, fontSize: 12 }}>Soles (PEN): S/ {fmtNum(d.PEN)}</p>}
                      </div>);
                    }} />
                    {!isMobile && <Legend />}
                    <Bar dataKey="USD" name="Dólares (USD)" fill={COLORS.USD} shape={CobrarUsdBar} />
                    <Bar dataKey="PEN" name="Soles (PEN)" fill={COLORS.PEN} shape={CobrarPenBar} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Por Pagar */}
      {activeTab === 'pagar' && (
        <div className="financiero-section">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
            <h2 style={{margin:0}}>💸 Por Pagar por Cliente / Empresa</h2>
            {porPagar.length > 0 && (
              <div style={{display:'flex',gap:'8px'}}>
                <button className="btn-download-excel" onClick={descargarPagarExcel}>📊 Excel</button>
                <button className="btn-download-pdf" onClick={descargarPagarPDF} disabled={exportingPagarPdf}>
                  {exportingPagarPdf ? 'Generando...' : '📥 PDF'}
                </button>
              </div>
            )}
          </div>

          {/* Filtros */}
          <div className="section-filters">
            <div className="filter-row">
              <div className="filter-item">
                <label>Mes</label>
                <select value={localFiltersPagar.mes} onChange={e => handleFilterChangePagar('mes', e.target.value)} disabled={filtersLoadingPagar}>
                  <option value="">Todos</option>
                  {filterOptionsPagar.meses.map(m => <option key={m} value={m}>{capitalizeText(m)}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Semana</label>
                <select value={localFiltersPagar.semana} onChange={e => handleFilterChangePagar('semana', e.target.value)} disabled={filtersLoadingPagar}>
                  <option value="">Todas</option>
                  {filterOptionsPagar.semanas.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Cliente</label>
                <select value={localFiltersPagar.cliente} onChange={e => handleFilterChangePagar('cliente', e.target.value)} disabled={filtersLoadingPagar}>
                  <option value="">Todos</option>
                  {filterOptionsPagar.clientes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Transportista</label>
                <select value={localFiltersPagar.transportista} onChange={e => handleFilterChangePagar('transportista', e.target.value)} disabled={filtersLoadingPagar}>
                  <option value="">Todos</option>
                  {filterOptionsPagar.transportistas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Unidad</label>
                <select value={localFiltersPagar.unidad} onChange={e => handleFilterChangePagar('unidad', e.target.value)} disabled={filtersLoadingPagar}>
                  <option value="">Todas</option>
                  {filterOptionsPagar.unidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Divisa</label>
                <select value={localFiltersPagar.divisa} onChange={e => handleFilterChangePagar('divisa', e.target.value)} disabled={filtersLoadingPagar}>
                  <option value="">Todas</option>
                  {filterOptionsPagar.divisas.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <button className="btn-clear-local" onClick={clearFiltersPagar} disabled={filtersLoadingPagar}>
                {filtersLoadingPagar ? '...' : 'Limpiar'}
              </button>
            </div>
          </div>

          <div ref={pagarSectionRef}>
          <div className="section-card">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px',marginBottom:'8px'}}>
              <h3 style={{margin:0}}>Tabla Dinámica - Por Pagar</h3>
              {porPagar.length > 0 && <button className="btn-download-excel" onClick={descargarPagarExcel} style={{padding:'5px 12px',borderRadius:'6px',border:'1px solid #1B7430',background:'#e8f5e9',color:'#1B7430',fontWeight:600,fontSize:'0.8rem',cursor:'pointer'}}>📊 Excel</button>}
            </div>
            {porPagar.length === 0 ? (
              <p className="empty-message">No hay datos de pagos pendientes</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Empresa</th>
                      <th>Divisa</th>
                      <th>Por Pagar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porPagar.filter(item => item.empresa !== 'ECOTRANSPORTE').map((item, index) => (
                      <tr key={index}>
                        <td>{item.cliente || 'Sin cliente'}</td>
                        <td>{item.empresa || 'SIN EMPRESA'}</td>
                        <td>{item.divisa || 'PEN'}</td>
                        <td className="amount negative">{formatCurrency(item.total, item.divisa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="chart-section" ref={pagarChartRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3>Gráfica - Por Pagar</h3>
              <button className="download-btn" onClick={descargarPagarChartPDF} disabled={exportingPagarChartPdf || pagarChart.length === 0}>
                {exportingPagarChartPdf ? 'Generando...' : '📥 Descargar PDF'}
              </button>
            </div>
            <div className="chart-container">
              {pagarChart.length === 0 ? (
                <p className="empty-message">No hay datos para graficar</p>
              ) : (
                <ResponsiveContainer width="100%" height={dualChartHeight(pagarChart)}>
                  <BarChart data={pagarChart} layout="vertical" barSize={dualBarSize} barCategoryGap="22%" margin={dualChartMargin}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#D7DEE7" horizontal={true} vertical={true} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="label" type="category" width={dualAxisWidth} tick={<MultiLineYAxisTick compact={isMobile} />} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (<div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 12 }}>{d.label}</p>
                        {d.USD > 0 && <p style={{ margin: '4px 0 0', color: COLORS.USD, fontSize: 12 }}>Dólares (USD): $ {fmtNum(d.USD)}</p>}
                        {d.PEN > 0 && <p style={{ margin: '4px 0 0', color: COLORS.PEN, fontSize: 12 }}>Soles (PEN): S/ {fmtNum(d.PEN)}</p>}
                      </div>);
                    }} />
                    {!isMobile && <Legend />}
                    <Bar dataKey="USD" name="Dólares (USD)" fill={COLORS.USD} shape={CobrarUsdBar} />
                    <Bar dataKey="PEN" name="Soles (PEN)" fill={COLORS.PEN} shape={CobrarPenBar} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Margen Operativo */}
      {activeTab === 'margen' && (
        <div className="financiero-section">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
            <h2 style={{margin:0}}>📈 Margen Operativo por Cliente / Empresa</h2>
            {margenOperativo.length > 0 && (
              <div style={{display:'flex',gap:'8px'}}>
                <button className="btn-download-excel" onClick={descargarMargenExcel}>📊 Excel</button>
                <button className="btn-download-pdf" onClick={descargarMargenPDF} disabled={exportingMargenPdf}>
                  {exportingMargenPdf ? 'Generando...' : '📥 PDF'}
                </button>
              </div>
            )}
          </div>

          {/* Filtros */}
          <div className="section-filters">
            <div className="filter-row">
              <div className="filter-item">
                <label>Mes</label>
                <select value={localFiltersMargen.mes} onChange={e => handleFilterChangeMargen('mes', e.target.value)} disabled={filtersLoadingMargen}>
                  <option value="">Todos</option>
                  {filterOptionsMargen.meses.map(m => <option key={m} value={m}>{capitalizeText(m)}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Semana</label>
                <select value={localFiltersMargen.semana} onChange={e => handleFilterChangeMargen('semana', e.target.value)} disabled={filtersLoadingMargen}>
                  <option value="">Todas</option>
                  {filterOptionsMargen.semanas.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Cliente</label>
                <select value={localFiltersMargen.cliente} onChange={e => handleFilterChangeMargen('cliente', e.target.value)} disabled={filtersLoadingMargen}>
                  <option value="">Todos</option>
                  {filterOptionsMargen.clientes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Transportista</label>
                <select value={localFiltersMargen.transportista} onChange={e => handleFilterChangeMargen('transportista', e.target.value)} disabled={filtersLoadingMargen}>
                  <option value="">Todos</option>
                  {filterOptionsMargen.transportistas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Unidad</label>
                <select value={localFiltersMargen.unidad} onChange={e => handleFilterChangeMargen('unidad', e.target.value)} disabled={filtersLoadingMargen}>
                  <option value="">Todas</option>
                  {filterOptionsMargen.unidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Divisa</label>
                <select value={localFiltersMargen.divisa} onChange={e => handleFilterChangeMargen('divisa', e.target.value)} disabled={filtersLoadingMargen}>
                  <option value="">Todas</option>
                  {filterOptionsMargen.divisas.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <button className="btn-clear-local" onClick={clearFiltersMargen} disabled={filtersLoadingMargen}>
                {filtersLoadingMargen ? '...' : 'Limpiar'}
              </button>
            </div>
          </div>

          <div ref={margenSectionRef}>
          <div className="section-card">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px',marginBottom:'8px'}}>
              <h3 style={{margin:0}}>Tabla Dinámica - Margen Operativo (Por Cobrar - Por Pagar)</h3>
              {margenOperativo.length > 0 && <button className="btn-download-excel" onClick={descargarMargenExcel} style={{padding:'5px 12px',borderRadius:'6px',border:'1px solid #1B7430',background:'#e8f5e9',color:'#1B7430',fontWeight:600,fontSize:'0.8rem',cursor:'pointer'}}>📊 Excel</button>}
            </div>
            {margenOperativo.length === 0 ? (
              <p className="empty-message">No hay datos de margen</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Empresa</th>
                      <th>Divisa</th>
                      <th>Margen Operativo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {margenOperativo.map((item, index) => {
                      const margen = parseFloat(item.total || 0);
                      return (
                        <tr key={index}>
                          <td>{item.cliente || 'Sin cliente'}</td>
                          <td>{formatEmpresa(item.empresa)}</td>
                          <td>{item.divisa || 'PEN'}</td>
                          <td className={`amount ${margen >= 0 ? 'positive' : 'negative'}`}>
                            {formatCurrency(margen, item.divisa)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="chart-section" ref={margenChartRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3>Gráfica - Margen Operativo</h3>
              <button className="download-btn" onClick={descargarMargenChartPDF} disabled={exportingMargenChartPdf || margenChart.length === 0}>
                {exportingMargenChartPdf ? 'Generando...' : '📥 Descargar PDF'}
              </button>
            </div>
            <div className="chart-container">
              {margenChart.length === 0 ? (
                <p className="empty-message">No hay datos para graficar</p>
              ) : (
                <ResponsiveContainer width="100%" height={dualChartHeight(margenChart)}>
                  <BarChart data={margenChart} layout="vertical" barSize={dualBarSize} barCategoryGap="22%" margin={dualChartMargin}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#D7DEE7" horizontal={true} vertical={true} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="label" type="category" width={dualAxisWidth} tick={<MultiLineYAxisTick compact={isMobile} />} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (<div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 12 }}>{d.label}</p>
                        {d.USD !== 0 && <p style={{ margin: '4px 0 0', color: COLORS.USD, fontSize: 12 }}>Dólares (USD): $ {fmtNum(d.USD)}</p>}
                        {d.PEN !== 0 && <p style={{ margin: '4px 0 0', color: COLORS.PEN, fontSize: 12 }}>Soles (PEN): S/ {fmtNum(d.PEN)}</p>}
                      </div>);
                    }} />
                    {!isMobile && <Legend />}
                    <Bar dataKey="USD" name="Dólares (USD)" fill={COLORS.USD} shape={MargenUsdBar} />
                    <Bar dataKey="PEN" name="Soles (PEN)" fill={COLORS.PEN} shape={MargenPenBar} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* TN por Cliente/Empresa */}
      {activeTab === 'tonelaje' && (
        <div className="financiero-section">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
            <h2 style={{margin:0}}>⚖️ Tonelaje Recibido por Cliente / Empresa</h2>
            {tnClienteEmpresa.length > 0 && (
              <div style={{display:'flex',gap:'8px'}}>
                <button className="btn-download-excel" onClick={descargarTnExcel}>📊 Excel</button>
                <button className="btn-download-pdf" onClick={descargarTnPDF} disabled={exportingTnPdf}>
                  {exportingTnPdf ? 'Generando...' : '📥 PDF'}
                </button>
              </div>
            )}
          </div>

          {/* Filtros */}
          <div className="section-filters">
            <div className="filter-row">
              <div className="filter-item">
                <label>Mes</label>
                <select value={localFiltersTn.mes} onChange={e => handleFilterChangeTn('mes', e.target.value)} disabled={filtersLoadingTn}>
                  <option value="">Todos</option>
                  {filterOptionsTn.meses.map(m => <option key={m} value={m}>{capitalizeText(m)}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Semana</label>
                <select value={localFiltersTn.semana} onChange={e => handleFilterChangeTn('semana', e.target.value)} disabled={filtersLoadingTn}>
                  <option value="">Todas</option>
                  {filterOptionsTn.semanas.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Cliente</label>
                <select value={localFiltersTn.cliente} onChange={e => handleFilterChangeTn('cliente', e.target.value)} disabled={filtersLoadingTn}>
                  <option value="">Todos</option>
                  {filterOptionsTn.clientes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Transportista</label>
                <select value={localFiltersTn.transportista} onChange={e => handleFilterChangeTn('transportista', e.target.value)} disabled={filtersLoadingTn}>
                  <option value="">Todos</option>
                  {filterOptionsTn.transportistas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Unidad</label>
                <select value={localFiltersTn.unidad} onChange={e => handleFilterChangeTn('unidad', e.target.value)} disabled={filtersLoadingTn}>
                  <option value="">Todas</option>
                  {filterOptionsTn.unidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Divisa</label>
                <select value={localFiltersTn.divisa} onChange={e => handleFilterChangeTn('divisa', e.target.value)} disabled={filtersLoadingTn}>
                  <option value="">Todas</option>
                  {filterOptionsTn.divisas.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <button className="btn-clear-local" onClick={clearFiltersTn} disabled={filtersLoadingTn}>
                {filtersLoadingTn ? '...' : 'Limpiar'}
              </button>
            </div>
          </div>

          <div className="section-card" ref={tnSectionRef}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px',marginBottom:'8px'}}>
              <h3 style={{margin:0}}>Tabla Dinámica - Peso Ticket (TN Recibida)</h3>
              {tnClienteEmpresa.length > 0 && <button className="btn-download-excel" onClick={descargarTnExcel} style={{padding:'5px 12px',borderRadius:'6px',border:'1px solid #1B7430',background:'#e8f5e9',color:'#1B7430',fontWeight:600,fontSize:'0.8rem',cursor:'pointer'}}>📊 Excel</button>}
            </div>
            {tnClienteEmpresa.length === 0 ? (
              <p className="empty-message">No hay datos de tonelaje</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Empresa</th>
                      <th>Peso Ticket (TN Recibida)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tnClienteEmpresa.map((item, index) => (
                      <tr key={index}>
                        <td>{item.cliente || 'Sin cliente'}</td>
                        <td>{formatEmpresa(item.empresa)}</td>
                        <td>{fmtNum(item.total)} TN</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="chart-section">
            <h3>Gráfica - Peso Ticket por Cliente / Empresa</h3>
            <div className="chart-container">
              {tnChart.length === 0 ? (
                <p className="empty-message">No hay datos para graficar</p>
              ) : (
                <ResponsiveContainer width="100%" height={singleChartHeight(tnChart)}>
                  <BarChart data={tnChart} layout="vertical" barSize={singleBarSize} barCategoryGap="24%" margin={singleChartMargin}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#D7DEE7" horizontal={true} vertical={true} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="label" type="category" width={singleAxisWidth} tick={<MultiLineYAxisTick compact={isMobile} />} />
                    <Tooltip formatter={(value) => [`${fmtNum(value)} TN`, 'Tonelaje']} contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' }} />
                    {!isMobile && <Legend />}
                    <Bar dataKey="total" name="Peso Ticket" fill={COLORS.PEN} radius={[0, 6, 6, 0]}>
                      <LabelList dataKey="total" position="right" formatter={(v) => v > 0 ? `${fmtNum(v)} TN` : ''} style={{ fontSize: isMobile ? 9 : 11, fill: '#1B7430' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Seguimiento de Transporte */}
      {activeTab === 'seguimiento' && (
        <div className="financiero-section">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
            <h2 style={{margin:0}}>🚧 Seguimiento de Transporte - Peso Ticket Recibido por Semana</h2>
            {seguimiento.length > 0 && localFiltersSeg.mes && (
              <div style={{display:'flex',gap:'8px'}}>
                <button className="btn-download-excel" onClick={descargarSegExcel}>📊 Excel</button>
                <button className="btn-download-pdf" onClick={descargarSegPDF} disabled={exportingSegPdf}>
                  {exportingSegPdf ? 'Generando...' : '📥 PDF'}
                </button>
              </div>
            )}
          </div>

          {/* Filtros */}
          <div className="section-filters">
            <div className="filter-row">
              <div className="filter-item">
                <label>Mes <span className="required-badge">requerido</span></label>
                <select value={localFiltersSeg.mes} onChange={e => handleFilterChangeSeg('mes', e.target.value)} disabled={filtersLoadingSeg}>
                  <option value="">-- Selecciona un mes --</option>
                  {filterOptionsSeg.meses.map(m => <option key={m} value={m}>{capitalizeText(m)}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Semana</label>
                <select value={localFiltersSeg.semana} onChange={e => handleFilterChangeSeg('semana', e.target.value)} disabled={filtersLoadingSeg || !localFiltersSeg.mes}>
                  <option value="">Todas</option>
                  {filterOptionsSeg.semanas.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Cliente</label>
                <select value={localFiltersSeg.cliente} onChange={e => handleFilterChangeSeg('cliente', e.target.value)} disabled={filtersLoadingSeg || !localFiltersSeg.mes}>
                  <option value="">Todos</option>
                  {filterOptionsSeg.clientes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Unidad</label>
                <select value={localFiltersSeg.unidad} onChange={e => handleFilterChangeSeg('unidad', e.target.value)} disabled={filtersLoadingSeg || !localFiltersSeg.mes}>
                  <option value="">Todas</option>
                  {filterOptionsSeg.unidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <button className="btn-clear-local" onClick={clearFiltersSeg} disabled={filtersLoadingSeg}>
                {filtersLoadingSeg ? '...' : 'Limpiar'}
              </button>
            </div>
          </div>

          <div className="section-card full-width" ref={segSectionRef}>
            <h3>Tabla de Seguimiento - Tonelaje <span style={{color:'#1B7430'}}>Recibido</span> (Cliente → Empresa → Unidad → Semana)</h3>
            {!localFiltersSeg.mes ? (
              <p className="empty-message">📅 Selecciona un <strong>mes</strong> para generar la tabla de seguimiento.</p>
            ) : seguimiento.length === 0 ? (
              <p className="empty-message">No hay datos de seguimiento para los filtros seleccionados</p>
            ) : (
              <div className="table-container seguimiento-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Empresa</th>
                      <th>Placa</th>
                      {seguimientoData.semanas.map(semana => (
                        <th key={semana}>Sem. {semana} <span style={{fontWeight:400,fontSize:'0.75rem'}}>(TN Rec.)</span></th>
                      ))}
                      <th>Total (TN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seguimientoData.rows.map((row, index) => {
                      const total = seguimientoData.semanas.reduce((sum, s) => sum + (row[s] || 0), 0);
                      return (
                        <tr key={index}>
                          <td>{row.cliente || 'Sin cliente'}</td>
                          <td>{formatEmpresa(row.empresa)}</td>
                          <td>{row.placa}</td>
                          {seguimientoData.semanas.map(semana => (
                            <td key={semana} className="number" style={{whiteSpace:'nowrap'}}>
                              {row[semana] ? `${fmtNum(row[semana])} TN` : '-'}
                            </td>
                          ))}
                          <td className="total" style={{whiteSpace:'nowrap'}}>{fmtNum(total)} TN</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFinanciero;
