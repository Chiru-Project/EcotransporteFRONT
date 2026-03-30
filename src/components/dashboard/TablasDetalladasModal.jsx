import { Fragment, useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { dashboardService } from '../../services/api';
import logoEmpresa from '../../assets/Images/logo-empresa.png';
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

  const toBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

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

  const handleDownloadExcel = async () => {
    if (!data) return;
    try {
      const { default: ExcelJS } = await import('exceljs');
      const empresas = empresaFiltro
        ? data.empresas.filter(e => e === empresaFiltro)
        : data.empresas;
      const semanaLabel = semana ? `Semana ${semana}` : 'Todo el mes';
      const mesLabel = mes || 'general';
      const titulo = `ECOTRANSPORTE - REPORTE DETALLADO (${mesLabel.toUpperCase()})`;

      const workbook = new ExcelJS.Workbook();

      const isZeroLike = (value) => Math.abs(Number(value) || 0) < 0.000001;
      const formatNumber = (value) => (Number(value) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const formatTn = (value) => (isZeroLike(value) ? '-' : `${formatNumber(value)} TN`);
      const formatMoney = (value, currencySymbol) => (isZeroLike(value) ? '-' : `${currencySymbol}${formatNumber(value)}`);

      let logoBase64 = '';
      let logoExtension = 'png';
      try {
        const logoResponse = await fetch(logoEmpresa, { cache: 'no-store' });
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          const dataUrl = await toBase64(logoBlob);
          if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
            logoBase64 = dataUrl;
            logoExtension = dataUrl.includes('image/jpeg') ? 'jpeg' : 'png';
          }
        }

        if (!logoBase64) {
          console.warn('No se pudo cargar logo para Excel (Tablas Detalladas).');
        }
      } catch (logoError) {
        console.warn('No se pudo insertar el logo en Excel de Tablas Detalladas:', logoError);
      }

      const placeLogo = (worksheet) => {
        if (!logoBase64) return;
        // Crear un imageId por hoja evita problemas de render en algunos visores de XLSX.
        const imageId = workbook.addImage({
          base64: logoBase64,
          extension: logoExtension,
        });
        worksheet.addImage(imageId, {
          tl: { col: 0.08, row: 0.12 },
          ext: { width: 128, height: 52 },
          editAs: 'oneCell',
        });
      };

      const applySheetLayout = (worksheet, colCount, subtitle) => {
        worksheet.views = [{ state: 'frozen', ySplit: 6 }];
        worksheet.mergeCells(1, 1, 2, 1);
        worksheet.mergeCells(1, 3, 1, colCount);
        worksheet.mergeCells(2, 3, 2, colCount);
        worksheet.mergeCells(4, 1, 4, colCount);

        worksheet.getCell(1, 3).value = titulo;
        worksheet.getCell(1, 3).font = { bold: true, size: 15, color: { argb: 'FF1B7430' } };
        worksheet.getCell(1, 3).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

        worksheet.getCell(2, 3).value = `Generado: ${new Date().toLocaleString('es-PE')}`;
        worksheet.getCell(2, 3).font = { size: 10, color: { argb: 'FF4B5563' } };
        worksheet.getCell(2, 3).alignment = { vertical: 'middle', horizontal: 'left' };

        worksheet.getCell(4, 1).value = `Tipo: ${subtitle} | Mes: ${mesLabel} | ${semanaLabel} | Empresa: ${empresaFiltro || 'Todas'}`;
        worksheet.getCell(4, 1).font = { bold: true, size: 10, color: { argb: 'FF374151' } };
        worksheet.getCell(4, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5F4E7' } };
        worksheet.getCell(4, 1).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

        worksheet.getRow(1).height = 34;
        worksheet.getRow(2).height = 22;
        worksheet.getRow(4).height = 22;
      };

      const styleHeaderRow = (row, empresasCount) => {
        const totalCols = 3 + empresasCount * 2;
        for (let col = 1; col <= totalCols; col++) {
          const cell = row.getCell(col);
          let fill = { argb: 'FFA3BFFA' };
          let fontColor = { argb: 'FF1E2F5C' };

          if (col === 1) {
            fill = { argb: 'FF96D9B8' };
            fontColor = { argb: 'FF173324' };
          } else if (col >= 4) {
            const companyIndex = Math.floor((col - 4) / 2) % 4;
            const palette = [
              { fill: { argb: 'FFC4A8F0' }, font: { argb: 'FF2E2048' } },
              { fill: { argb: 'FFFAC98A' }, font: { argb: 'FF3D2200' } },
              { fill: { argb: 'FFF5A3A8' }, font: { argb: 'FF3D1018' } },
              { fill: { argb: 'FFA8C8DC' }, font: { argb: 'FF1A3040' } },
            ][companyIndex];
            fill = palette.fill;
            fontColor = palette.font;
          }

          cell.font = { bold: true, size: 10, color: fontColor };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: fill };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
        }
      };

      const styleDataRow = (row, totalCols, options = {}) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'right' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          cell.font = { size: 9, color: { argb: 'FF1E2A3A' }, bold: !!options.bold };
          if (options.fill) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: options.fill } };
          }
        });

        for (let col = row.cellCount + 1; col <= totalCols; col++) {
          const cell = row.getCell(col);
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          if (options.fill) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: options.fill } };
          }
        }
      };

      const buildVentaCostoSheet = (sheetName, type) => {
        const colCount = 3 + empresas.length * 2;
        const worksheet = workbook.addWorksheet(sheetName);
        applySheetLayout(worksheet, colCount, sheetName);

        worksheet.columns = [
          { key: 'cliente', width: 34 },
          { key: 'generalTne', width: 16 },
          { key: 'generalImporte', width: 18 },
          ...empresas.flatMap(() => [{ width: 16 }, { width: 18 }]),
        ];
        placeLogo(worksheet);

        const headerRow = worksheet.getRow(6);
        const headerValues = ['Cliente / Material', 'General TNE', 'General Importe'];
        empresas.forEach((emp) => {
          headerValues.push(`${formatEmpresa(emp)} TNE`);
          headerValues.push(`${formatEmpresa(emp)} Importe`);
        });
        headerRow.values = headerValues;
        headerRow.height = 26;
        styleHeaderRow(headerRow, empresas.length);

        for (const grupo of data.grupos) {
          const clienteRow = worksheet.addRow([grupo.cliente]);
          clienteRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { bold: true, size: 10, color: { argb: 'FF1E2A3A' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC5D0E0' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFB0BCD0' } },
              left: { style: 'thin', color: { argb: 'FFB0BCD0' } },
              bottom: { style: 'thin', color: { argb: 'FFB0BCD0' } },
              right: { style: 'thin', color: { argb: 'FFB0BCD0' } },
            };
          });
          worksheet.mergeCells(clienteRow.number, 1, clienteRow.number, colCount);

          for (const mat of grupo.materiales) {
            const currency = mat.divisa === 'PEN' ? 'S/' : '$';
            const rowValues = [
              mat.label,
              formatTn(mat.data.general.tne),
              formatMoney(type === 'venta' ? mat.data.general.importeVenta : mat.data.general.importeCosto, currency),
            ];

            for (const emp of empresas) {
              const d = mat.data[emp] || { tne: 0, importeVenta: 0, importeCosto: 0 };
              rowValues.push(formatTn(d.tne));
              rowValues.push(formatMoney(type === 'venta' ? d.importeVenta : d.importeCosto, currency));
            }

            const row = worksheet.addRow(rowValues);
            styleDataRow(row, colCount);
          }
        }

        const totalsConfig = [
          { div: 'USD', label: 'Total Dolares (USD)', symbol: '$' },
          { div: 'PEN', label: 'Total Soles (PEN)', symbol: 'S/' },
        ];

        totalsConfig.forEach(({ div, label, symbol }) => {
          const tot = data.totales[div];
          const rowValues = [
            label,
            formatTn(tot.general.tne),
            formatMoney(type === 'venta' ? tot.general.importeVenta : tot.general.importeCosto, symbol),
          ];

          for (const emp of empresas) {
            const d = tot[emp] || { tne: 0, importeVenta: 0, importeCosto: 0 };
            rowValues.push(formatTn(d.tne));
            rowValues.push(formatMoney(type === 'venta' ? d.importeVenta : d.importeCosto, symbol));
          }

          const totalRow = worksheet.addRow(rowValues);
          styleDataRow(totalRow, colCount, { bold: true, fill: 'FFA8DBC0' });
        });

        worksheet.autoFilter = {
          from: { row: 6, column: 1 },
          to: { row: 6, column: colCount },
        };
      };

      const buildMargenSheet = () => {
        const colCount = 2 + empresas.length;
        const worksheet = workbook.addWorksheet('Margen');
        applySheetLayout(worksheet, colCount, 'Margen de Ganancia');

        worksheet.columns = [
          { key: 'concepto', width: 28 },
          { key: 'general', width: 20 },
          ...empresas.map(() => ({ width: 20 })),
        ];
        placeLogo(worksheet);

        const headerRow = worksheet.getRow(6);
        const headerValues = ['Concepto', 'General'];
        empresas.forEach((emp) => headerValues.push(formatEmpresa(emp)));
        headerRow.values = headerValues;
        headerRow.height = 26;

        for (let col = 1; col <= colCount; col++) {
          const cell = headerRow.getCell(col);
          if (col === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF96D9B8' } };
            cell.font = { bold: true, size: 10, color: { argb: 'FF173324' } };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA3BFFA' } };
            cell.font = { bold: true, size: 10, color: { argb: 'FF1E2F5C' } };
          }
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
        }

        const marginRows = [
          { div: 'USD', label: 'Dolares (USD)', symbol: '$' },
          { div: 'PEN', label: 'Soles (PEN)', symbol: 'S/' },
        ];

        marginRows.forEach(({ div, label, symbol }) => {
          const rowValues = [label, formatMoney(data.margen[div].general.margen, symbol)];
          for (const emp of empresas) {
            const marginValue = (data.margen[div][emp] || { margen: 0 }).margen;
            rowValues.push(formatMoney(marginValue, symbol));
          }

          const row = worksheet.addRow(rowValues);
          styleDataRow(row, colCount, { bold: true });
        });

        worksheet.autoFilter = {
          from: { row: 6, column: 1 },
          to: { row: 6, column: colCount },
        };
      };

      buildVentaCostoSheet('Venta', 'venta');
      buildVentaCostoSheet('Costo', 'costo');
      buildMargenSheet();

      const fileName = `tablas_detalladas_${mesLabel.toUpperCase()}${semana ? `_sem${semana}` : ''}${empresaFiltro ? `_${empresaFiltro.replace(/\s+/g, '_')}` : ''}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exportando tablas detalladas a Excel:', error);
    }
  };

  if (!isOpen) return null;

  const formatNum = (n) => {
    const val = Number(n) || 0;
    return val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const isZeroLike = (n) => {
    const val = Number(n) || 0;
    return Math.abs(val) < 0.000001;
  };

  const formatTnDisplay = (n) => (isZeroLike(n) ? '-' : `${formatNum(n)} TN`);

  const formatMoneyDisplay = (n, currencySymbol) => (
    isZeroLike(n) ? '-' : `${currencySymbol}${formatNum(n)}`
  );

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
                      <td>{formatTnDisplay(mat.data.general.tne)}</td>
                      <td>{formatMoneyDisplay(type === 'venta' ? mat.data.general.importeVenta : mat.data.general.importeCosto, mat.divisa === 'PEN' ? 'S/' : '$')}</td>
                      {empresas.map(emp => {
                        const d = mat.data[emp] || { tne: 0, importeVenta: 0, importeCosto: 0 };
                        return [
                          <td key={`${emp}-${gIdx}-${mIdx}-tne`}>{formatTnDisplay(d.tne)}</td>,
                          <td key={`${emp}-${gIdx}-${mIdx}-imp`}>{formatMoneyDisplay(type === 'venta' ? d.importeVenta : d.importeCosto, mat.divisa === 'PEN' ? 'S/' : '$')}</td>,
                        ];
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
              {/* Total Dólares */}
              <tr className="fila-total">
                <td className="col-cliente">Total Dólares (USD)</td>
                <td>{formatTnDisplay(totales.USD.general.tne)}</td>
                <td>{formatMoneyDisplay(type === 'venta' ? totales.USD.general.importeVenta : totales.USD.general.importeCosto, '$')}</td>
                {empresas.map(emp => {
                  const d = totales.USD[emp] || { tne: 0, importeVenta: 0, importeCosto: 0 };
                  return [
                    <td key={`usd-${emp}-tne`}>{formatTnDisplay(d.tne)}</td>,
                    <td key={`usd-${emp}-imp`}>{formatMoneyDisplay(type === 'venta' ? d.importeVenta : d.importeCosto, '$')}</td>,
                  ];
                })}
              </tr>
              {/* Total Soles */}
              <tr className="fila-total">
                <td className="col-cliente">Total Soles (PEN)</td>
                <td>{formatTnDisplay(totales.PEN.general.tne)}</td>
                <td>{formatMoneyDisplay(type === 'venta' ? totales.PEN.general.importeVenta : totales.PEN.general.importeCosto, 'S/')}</td>
                {empresas.map(emp => {
                  const d = totales.PEN[emp] || { tne: 0, importeVenta: 0, importeCosto: 0 };
                  return [
                    <td key={`pen-${emp}-tne`}>{formatTnDisplay(d.tne)}</td>,
                    <td key={`pen-${emp}-imp`}>{formatMoneyDisplay(type === 'venta' ? d.importeVenta : d.importeCosto, 'S/')}</td>,
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
                <td colSpan={2}>{formatMoneyDisplay(margen.USD.general.margen, '$')}</td>
                {empresas.map(emp => (
                  <td key={`usd-${emp}`} colSpan={2}>{formatMoneyDisplay((margen.USD[emp] || { margen: 0 }).margen, '$')}</td>
                ))}
              </tr>
              <tr>
                <td className="col-cliente">Soles (PEN)</td>
                <td colSpan={2}>{formatMoneyDisplay(margen.PEN.general.margen, 'S/')}</td>
                {empresas.map(emp => (
                  <td key={`pen-${emp}`} colSpan={2}>{formatMoneyDisplay((margen.PEN[emp] || { margen: 0 }).margen, 'S/')}</td>
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
              <div ref={printRef} className="tablas-print-wrap">
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
