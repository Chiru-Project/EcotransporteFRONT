import { useState, useEffect, useRef } from 'react';
import XLSX from 'xlsx-js-style';
import { dashboardService } from '../../services/api';
import './ReporteGuiasModal.css';

const ReporteGuiasModal = ({ isOpen, onClose }) => {
  const [empresas, setEmpresas] = useState([]);
  const [meses, setMeses] = useState([]);
  const [empresa, setEmpresa] = useState('');
  const [mes, setMes] = useState('');
  const [semana, setSemana] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingOpciones, setLoadingOpciones] = useState(false);
  const printRef = useRef();

  useEffect(() => {
    if (isOpen) {
      loadOpciones();
    }
  }, [isOpen]);

  const loadOpciones = async () => {
    setLoadingOpciones(true);
    try {
      const result = await dashboardService.getReporteGuiasOpciones();
      setEmpresas(result.empresas || []);
      setMeses(result.meses || []);
    } catch (error) {
      console.error('Error cargando opciones:', error);
    } finally {
      setLoadingOpciones(false);
    }
  };

  const canGenerate = empresa && mes;

  const handleGenerar = async (semanaParam) => {
    if (!canGenerate) return;
    setLoading(true);
    try {
      const result = await dashboardService.getReporteGuias({ empresa, mes, semana: semanaParam });
      setData(result);
    } catch (error) {
      console.error('Error generando reporte:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSemanaChange = (nuevaSemana) => {
    setSemana(nuevaSemana);
    handleGenerar(nuevaSemana || undefined);
  };

  const handleDownloadPDF = () => {
    const content = printRef.current;
    if (!content) return;
    const semanaLabel = semana ? ` — Semana ${semana}` : '';
    const filterParts = [];
    if (empresa) filterParts.push(empresa);
    if (mes) filterParts.push(mes);
    if (semana) filterParts.push(`Semana ${semana}`);
    const subtitle = filterParts.length > 0 ? filterParts.join(' — ') : 'General';
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
      <head>
        <title>${empresa} - Guías Emitidas - ${mes}${semanaLabel}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 12px; font-size: 8px; }
          .pdf-title { text-align: center; padding: 16px 0 12px; border-bottom: 2px solid #1B7430; margin-bottom: 12px; }
          .pdf-title h1 { font-size: 22px; font-weight: 800; color: #1B7430; margin: 0; }
          .pdf-title p { font-size: 14px; color: #333; margin: 6px 0 0; }
          h2 { font-size: 13px; margin: 12px 0 6px 0; color: #1a1a1a; text-align: center; }
          h3 { font-size: 11px; margin: 8px 0 4px 0; color: #0F172A; }
          h4 { font-size: 10px; margin: 4px 0; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 7.5px; }
          th, td { border: 1px solid #E2E8F0; padding: 2px 4px; text-align: right; }
          th { background: #1B7430; color: white; font-weight: 600; text-align: center; }
          th.col-info { background: #2563EB; border-color: #1D4ED8; }
          th.col-peso { background: #5B21B6; border-color: #4C1D95; }
          th.col-ref { background: #B45309; border-color: #92400E; }
          th.col-cliente { background: #145524; border-color: #0D3D19; }
          th.col-money { background: #7F1D1D; border-color: #691B1B; }
          td.col-left { text-align: left; }
          tr.fila-subtotal { background: #F1F5F9; font-weight: 700; }
          tr.fila-total { background: #E2E8F0; font-weight: 700; }
          .totales-moneda { margin-top: 4px; font-size: 9px; font-weight: 700; }
          @media print { body { padding: 6px; } @page { size: landscape; margin: 8mm; } }
        </style>
      </head>
      <body>
        <div class="pdf-title"><h1>Reporte de Guías Emitidas</h1><p>${subtitle}</p></div>
        ${content.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const handleDownloadExcel = () => {
    if (!data || data.error) return;

    const white = { font: { sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' } };
    const bold = { font: { bold: true, sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' } };
    const titleStyle = { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1B7430' } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const hInfo = { font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2563EB' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const hPeso = { ...hInfo, fill: { fgColor: { rgb: '5B21B6' } } };
    const hRef = { ...hInfo, fill: { fgColor: { rgb: 'B45309' } } };
    const hCliente = { ...hInfo, fill: { fgColor: { rgb: '145524' } } };
    const hMoney = { ...hInfo, fill: { fgColor: { rgb: '7F1D1D' } } };
    const border = { border: { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } } };
    const cellCenter = { ...border, font: { sz: 9 }, alignment: { horizontal: 'center', vertical: 'center' } };
    const cellNum = { ...border, font: { sz: 9 }, alignment: { horizontal: 'center', vertical: 'center' }, numFmt: '#,##0.00' };
    const placaStyle = { font: { bold: true, sz: 10, color: { rgb: '1B7430' } }, fill: { fgColor: { rgb: 'E8F5E9' } }, alignment: { horizontal: 'left', vertical: 'center' } };
    const semanaStyle = { font: { bold: true, sz: 9, color: { rgb: '555555' } }, fill: { fgColor: { rgb: 'F8F9FA' } }, alignment: { horizontal: 'left', vertical: 'center' } };
    const subtotalStyle = { font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: 'F1F5F9' } }, alignment: { horizontal: 'center', vertical: 'center' }, numFmt: '#,##0.00', border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const totalStyle = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'E2E8F0' } }, alignment: { horizontal: 'center', vertical: 'center' }, numFmt: '#,##0.00', border: { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const totalLabelStyle = { ...totalStyle, alignment: { horizontal: 'left', vertical: 'center' } };

    const COLS = 13;
    const rows = [];
    const merges = [];

    // Título
    const titleRow = Array(COLS).fill({ v: '', s: titleStyle });
    titleRow[0] = { v: `${data.empresa} — TRANSPORTE SEGÚN GUÍAS EMITIDAS`, s: titleStyle };
    rows.push(titleRow);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } });

    // Info
    const infoRow = Array(COLS).fill({ v: '', s: white });
    infoRow[0] = { v: 'Mes:', s: bold };
    infoRow[1] = { v: data.mes, s: white };
    infoRow[2] = { v: semana ? `Semana: ${semana}` : 'Todo el mes', s: white };
    infoRow[4] = { v: 'Empresa de Transporte:', s: bold };
    infoRow[7] = { v: empresa === 'TODAS' ? 'Todas las empresas' : data.empresa, s: white };
    merges.push({ s: { r: rows.length, c: 4 }, e: { r: rows.length, c: 6 } });
    merges.push({ s: { r: rows.length, c: 7 }, e: { r: rows.length, c: 9 } });
    rows.push(infoRow);
    rows.push(Array(COLS).fill({ v: '', s: white }));

    // Headers
    const headerStyles = [hInfo, hInfo, hInfo, hPeso, hPeso, hRef, hRef, hCliente, hCliente, hCliente, hMoney, hInfo, hMoney];
    const headerLabels = ['Fecha', 'Guía (Transp.)', 'Conductor', 'TN Enviada', 'TN Recibida', 'N° Ticket', 'Guía (Remit.)', 'Cliente', 'Recorrido', 'Material', 'Precio IGV', 'Divisa', 'Importe Total'];
    rows.push(headerLabels.map((h, i) => ({ v: h, s: headerStyles[i] })));

    for (const bloque of data.bloques) {
      // Empresa header (when TODAS)
      if (empresa === 'TODAS' && bloque.empresaNombre) {
        const prevBloque = data.bloques[data.bloques.indexOf(bloque) - 1];
        if (!prevBloque || prevBloque.empresaNombre !== bloque.empresaNombre) {
          const empresaRow = Array(COLS).fill({ v: '', s: { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0D3D19' } } } });
          empresaRow[0] = { v: `▶ ${bloque.empresaNombre}`, s: { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0D3D19' } }, alignment: { horizontal: 'left', vertical: 'center' } } };
          merges.push({ s: { r: rows.length, c: 0 }, e: { r: rows.length, c: COLS - 1 } });
          rows.push(empresaRow);
        }
      }

      // Placa header
      const placaRow = Array(COLS).fill({ v: '', s: placaStyle });
      placaRow[0] = { v: `▶ UNIDAD: ${bloque.placa}`, s: placaStyle };
      merges.push({ s: { r: rows.length, c: 0 }, e: { r: rows.length, c: COLS - 1 } });
      rows.push(placaRow);

      for (const sem of bloque.semanas) {
        // Semana label
        const semRow = Array(COLS).fill({ v: '', s: semanaStyle });
        semRow[0] = { v: `  ${sem.semana}`, s: semanaStyle };
        merges.push({ s: { r: rows.length, c: 0 }, e: { r: rows.length, c: COLS - 1 } });
        rows.push(semRow);

        for (const v of sem.viajes) {
          const fechaStr = v.fecha ? String(v.fecha).substring(0, 10) : '';
          rows.push([
            { v: fechaStr, s: cellCenter },
            { v: v.grt || '', s: cellCenter },
            { v: v.conductor || '', s: cellCenter },
            { v: Math.round((Number(v.peso) || 0) * 100) / 100, t: 'n', s: cellNum },
            { v: Math.round((Number(v.pesoMina) || 0) * 100) / 100, t: 'n', s: cellNum },
            { v: v.ticket || '', s: cellCenter },
            { v: v.grr || '', s: cellCenter },
            { v: v.cliente || '', s: cellCenter },
            { v: v.recorrido || '', s: cellCenter },
            { v: v.material || '', s: cellCenter },
            { v: Math.round((Number(v.precio) || 0) * 100) / 100, t: 'n', s: cellNum },
            { v: v.divisa || '', s: cellCenter },
            { v: Math.round((Number(v.importeTotal) || 0) * 100) / 100, t: 'n', s: cellNum },
          ]);
        }
        // Subtotal
        const subRow = Array(COLS).fill({ v: '', s: subtotalStyle });
        subRow[0] = { v: sem.semana, s: { ...subtotalStyle, alignment: { horizontal: 'left' } } };
        subRow[4] = { v: Math.round((Number(sem.totalTn) || 0) * 100) / 100, t: 'n', s: subtotalStyle };
        rows.push(subRow);
      }

      // Total placa
      const totRow = Array(COLS).fill({ v: '', s: totalStyle });
      totRow[0] = { v: `TOTAL ${bloque.placa}`, s: totalLabelStyle };
      totRow[4] = { v: Math.round((Number(bloque.totalTn) || 0) * 100) / 100, t: 'n', s: totalStyle };
      rows.push(totRow);

      if (bloque.totalDolares > 0) {
        const dRow = Array(COLS).fill({ v: '', s: white });
        dRow[0] = { v: 'Total Dólares (USD):', s: bold };
        dRow[1] = { v: Math.round((Number(bloque.totalDolares)) * 100) / 100, t: 'n', s: cellNum };
        rows.push(dRow);
      }
      if (bloque.totalSoles > 0) {
        const sRow = Array(COLS).fill({ v: '', s: white });
        sRow[0] = { v: 'Total Soles (PEN):', s: bold };
        sRow[1] = { v: Math.round((Number(bloque.totalSoles)) * 100) / 100, t: 'n', s: cellNum };
        rows.push(sRow);
      }
      rows.push(Array(COLS).fill({ v: '', s: white }));
    }

    // Totales generales
    const genTitle = Array(COLS).fill({ v: '', s: { font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1B7430' } } } });
    genTitle[0] = { v: 'TOTALES GENERALES', s: genTitle[0].s };
    rows.push(genTitle);

    const tnRow = Array(COLS).fill({ v: '', s: bold });
    tnRow[0] = { v: 'Total TN:', s: bold };
    tnRow[1] = { v: Math.round((Number(data.totalesGenerales.totalTn)) * 100) / 100, t: 'n', s: cellNum };
    rows.push(tnRow);

    if (data.totalesGenerales.totalDolares > 0) {
      const r = Array(COLS).fill({ v: '', s: bold });
      r[0] = { v: 'Total Dólares (USD):', s: bold };
      r[1] = { v: Math.round((Number(data.totalesGenerales.totalDolares)) * 100) / 100, t: 'n', s: cellNum };
      rows.push(r);
    }
    if (data.totalesGenerales.totalSoles > 0) {
      const r = Array(COLS).fill({ v: '', s: bold });
      r[0] = { v: 'Total Soles (PEN):', s: bold };
      r[1] = { v: Math.round((Number(data.totalesGenerales.totalSoles)) * 100) / 100, t: 'n', s: cellNum };
      rows.push(r);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Anchos de columna
    ws['!cols'] = [
      { wch: 28 }, { wch: 18 }, { wch: 28 }, { wch: 13 }, { wch: 13 },
      { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 24 }, { wch: 20 },
      { wch: 12 }, { wch: 8 }, { wch: 14 },
    ];
    // Merge título
    ws['!merges'] = merges;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Guías Emitidas');
    const fileName = `Guias_${data.empresa}_${data.mes}${semana ? `_Sem${semana}` : ''}.xlsx`.replace(/\s+/g, '_');
    XLSX.writeFile(wb, fileName);
  };

  if (!isOpen) return null;

  const formatNum = (n) => {
    const val = Number(n) || 0;
    return val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (d) => {
    if (!d) return '';
    // Parsear solo YYYY-MM-DD para evitar desfase UTC→Lima (UTC-5)
    const dateStr = typeof d === 'string' ? d.substring(0, 10) : new Date(d).toISOString().substring(0, 10);
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const renderBloque = (bloque, idx, allBloques) => (
    <div key={idx} className="rg-bloque">
      {empresa === 'TODAS' && bloque.empresaNombre && (idx === 0 || allBloques[idx - 1]?.empresaNombre !== bloque.empresaNombre) && (
        <h2 style={{ textAlign: 'left', color: '#1B7430', fontSize: '0.95rem', fontWeight: 800, margin: '16px 0 4px', borderBottom: '2px solid #1B7430', paddingBottom: 4 }}>
          {bloque.empresaNombre}
        </h2>
      )}
      <h3>UNID: {bloque.placa}</h3>
      {bloque.semanas.map((sem, sIdx) => (
        <div key={sIdx} className="rg-semana-block">
          <table className="rg-table">
            <colgroup>
              <col style={{ width: '7%' }} />{/* Fecha */}
              <col style={{ width: '8%' }} />{/* Guía Transp */}
              <col style={{ width: '13%' }} />{/* Conductor */}
              <col style={{ width: '7%' }} />{/* Peso Guía */}
              <col style={{ width: '7%' }} />{/* Peso Ticket */}
              <col style={{ width: '5%' }} />{/* N° Ticket */}
              <col style={{ width: '8%' }} />{/* Guía Remitente */}
              <col style={{ width: '11%' }} />{/* Cliente */}
              <col style={{ width: '12%' }} />{/* Recorrido */}
              <col style={{ width: '10%' }} />{/* Material */}
              <col style={{ width: '6%' }} />{/* Precio IGV */}
              <col style={{ width: '6%' }} />{/* Importe Total */}
            </colgroup>
            {sIdx === 0 && (
              <thead>
                <tr>
                  <th className="col-info">Fecha</th>
                  <th className="col-info">Guía (Transportista)</th>
                  <th className="col-info">Conductor</th>
                  <th className="col-peso">Peso Guía<br/>(TN Enviada)</th>
                  <th className="col-peso">Peso Ticket<br/>(TN Recibida)</th>
                  <th className="col-ref">N° Ticket</th>
                  <th className="col-ref">Guía (Remitente)</th>
                  <th className="col-cliente">Cliente</th>
                  <th className="col-cliente">Recorrido</th>
                  <th className="col-cliente">Material</th>
                  <th className="col-money">Precio IGV</th>
                  <th className="col-money">Importe Total</th>
                </tr>
              </thead>
            )}
            <tbody>
              {sem.viajes.map((v, vIdx) => (
                <tr key={vIdx}>
                  <td className="col-left">{formatDate(v.fecha)}</td>
                  <td className="col-left">{v.grt}</td>
                  <td className="col-left">{v.conductor}</td>
                  <td>{formatNum(v.peso)} TN</td>
                  <td>{formatNum(v.pesoMina)} TN</td>
                  <td className="col-left">{v.ticket}</td>
                  <td className="col-left">{v.grr}</td>
                  <td className="col-left">{v.cliente}</td>
                  <td className="col-left">{v.recorrido}</td>
                  <td className="col-left">{v.material}</td>
                  <td>{v.divisa === 'PEN' ? 'S/' : '$'}{formatNum(v.precio)}</td>
                  <td>{v.divisa === 'PEN' ? 'S/' : '$'}{formatNum(v.bi)}</td>
                </tr>
              ))}
              <tr className="fila-subtotal">
                <td colSpan={4} className="col-left">{sem.semana}</td>
                <td>{formatNum(sem.totalTn)} TN</td>
                <td colSpan={7}></td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
      <div className="rg-bloque-totales">
        <table className="rg-table">
          <colgroup>
            <col style={{ width: '7%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
          </colgroup>
          <tbody>
            <tr className="fila-total">
              <td colSpan={4} className="col-left">TOTAL</td>
              <td>{formatNum(bloque.totalTn)} TN</td>
              <td colSpan={7}></td>
            </tr>
          </tbody>
        </table>
        <div className="totales-moneda">
          {bloque.totalDolares > 0 && <span className="moneda-tag">Total Dólares: ${formatNum(bloque.totalDolares)}</span>}
          {bloque.totalSoles > 0 && <span className="moneda-tag">Total Soles: S/ {formatNum(bloque.totalSoles)}</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="rg-modal-overlay" onClick={onClose}>
      <div className="rg-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="rg-modal-header">
          <div className="rg-modal-title">
            <h1>Transporte Según Guías Emitidas</h1>
          </div>
          <div className="rg-modal-actions">
            {data && !data.error && (
              <>
                <button className="btn-download-excel" onClick={handleDownloadExcel}>
                  📊 Descargar Excel
                </button>
                <button className="btn-download-pdf" onClick={handleDownloadPDF}>
                  📥 Descargar PDF
                </button>
              </>
            )}
            <button className="btn-close-modal" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Filtros */}
        <div className="rg-filters-bar">
          <div className="rg-filter-item">
            <label>Empresa de Transporte:</label>
            <select
              value={empresa}
              onChange={(e) => { setEmpresa(e.target.value); setSemana(''); setData(null); }}
              disabled={loadingOpciones}
            >
              <option value="">Seleccionar empresa</option>
              <option value="TODAS">Todas las empresas</option>
              {empresas.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </div>

          <div className="rg-filter-item">
            <label>Mes:</label>
            <select
              value={mes}
              onChange={(e) => { setMes(e.target.value); setSemana(''); setData(null); }}
              disabled={!empresa}
            >
              <option value="">Seleccionar mes</option>
              {meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {data && data.semanasDisponibles && data.semanasDisponibles.length > 0 && (
            <div className="rg-filter-item">
              <label>Semana:</label>
              <select value={semana} onChange={(e) => handleSemanaChange(e.target.value)}>
                <option value="">Todo el mes</option>
                {data.semanasDisponibles.map(s => (
                  <option key={s} value={s}>Semana {s}</option>
                ))}
              </select>
            </div>
          )}

          <button className="rg-btn-generar" onClick={() => handleGenerar(semana || undefined)} disabled={!canGenerate || loading}>
            {loading ? 'Generando...' : 'Generar Reporte'}
          </button>
        </div>

        {/* Body */}
        <div className="rg-modal-body">
          {loading ? (
            <div className="loading-section"><div className="spinner"></div><p>Generando reporte...</p></div>
          ) : !data ? (
            <div className="empty-section">Selecciona empresa y mes, luego presiona "Generar Reporte"</div>
          ) : data.error ? (
            <div className="empty-section">{data.error}</div>
          ) : (
            <div ref={printRef}>
              <h2>{data.empresa} — TRANSPORTE SEGÚN GUÍAS EMITIDAS</h2>
              <h4 style={{ textAlign: 'center', color: '#1B7430', marginBottom: 12, fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {data.mes}{semana && <span style={{ color: '#1a6fa8' }}> · Semana {semana}</span>}
              </h4>

              {data.bloques.map((bloque, idx) => renderBloque(bloque, idx, data.bloques))}

              {/* Totales generales */}
              <div className="rg-totales-generales">
                <h3>TOTALES GENERALES</h3>
                <p>Total TN: <strong>{formatNum(data.totalesGenerales.totalTn)} TN</strong></p>
                {data.totalesGenerales.totalDolares > 0 && (
                  <p>Total Dólares: <strong>${formatNum(data.totalesGenerales.totalDolares)}</strong></p>
                )}
                {data.totalesGenerales.totalSoles > 0 && (
                  <p>Total Soles: <strong>S/ {formatNum(data.totalesGenerales.totalSoles)}</strong></p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReporteGuiasModal;
