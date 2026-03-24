import { Fragment, useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import XLSX from 'xlsx-js-style';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { dashboardService } from '../../services/api';
import './TablasDetalladasModal.css';

const TablasDetalladasModal = ({ isOpen, onClose, mesesDisponibles }) => {
  const [mes, setMes] = useState('');
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [semana, setSemana] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef();
  const ventaTableRef = useRef();
  const costoTableRef = useRef();
  const margenTableRef = useRef();

  // Sync column widths across all 3 tables so they align
  const syncColumnWidths = useCallback(() => {
    const tables = [ventaTableRef.current, costoTableRef.current, margenTableRef.current].filter(Boolean);
    if (tables.length < 2) return;

    // Reset widths first so auto-layout recalculates
    tables.forEach(table => {
      const cells = table.querySelectorAll('thead tr:first-child th');
      cells.forEach(cell => { cell.style.minWidth = ''; });
    });

    // Force reflow
    void document.body.offsetHeight;

    // Measure the max width for each column position across all tables
    const maxCols = Math.max(...tables.map(t => t.querySelectorAll('thead tr:first-child th').length));
    const maxWidths = new Array(maxCols).fill(0);

    tables.forEach(table => {
      const headerCells = table.querySelectorAll('thead tr:first-child th');
      headerCells.forEach((cell, i) => {
        const w = cell.getBoundingClientRect().width;
        if (w > maxWidths[i]) maxWidths[i] = w;
      });
    });

    // Apply max widths to all tables
    tables.forEach(table => {
      const headerCells = table.querySelectorAll('thead tr:first-child th');
      headerCells.forEach((cell, i) => {
        if (maxWidths[i]) cell.style.minWidth = `${Math.ceil(maxWidths[i])}px`;
      });
    });
  }, []);

  useEffect(() => {
    if (data && !loading) {
      // Wait for DOM to update then sync
      const timer = setTimeout(syncColumnWidths, 50);
      return () => clearTimeout(timer);
    }
  }, [data, loading, empresaFiltro, syncColumnWidths]);

  useEffect(() => {
    if (isOpen && mesesDisponibles.length > 0 && !mes) {
      setMes(mesesDisponibles[0]);
    }
  }, [isOpen, mesesDisponibles]);

  // Cuando cambia el mes, resetear semana y recargar con mes nuevo
  useEffect(() => {
    if (mes) {
      setSemana('');
      loadData(mes, '');
    }
  }, [mes]);

  const handleSemanaChange = (nuevaSemana) => {
    setSemana(nuevaSemana);
    loadData(mes, nuevaSemana || undefined);
  };

  const loadData = async (mesParam, semanaParam) => {
    setLoading(true);
    try {
      const result = await dashboardService.getTablasDetalladas(mesParam, semanaParam || undefined);
      setData(result);
    } catch (error) {
      console.error('Error cargando tablas detalladas:', error);
    } finally {
      setLoading(false);
    }
  };

  const [exportingPdf, setExportingPdf] = useState(false);

  const handleDownloadPDF = async () => {
    const content = printRef.current;
    if (!content) return;
    setExportingPdf(true);
    try {
      const capitalizeText = (text) => {
        if (!text) return '';
        return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      };
      const filterParts = [];
      if (mes) filterParts.push(capitalizeText(mes));
      if (empresaFiltro) filterParts.push(empresaFiltro);
      if (semana) filterParts.push(`Semana ${semana}`);
      const subtitle = filterParts.length > 0 ? filterParts.join(' — ') : 'General';

      // Inject title
      const titleDiv = document.createElement('div');
      titleDiv.style.cssText = 'text-align:center;padding:20px 0 14px;border-bottom:3px solid #1B7430;margin-bottom:14px;';
      titleDiv.innerHTML = `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:28px;font-weight:800;color:#1B7430;letter-spacing:0.5px;">Reporte Detallado</div><div style="font-family:'Segoe UI',Arial,sans-serif;font-size:18px;color:#333;margin-top:8px;font-weight:500;letter-spacing:0.3px;">${subtitle}</div>`;
      content.insertBefore(titleDiv, content.firstChild);

      // Temporarily expand the scroll container so nothing is clipped
      const scrollContainer = content.querySelector('.tabla-scroll-container');
      let prevOverflow, prevMaxHeight;
      if (scrollContainer) {
        prevOverflow = scrollContainer.style.overflow;
        prevMaxHeight = scrollContainer.style.maxHeight;
        scrollContainer.style.overflow = 'visible';
        scrollContainer.style.maxHeight = 'none';
      }

      const canvas = await html2canvas(content, { scale: 2, useCORS: true, backgroundColor: '#fff', scrollX: 0, scrollY: 0, windowWidth: content.scrollWidth + 40 });

      // Restore
      content.removeChild(titleDiv);
      if (scrollContainer) {
        scrollContainer.style.overflow = prevOverflow;
        scrollContainer.style.maxHeight = prevMaxHeight;
      }

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Reporte_Detallado_${mes || 'general'}.pdf`);
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!data) return;
    const empresas = empresaFiltro
      ? data.empresas.filter(e => e === empresaFiltro)
      : data.empresas;
    const semanaLabel = semana ? `Semana ${semana}` : 'Todo el mes';
    const titulo = `Reporte Detallado — ${mes.toUpperCase()}${semana ? ` · Semana ${semana}` : ''}`;

    const border = { border: { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } } };
    const titleStyle = { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E3D2C' } }, alignment: { horizontal: 'center' } };
    const infoStyle = { font: { bold: true, sz: 10, color: { rgb: '333333' } } };
    const hCliente = { font: { bold: true, sz: 9, color: { rgb: '173324' } }, fill: { fgColor: { rgb: '96D9B8' } }, alignment: { horizontal: 'left', wrapText: true }, ...border };
    const hGeneral = { font: { bold: true, sz: 9, color: { rgb: '1E2F5C' } }, fill: { fgColor: { rgb: 'A3BFFA' } }, alignment: { horizontal: 'center', wrapText: true }, ...border };
    const empColors = ['C4A8F0', 'FAC98A', 'F5A3A8', 'A8C8DC'];
    const empFonts = ['2E2048', '3D2200', '3D1018', '1A3040'];
    const cellLeft = { ...border, font: { sz: 9 }, alignment: { horizontal: 'left' } };
    const cellRight = { ...border, font: { sz: 9 }, alignment: { horizontal: 'right' }, numFmt: '#,##0.00' };
    const clienteRowStyle = { font: { bold: true, sz: 10, color: { rgb: '1E2A3A' } }, fill: { fgColor: { rgb: 'C5D0E0' } }, alignment: { horizontal: 'left' }, ...border };
    const materialStyle = { font: { sz: 9 }, alignment: { horizontal: 'left' }, ...border };
    const totalRowStyle = { font: { bold: true, sz: 10, color: { rgb: '1E3D2C' } }, fill: { fgColor: { rgb: 'A8DBC0' } }, alignment: { horizontal: 'right' }, numFmt: '#,##0.00', ...border };
    const totalLabelStyle = { ...totalRowStyle, alignment: { horizontal: 'left' } };
    const white = { font: { sz: 9 } };

    const buildSheet = (type) => {
      const colCount = 3 + empresas.length * 2;
      const rows = [];

      // Título
      const titleRow = Array(colCount).fill({ v: '', s: titleStyle });
      titleRow[0] = { v: titulo, s: titleStyle };
      rows.push(titleRow);

      // Info
      const info = Array(colCount).fill({ v: '', s: white });
      info[0] = { v: `Mes: ${mes}`, s: infoStyle };
      info[1] = { v: `${semanaLabel}`, s: infoStyle };
      info[2] = { v: `Empresa: ${empresaFiltro || 'Todas'}`, s: infoStyle };
      rows.push(info);
      rows.push(Array(colCount).fill({ v: '', s: white }));

      // Headers
      const header = [];
      header.push({ v: 'Cliente / Material', s: hCliente });
      header.push({ v: 'General TNE', s: hGeneral });
      header.push({ v: 'General Importe', s: hGeneral });
      empresas.forEach((emp, i) => {
        const empStyle = { font: { bold: true, sz: 9, color: { rgb: empFonts[i % empFonts.length] } }, fill: { fgColor: { rgb: empColors[i % empColors.length] } }, alignment: { horizontal: 'center', wrapText: true }, ...border };
        header.push({ v: `${emp} TNE`, s: empStyle });
        header.push({ v: `${emp} Importe`, s: empStyle });
      });
      rows.push(header);

      // Data
      for (const grupo of data.grupos) {
        const cRow = Array(colCount).fill({ v: '', s: clienteRowStyle });
        cRow[0] = { v: `▶ ${grupo.cliente}`, s: clienteRowStyle };
        rows.push(cRow);

        for (const mat of grupo.materiales) {
          const row = [];
          row.push({ v: `  ${mat.label}`, s: materialStyle });
          row.push({ v: Math.round((Number(mat.data.general.tne) || 0) * 100) / 100, t: 'n', s: cellRight });
          row.push({ v: Math.round((Number(type === 'venta' ? mat.data.general.importeVenta : mat.data.general.importeCosto) || 0) * 100) / 100, t: 'n', s: cellRight });
          for (const emp of empresas) {
            const d = mat.data[emp] || { tne: 0, importeVenta: 0, importeCosto: 0 };
            row.push({ v: Math.round((Number(d.tne) || 0) * 100) / 100, t: 'n', s: cellRight });
            row.push({ v: Math.round((Number(type === 'venta' ? d.importeVenta : d.importeCosto) || 0) * 100) / 100, t: 'n', s: cellRight });
          }
          rows.push(row);
        }
      }

      // Totales
      for (const [div, label] of [['USD', 'Total Dólares (USD)'], ['PEN', 'Total Soles (PEN)']]) {
        const tot = data.totales[div];
        const row = [];
        row.push({ v: label, s: totalLabelStyle });
        row.push({ v: Math.round((Number(tot.general.tne) || 0) * 100) / 100, t: 'n', s: totalRowStyle });
        row.push({ v: Math.round((Number(type === 'venta' ? tot.general.importeVenta : tot.general.importeCosto) || 0) * 100) / 100, t: 'n', s: totalRowStyle });
        for (const emp of empresas) {
          const d = tot[emp] || { tne: 0, importeVenta: 0, importeCosto: 0 };
          row.push({ v: Math.round((Number(d.tne) || 0) * 100) / 100, t: 'n', s: totalRowStyle });
          row.push({ v: Math.round((Number(type === 'venta' ? d.importeVenta : d.importeCosto) || 0) * 100) / 100, t: 'n', s: totalRowStyle });
        }
        rows.push(row);
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      // Anchos
      const cols = [{ wch: 30 }, { wch: 14 }, { wch: 14 }];
      empresas.forEach(() => { cols.push({ wch: 14 }, { wch: 14 }); });
      ws['!cols'] = cols;
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }];
      return ws;
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildSheet('venta'), 'Venta');
    XLSX.utils.book_append_sheet(wb, buildSheet('costo'), 'Costo');

    // Hoja Margen
    const colCount = 2 + empresas.length;
    const margenRows = [];
    const mTitleRow = Array(colCount).fill({ v: '', s: titleStyle });
    mTitleRow[0] = { v: titulo, s: titleStyle };
    margenRows.push(mTitleRow);

    const mInfo = Array(colCount).fill({ v: '', s: white });
    mInfo[0] = { v: `Mes: ${mes}`, s: infoStyle };
    mInfo[1] = { v: `${semanaLabel}`, s: infoStyle };
    margenRows.push(mInfo);
    margenRows.push(Array(colCount).fill({ v: '', s: white }));

    const mLabel = Array(colCount).fill({ v: '', s: { font: { bold: true, sz: 12, color: { rgb: '1E3D2C' } } } });
    mLabel[0] = { v: 'Margen de Ganancia', s: mLabel[0].s };
    margenRows.push(mLabel);

    const mHeader = [{ v: 'Concepto', s: hCliente }, { v: 'General', s: hGeneral }];
    empresas.forEach((emp, i) => {
      const empStyle = { font: { bold: true, sz: 9, color: { rgb: empFonts[i % empFonts.length] } }, fill: { fgColor: { rgb: empColors[i % empColors.length] } }, alignment: { horizontal: 'center', wrapText: true }, ...border };
      mHeader.push({ v: emp, s: empStyle });
    });
    margenRows.push(mHeader);

    for (const [div, label] of [['USD', 'Dólares (USD)'], ['PEN', 'Soles (PEN)']]) {
      const row = [{ v: label, s: totalLabelStyle }, { v: Math.round((Number(data.margen[div].general.margen) || 0) * 100) / 100, t: 'n', s: totalRowStyle }];
      for (const emp of empresas) row.push({ v: Math.round((Number((data.margen[div][emp] || { margen: 0 }).margen) || 0) * 100) / 100, t: 'n', s: totalRowStyle });
      margenRows.push(row);
    }

    const margenWs = XLSX.utils.aoa_to_sheet(margenRows);
    const mCols = [{ wch: 25 }, { wch: 14 }];
    empresas.forEach(() => mCols.push({ wch: 14 }));
    margenWs['!cols'] = mCols;
    margenWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }];
    XLSX.utils.book_append_sheet(wb, margenWs, 'Margen');

    const fileName = `Tablas_Detalladas_${mes.toUpperCase()}${semana ? `_Sem${semana}` : ''}${empresaFiltro ? `_${empresaFiltro.replace(/\s+/g, '_')}` : ''}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (!isOpen) return null;

  const formatNum = (n) => {
    const val = Number(n) || 0;
    return val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatEmpresa = (empresa) => {
    if (!empresa || empresa === 'SIN EMPRESA') return empresa || 'SIN EMPRESA';
    if (empresa === 'ECOTRANSPORTE') return 'ECOTRANSPORTE';
    return `ECOTRANSPORTE(${empresa})`;
  };

  const renderTable = (title, type, useFormatEmpresa = false) => {
    if (!data) return null;
    const { grupos, totales } = data;
    const empresas = empresaFiltro
      ? data.empresas.filter(e => e === empresaFiltro)
      : data.empresas;

    return (
      <div className="tabla-detallada-section">
        <h2>{title}</h2>
          <table className="tabla-detallada" ref={type === 'venta' ? ventaTableRef : costoTableRef}>
            <thead>
              <tr>
                <th className="col-cliente" rowSpan={2}>Cliente</th>
                <th className="col-general" colSpan={2}>General</th>
                {empresas.map((emp, idx) => (
                  <th key={emp} className={`col-empresa-${idx % 4}`} colSpan={2}>{useFormatEmpresa ? formatEmpresa(emp) : emp}</th>
                ))}
              </tr>
              <tr>
                <th className="col-general">TNE</th>
                <th className="col-general">Importe</th>
                {empresas.map((emp, idx) => (
                  <th key={`${emp}-tne`} className={`col-empresa-${idx % 4}`}>TNE</th>
                )).flatMap((el, i) => [el, <th key={`${empresas[i]}-imp`} className={`col-empresa-${i % 4}`}>Importe</th>])}
              </tr>
            </thead>
            <tbody>
              {grupos.map((grupo, gIdx) => (
                <Fragment key={`grupo-${gIdx}-${grupo.cliente}`}>
                  {/* Fila encabezado del cliente */}
                  <tr key={`cliente-${gIdx}`} className="fila-cliente-header">
                    <td className="col-cliente" colSpan={3 + empresas.length * 2}>
                      {grupo.cliente}
                    </td>
                  </tr>
                  {/* Filas de materiales */}
                  {grupo.materiales.map((mat, mIdx) => (
                    <tr key={`mat-${gIdx}-${mIdx}`}>
                      <td className="col-cliente col-material">{mat.label}</td>
                      <td>{formatNum(mat.data.general.tne)} TN</td>
                      <td>{mat.divisa === 'PEN' ? 'S/' : '$'}{formatNum(type === 'venta' ? mat.data.general.importeVenta : mat.data.general.importeCosto)}</td>
                      {empresas.map(emp => {
                        const d = mat.data[emp] || { tne: 0, importeVenta: 0, importeCosto: 0 };
                        return [
                          <td key={`${emp}-${gIdx}-${mIdx}-tne`}>{formatNum(d.tne)} TN</td>,
                          <td key={`${emp}-${gIdx}-${mIdx}-imp`}>{mat.divisa === 'PEN' ? 'S/' : '$'}{formatNum(type === 'venta' ? d.importeVenta : d.importeCosto)}</td>,
                        ];
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
              {/* Total Dólares */}
              <tr className="fila-total">
                <td className="col-cliente">Total Dólares (USD)</td>
                <td>{formatNum(totales.USD.general.tne)} TN</td>
                <td>${formatNum(type === 'venta' ? totales.USD.general.importeVenta : totales.USD.general.importeCosto)}</td>
                {empresas.map(emp => {
                  const d = totales.USD[emp] || { tne: 0, importeVenta: 0, importeCosto: 0 };
                  return [
                    <td key={`usd-${emp}-tne`}>{formatNum(d.tne)} TN</td>,
                    <td key={`usd-${emp}-imp`}>${formatNum(type === 'venta' ? d.importeVenta : d.importeCosto)}</td>,
                  ];
                })}
              </tr>
              {/* Total Soles */}
              <tr className="fila-total">
                <td className="col-cliente">Total Soles (PEN)</td>
                <td>{formatNum(totales.PEN.general.tne)} TN</td>
                <td>S/{formatNum(type === 'venta' ? totales.PEN.general.importeVenta : totales.PEN.general.importeCosto)}</td>
                {empresas.map(emp => {
                  const d = totales.PEN[emp] || { tne: 0, importeVenta: 0, importeCosto: 0 };
                  return [
                    <td key={`pen-${emp}-tne`}>{formatNum(d.tne)} TN</td>,
                    <td key={`pen-${emp}-imp`}>S/{formatNum(type === 'venta' ? d.importeVenta : d.importeCosto)}</td>,
                  ];
                })}
              </tr>
            </tbody>
          </table>
      </div>
    );
  };

  const renderMargen = () => {
    if (!data) return null;
    const { margen } = data;
    const empresas = empresaFiltro
      ? data.empresas.filter(e => e === empresaFiltro)
      : data.empresas;

    return (
      <div className="tabla-detallada-section margen-section">
        <h2>Margen de Ganancia</h2>
          <table className="tabla-detallada margen-table" ref={margenTableRef}>
            <thead>
              <tr>
                <th className="col-cliente" rowSpan={2}>Concepto</th>
                <th className="col-general" colSpan={2}>General</th>
                {empresas.map((emp, idx) => (
                  <th key={emp} className={`col-empresa-${idx % 4}`} colSpan={2}>{formatEmpresa(emp)}</th>
                ))}
              </tr>
              <tr>
                <th className="col-general"></th>
                <th className="col-general"></th>
                {empresas.map((emp, idx) => [
                  <th key={`${emp}-a`} className={`col-empresa-${idx % 4}`}></th>,
                  <th key={`${emp}-b`} className={`col-empresa-${idx % 4}`}></th>,
                ])}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="col-cliente">Dólares (USD)</td>
                <td colSpan={2}>${formatNum(margen.USD.general.margen)}</td>
                {empresas.map(emp => (
                  <td key={`usd-${emp}`} colSpan={2}>${formatNum((margen.USD[emp] || { margen: 0 }).margen)}</td>
                ))}
              </tr>
              <tr>
                <td className="col-cliente">Soles (PEN)</td>
                <td colSpan={2}>S/{formatNum(margen.PEN.general.margen)}</td>
                {empresas.map(emp => (
                  <td key={`pen-${emp}`} colSpan={2}>S/{formatNum((margen.PEN[emp] || { margen: 0 }).margen)}</td>
                ))}
              </tr>
            </tbody>
          </table>
      </div>
    );
  };

  return (
    <div className="tablas-modal-overlay" onClick={onClose}>
      <div className="tablas-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tablas-modal-header">
          <div className="tablas-modal-title">
            <h1>Tablas Detalladas</h1>
            <div className="tablas-modal-filter">
              <label>Mes:</label>
              <select value={mes} onChange={(e) => setMes(e.target.value)}>
                {mesesDisponibles.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {data && data.semanasDisponibles && data.semanasDisponibles.length > 0 && (
                <>
                  <label>Semana:</label>
                  <select value={semana} onChange={(e) => handleSemanaChange(e.target.value)}>
                    <option value="">Todo el mes</option>
                    {data.semanasDisponibles.map(s => (
                      <option key={s} value={s}>Semana {s}</option>
                    ))}
                  </select>
                </>
              )}
              {data && data.empresas.length > 0 && (
                <>
                  <label>Empresa de Transporte:</label>
                  <select value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)}>
                    <option value="">Todas</option>
                    {data.empresas.map(emp => (
                      <option key={emp} value={emp}>{emp}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
          <div className="tablas-modal-actions">
            <button className="btn-download-excel" onClick={handleDownloadExcel} disabled={loading || !data}>
              📊 Descargar Excel
            </button>
            <button className="btn-download-pdf" onClick={handleDownloadPDF} disabled={loading || !data || exportingPdf}>
              {exportingPdf ? 'Generando...' : '📥 Descargar PDF'}
            </button>
            <button className="btn-close-modal" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="tablas-modal-body">
          {loading ? (
            <div className="loading-section"><div className="spinner"></div><p>Cargando datos...</p></div>
          ) : !data ? (
            <div className="empty-section">Selecciona un mes para ver los datos</div>
          ) : (
            <>
              <div ref={printRef}>
                <h3 style={{ textAlign: 'center', marginBottom: 14, fontSize: '1.1rem', fontWeight: 700, color: '#1a2332', letterSpacing: '0.02em' }}>
                  Reporte Detallado — <span style={{ textTransform: 'uppercase', color: '#2D8F4E', fontWeight: 800 }}>{mes}</span>
                  {semana && <span style={{ color: '#1a6fa8', fontWeight: 700 }}> · Semana {semana}</span>}
                </h3>
                <div className="tabla-scroll-container">
                  {renderTable('Tabla de Venta (Precio Unitario × Peso Ticket)', 'venta', true)}
                  {renderTable('Tabla de Costo (Precio Costo × Peso Ticket)', 'costo', true)}
                  {renderMargen()}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TablasDetalladasModal;
