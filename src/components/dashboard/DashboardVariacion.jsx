import { useState, useEffect } from 'react';
import { dashboardService } from '../../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useIsMobile } from '../../hooks/useIsMobile';
import jsPDF from 'jspdf';
import logoEmpresa from '../../assets/Images/logo-empresa.png';
import './DashboardComponents.css';

const fmtNum = (n) => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DashboardVariacion = ({ filters }) => {
  const isMobile = useIsMobile();
  const [tablaPivot, setTablaPivot] = useState([]);
  const [tnPorUnidadMes, setTnPorUnidadMes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);

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

  const drawPdfHeader = (pdf, { logoDataUrl, subtitle, generatedAt }) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const marginX = 24;

    if (logoDataUrl) {
      pdf.addImage(logoDataUrl, 'PNG', marginX, 18, 54, 30);
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(27, 116, 48);
    pdf.setFontSize(20);
    pdf.text('Reporte de Variacion TN', pageWidth / 2, 30, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(70, 70, 70);
    pdf.setFontSize(11);
    pdf.text(subtitle, pageWidth / 2, 46, { align: 'center' });
    pdf.text(`Generado: ${generatedAt}`, pageWidth - marginX, 20, { align: 'right' });

    pdf.setDrawColor(27, 116, 48);
    pdf.setLineWidth(1.2);
    pdf.line(marginX, 56, pageWidth - marginX, 56);
    return 70;
  };

  const drawSectionTitle = (pdf, title, y) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const marginX = 24;
    pdf.setFillColor(240, 247, 242);
    pdf.roundedRect(marginX, y, pageWidth - marginX * 2, 18, 3, 3, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(33, 33, 33);
    pdf.setFontSize(12);
    pdf.text(title, marginX + 8, y + 12);
    return y + 24;
  };

  const drawSimpleTable = (pdf, {
    startY,
    headers,
    rows,
    columnWidths,
    logoDataUrl,
    subtitle,
    generatedAt,
  }) => {
    const marginX = 24;
    const pageHeight = pdf.internal.pageSize.getHeight();
    const tableWidth = pdf.internal.pageSize.getWidth() - marginX * 2;
    const rowHeight = 14;
    const bottomSafe = 20;

    let y = startY;

    const drawTableHeader = () => {
      let x = marginX;
      pdf.setFillColor(27, 116, 48);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);

      headers.forEach((header, idx) => {
        const width = tableWidth * columnWidths[idx];
        pdf.rect(x, y, width, rowHeight, 'F');
        pdf.text(String(header), x + 4, y + 9.5);
        x += width;
      });
      y += rowHeight;
    };

    const ensureSpace = (required = rowHeight) => {
      if (y + required > pageHeight - bottomSafe) {
        pdf.addPage();
        y = drawPdfHeader(pdf, { logoDataUrl, subtitle, generatedAt });
        drawTableHeader();
      }
    };

    drawTableHeader();

    rows.forEach((row, rowIndex) => {
      ensureSpace();
      let x = marginX;

      pdf.setFillColor(rowIndex % 2 === 0 ? 255 : 246, rowIndex % 2 === 0 ? 255 : 248, rowIndex % 2 === 0 ? 255 : 250);
      pdf.rect(marginX, y, tableWidth, rowHeight, 'F');

      row.forEach((cell, idx) => {
        const width = tableWidth * columnWidths[idx];
        pdf.setTextColor(40, 40, 40);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.5);

        const text = String(cell ?? '');
        const lines = pdf.splitTextToSize(text, width - 8);
        pdf.text(lines[0] || '', x + 4, y + 9.5);
        x += width;
      });

      pdf.setDrawColor(226, 226, 226);
      pdf.line(marginX, y + rowHeight, marginX + tableWidth, y + rowHeight);
      y += rowHeight;
    });

    return y;
  };

  const descargarPDF = async () => {
    setExportingPdf(true);
    try {
      const filterParts = [];
      if (filters.mes) filterParts.push(filters.mes);
      if (filters.semana) filterParts.push(`Semana ${filters.semana}`);
      if (filters.cliente) filterParts.push(filters.cliente);
      if (filters.transportista) filterParts.push(filters.transportista);
      if (filters.unidad) filterParts.push(`Placa: ${filters.unidad}`);
      if (filters.transportado) filterParts.push(filters.transportado);
      const subtitle = filterParts.length > 0 ? filterParts.join(' — ') : 'General';
      const generatedAt = new Date().toLocaleString('es-PE');
      const logoDataUrl = await loadImageAsDataUrl(logoEmpresa).catch(() => null);

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      let y = drawPdfHeader(pdf, { logoDataUrl, subtitle, generatedAt });

      const totalEnviado = tablaPivot.reduce((sum, item) => sum + parseFloat(item.tn_enviado || 0), 0);
      const totalRecibido = tablaPivot.reduce((sum, item) => sum + parseFloat(item.tn_recibido || 0), 0);
      const variacionTotal = totalRecibido - totalEnviado;
      const porcVariacion = totalEnviado > 0 ? ((variacionTotal / totalEnviado) * 100) : 0;

      y = drawSectionTitle(pdf, 'Resumen General', y);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10.5);
      pdf.setTextColor(45, 45, 45);
      pdf.text(`Total Peso Guia (TN Enviada): ${fmtNum(totalEnviado)} TN`, 32, y);
      pdf.text(`Total Peso Ticket (TN Recibida): ${fmtNum(totalRecibido)} TN`, 300, y);
      pdf.text(`Variacion Total: ${fmtNum(variacionTotal)} TN (${fmtNum(porcVariacion)}%)`, 610, y);
      y += 18;

      y = drawSectionTitle(pdf, 'Tabla Pivot - Peso Ticket por Semana', y + 8);
      const pivotRows = tablaPivot.map((item) => {
        const porc = Number(item.tn_enviado) > 0 ? ((Number(item.variacion) / Number(item.tn_enviado)) * 100) : 0;
        return [
          item.semana || '-',
          item.cliente || 'Sin cliente',
          fmtNum(item.tn_enviado),
          fmtNum(item.tn_recibido),
          fmtNum(item.variacion),
          `${fmtNum(porc)}%`,
        ];
      });

      y = drawSimpleTable(pdf, {
        startY: y,
        headers: ['Semana', 'Cliente', 'Peso Guia (TN)', 'Peso Ticket (TN)', 'Variacion', '% Variacion'],
        rows: pivotRows.length > 0 ? pivotRows : [['-', 'No hay datos para mostrar', '-', '-', '-', '-']],
        columnWidths: [0.1, 0.28, 0.16, 0.16, 0.14, 0.16],
        logoDataUrl,
        subtitle,
        generatedAt,
      });

      y = drawSectionTitle(pdf, 'Detalle TN por Unidad y Mes', y + 10);
      const detalleRows = tnPorUnidadMes.map((item) => [
        item.mes || '-',
        item.placa || '-',
        fmtNum(item.total),
      ]);

      drawSimpleTable(pdf, {
        startY: y,
        headers: ['Mes', 'Placa', 'TN Total'],
        rows: detalleRows.length > 0 ? detalleRows : [['-', '-', 'No hay datos para mostrar']],
        columnWidths: [0.25, 0.25, 0.5],
        logoDataUrl,
        subtitle,
        generatedAt,
      });

      pdf.save('Variacion_TN.pdf');
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pivot, unidadMes] = await Promise.all([
        dashboardService.getTablaPivot(filters),
        dashboardService.getTnPorUnidadMes(filters),
      ]);
      // Parsear valores a números
      setTablaPivot((pivot || []).map(item => ({
        ...item,
        tn_enviado: parseFloat(item.tn_enviado) || 0,
        tn_recibido: parseFloat(item.tn_recibido) || 0,
        variacion: parseFloat(item.variacion) || 0
      })));
      setTnPorUnidadMes((unidadMes || []).map(item => ({
        ...item,
        total: parseFloat(item.total) || 0
      })));
    } catch (error) {
      console.error('Error cargando datos de variación:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-section"><div className="spinner"></div></div>;
  }

  // Agrupar datos por unidad para el gráfico
  const datosGrafico = tnPorUnidadMes.reduce((acc, item) => {
    const existingItem = acc.find(x => x.mes === item.mes);
    if (existingItem) {
      existingItem[item.placa] = parseFloat(item.total) || 0;
    } else {
      acc.push({
        mes: item.mes,
        [item.placa]: parseFloat(item.total) || 0
      });
    }
    return acc;
  }, []);

  // Obtener placas únicas para las barras
  const placasUnicas = [...new Set(tnPorUnidadMes.map(item => item.placa))];
  // Paleta de colores equilibrada para gráficos
  const colors = [
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

  return (
    <div className="dashboard-variacion">
      <div className="pdf-btn-wrapper">
        <button className="btn-download-pdf" onClick={descargarPDF} disabled={exportingPdf}>
          {exportingPdf ? 'Generando...' : '📥 Descargar PDF'}
        </button>
      </div>
      <div>
      {/* Tabla Pivot TN Recibidas */}
      <div className="section-card full-width">
        <h2>📊 Tabla Pivot - Peso Ticket por Semana</h2>
        {tablaPivot.length === 0 ? (
          <p className="empty-message">No hay datos para mostrar</p>
        ) : (
          <div className="table-container pivot-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th>Cliente</th>
                  <th>Peso Guía (TN Enviada)</th>
                  <th>Peso Ticket (TN Recibida)</th>
                  <th>Variación</th>
                  <th>% Variación</th>
                </tr>
              </thead>
              <tbody>
                {tablaPivot.map((item, index) => {
                  const porcVariacion = item.tn_enviado > 0 
                    ? ((item.variacion / item.tn_enviado) * 100).toFixed(2) 
                    : 0;
                  return (
                    <tr key={index} className={parseFloat(item.variacion) < 0 ? 'row-negative' : ''}>
                      <td>{item.semana}</td>
                      <td>{item.cliente || 'Sin cliente'}</td>
                      <td>{fmtNum(item.tn_enviado)}</td>
                      <td>{fmtNum(item.tn_recibido)}</td>
                      <td className={parseFloat(item.variacion) < 0 ? 'negative' : 'positive'}>
                        {fmtNum(item.variacion)}
                      </td>
                      <td className={parseFloat(porcVariacion) < 0 ? 'negative' : 'positive'}>
                        {porcVariacion}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TN por Unidad por Mes */}
      <div className="chart-section">
        <h2>🚛 Peso Guía / Peso Ticket por Unidad por Mes</h2>
        <div className="chart-container">
          {datosGrafico.length === 0 ? (
            <p className="empty-message">No hay datos para mostrar</p>
          ) : (
            <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
              <BarChart data={datosGrafico} margin={isMobile ? { top: 5, right: 5, left: 0, bottom: 5 } : undefined}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="mes" tick={{ fontSize: isMobile ? 9 : 12 }} angle={isMobile ? -45 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 50 : 30} />
                <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 35 : 60} />
                <Tooltip formatter={(value) => `${fmtNum(value)} TN`} contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' }} />
                {!isMobile && <Legend />}
                {placasUnicas.slice(0, isMobile ? 6 : 8).map((placa, index) => (
                  <Bar 
                    key={placa} 
                    dataKey={placa} 
                    name={placa} 
                    fill={colors[index % colors.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Resumen de Variación */}
      <div className="section-card">
        <h2>⚖️ Resumen de Variación</h2>
        <div className="variacion-summary">
          {(() => {
            const totalEnviado = tablaPivot.reduce((sum, item) => sum + parseFloat(item.tn_enviado || 0), 0);
            const totalRecibido = tablaPivot.reduce((sum, item) => sum + parseFloat(item.tn_recibido || 0), 0);
            const variacionTotal = totalRecibido - totalEnviado;
            const porcVariacion = totalEnviado > 0 ? ((variacionTotal / totalEnviado) * 100) : 0;
            
            return (
              <>
                <div className="summary-item">
                  <label>Total Peso Guía (TN Enviada)</label>
                  <span className="summary-value">{fmtNum(totalEnviado)}</span>
                </div>
                <div className="summary-item">
                  <label>Total Peso Ticket (TN Recibida)</label>
                  <span className="summary-value">{fmtNum(totalRecibido)}</span>
                </div>
                <div className="summary-item">
                  <label>Variación Total</label>
                  <span className={`summary-value ${variacionTotal < 0 ? 'negative' : 'positive'}`}>
                    {fmtNum(variacionTotal)} TN ({fmtNum(porcVariacion)}%)
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Tabla detallada por Unidad y Mes */}
      <div className="section-card full-width">
        <h2>📝 Detalle TN por Unidad y Mes</h2>
        {tnPorUnidadMes.length === 0 ? (
          <p className="empty-message">No hay datos para mostrar</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Placa</th>
                  <th>TN Total</th>
                </tr>
              </thead>
              <tbody>
                {tnPorUnidadMes.map((item, index) => (
                  <tr key={index}>
                    <td>{item.mes}</td>
                    <td>{item.placa}</td>
                    <td>{fmtNum(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default DashboardVariacion;
