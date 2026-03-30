import { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import { dashboardService } from '../../services/api';
import logoEmpresa from '../../assets/Images/logo-empresa.png';
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

  const toTitleCase = (text) => {
    if (!text) return '';
    return String(text)
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  const toBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

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

  const handleDownloadPDF = async () => {
    if (!data || data.error) return;

    const semanaLabel = semana ? ` · Semana ${semana}` : '';
    const generatedAt = new Date().toLocaleString('es-PE');
    const subtitle = `${data.empresa} — ${data.mes}${semanaLabel}`;

    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 18;
      const marginTop = 14;
      const marginBottom = 16;

      const headers = [
        'Fecha', 'Guia(Transp.)', 'Conductor', 'TN Env.', 'TN Rec.', 'N Ticket',
        'Guia(Rem.)', 'Cliente', 'Recorrido', 'Material', 'Precio IGV', 'Importe',
      ];

      const colWidths = [48, 56, 104, 50, 50, 44, 56, 82, 94, 78, 56, 65];
      const rowHeight = 12;
      const sectionHeight = 13;

      const toDataUrl = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      let logoDataUrl = null;
      try {
        const logoResponse = await fetch(logoEmpresa);
        const logoBlob = await logoResponse.blob();
        logoDataUrl = await toDataUrl(logoBlob);
      } catch (logoErr) {
        console.warn('No se pudo cargar el logo para PDF de guias:', logoErr);
      }

      let y = marginTop;

      const trimToWidth = (text, maxWidth) => {
        const raw = text == null ? '' : String(text);
        if (pdf.getTextWidth(raw) <= maxWidth) return raw;
        let out = raw;
        while (out.length > 1 && pdf.getTextWidth(`${out}...`) > maxWidth) {
          out = out.slice(0, -1);
        }
        return `${out}...`;
      };

      const drawHeaderBlock = () => {
        if (logoDataUrl) {
          pdf.addImage(logoDataUrl, 'PNG', marginX, y, 50, 22);
        }

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        pdf.text(`Generado: ${generatedAt}`, pageWidth - marginX, y + 8, { align: 'right' });

        y += 28;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(27, 116, 48);
        pdf.text('Reporte de Guias Emitidas', pageWidth / 2, y, { align: 'center' });

        y += 14;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(31, 41, 55);
        pdf.text(subtitle, pageWidth / 2, y, { align: 'center' });

        y += 10;
        pdf.setDrawColor(27, 116, 48);
        pdf.setLineWidth(1.1);
        pdf.line(marginX, y, pageWidth - marginX, y);
        y += 10;
      };

      const drawTableHeader = () => {
        let x = marginX;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        headers.forEach((header, idx) => {
          const w = colWidths[idx];
          pdf.setFillColor(27, 116, 48);
          pdf.setTextColor(255, 255, 255);
          pdf.rect(x, y, w, rowHeight, 'F');
          pdf.text(trimToWidth(header, w - 4), x + w / 2, y + 8, { align: 'center' });
          x += w;
        });
        y += rowHeight;
      };

      const ensureSpace = (neededHeight) => {
        if (y + neededHeight <= pageHeight - marginBottom) return;
        pdf.addPage();
        y = marginTop;
        drawHeaderBlock();
        drawTableHeader();
      };

      const drawRow = (cells, options = {}) => {
        ensureSpace(rowHeight);
        const bg = options.bg || null;
        let x = marginX;
        pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
        pdf.setFontSize(6.2);

        cells.forEach((cell, idx) => {
          const w = colWidths[idx];
          if (bg) {
            pdf.setFillColor(bg[0], bg[1], bg[2]);
            pdf.rect(x, y, w, rowHeight, 'F');
          }
          pdf.setDrawColor(226, 232, 240);
          pdf.rect(x, y, w, rowHeight);

          const isNumeric = idx === 3 || idx === 4 || idx === 10 || idx === 11;
          const text = trimToWidth(cell == null ? '' : String(cell), w - 4);
          pdf.setTextColor(31, 41, 55);
          if (isNumeric) {
            pdf.text(text, x + w - 2, y + 8, { align: 'right' });
          } else {
            pdf.text(text, x + 2, y + 8);
          }

          x += w;
        });

        y += rowHeight;
      };

      const drawMergedRow = (segments, options = {}) => {
        ensureSpace(rowHeight);
        const bg = options.bg || null;
        const borderColor = options.borderColor || [176, 188, 208];
        const borderWidth = options.borderWidth || 0.75;

        if (options.topSeparatorColor) {
          const totalWidth = colWidths.reduce((a, b) => a + b, 0);
          const c = options.topSeparatorColor;
          pdf.setDrawColor(c[0], c[1], c[2]);
          pdf.setLineWidth(options.topSeparatorWidth || 1);
          pdf.line(marginX, y, marginX + totalWidth, y);
        }

        pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
        pdf.setFontSize(6.6);

        segments.forEach((seg) => {
          const start = Math.max(0, seg.startCol);
          const end = Math.min(colWidths.length - 1, seg.endCol);
          const x = marginX + colWidths.slice(0, start).reduce((a, b) => a + b, 0);
          const w = colWidths.slice(start, end + 1).reduce((a, b) => a + b, 0);

          if (bg) {
            pdf.setFillColor(bg[0], bg[1], bg[2]);
            pdf.rect(x, y, w, rowHeight, 'F');
          }

          pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
          pdf.setLineWidth(borderWidth);
          pdf.rect(x, y, w, rowHeight);

          const text = trimToWidth(seg.text == null ? '' : String(seg.text), w - 6);
          const align = seg.align || 'left';
          pdf.setTextColor(31, 41, 55);
          if (align === 'center') {
            pdf.text(text, x + w / 2, y + 8, { align: 'center' });
          } else if (align === 'right') {
            pdf.text(text, x + w - 3, y + 8, { align: 'right' });
          } else {
            pdf.text(text, x + 3, y + 8);
          }
        });

        y += rowHeight;
      };

      const drawFullWidthSection = (text, rgbFill, bold = true) => {
        ensureSpace(sectionHeight);
        const totalWidth = colWidths.reduce((a, b) => a + b, 0);
        pdf.setFillColor(rgbFill[0], rgbFill[1], rgbFill[2]);
        pdf.rect(marginX, y, totalWidth, sectionHeight, 'F');
        pdf.setDrawColor(176, 188, 208);
        pdf.rect(marginX, y, totalWidth, sectionHeight);
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(30, 42, 58);
        pdf.text(text, marginX + 3, y + 9);
        y += sectionHeight;
      };

      const fmtNum = (n) => (Number(n) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const fmtDate = (d) => {
        if (!d) return '';
        const dateStr = typeof d === 'string' ? d.substring(0, 10) : new Date(d).toISOString().substring(0, 10);
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };

      drawHeaderBlock();
      drawTableHeader();

      let prevEmpresa = null;
      let globalUsd = 0;
      let globalPen = 0;
      data.bloques.forEach((bloque) => {
        let blockUsd = 0;
        let blockPen = 0;

        if (empresa === 'TODAS' && bloque.empresaNombre && bloque.empresaNombre !== prevEmpresa) {
          drawFullWidthSection(bloque.empresaNombre, [13, 61, 25], true);
          prevEmpresa = bloque.empresaNombre;
        }

        drawFullWidthSection(`UNID: ${bloque.placa}`, [232, 245, 233], true);

        bloque.semanas.forEach((sem) => {
          sem.viajes.forEach((v) => {
            const symbol = v.divisa === 'PEN' ? 'S/' : '$';
            const biValue = Number(v.bi) || 0;
            if (v.divisa === 'PEN') blockPen += biValue;
            else blockUsd += biValue;

            drawRow([
              fmtDate(v.fecha),
              v.grt || '',
              v.conductor || '',
              `${fmtNum(v.peso)} TN`,
              `${fmtNum(v.pesoMina)} TN`,
              v.ticket || '',
              v.grr || '',
              v.cliente || '',
              v.recorrido || '',
              v.material || '',
              `${symbol}${fmtNum(v.precio)}`,
              `${symbol}${fmtNum(v.bi)}`,
            ]);
          });

          drawMergedRow([
            { startCol: 0, endCol: 3, text: `Semana ${sem.semana}`, align: 'center' },
            { startCol: 4, endCol: 4, text: `${fmtNum(sem.totalTn)} TN`, align: 'center' },
            { startCol: 5, endCol: 11, text: '', align: 'left' },
          ], {
            bg: [241, 245, 249],
            bold: true,
            topSeparatorColor: [27, 116, 48],
            topSeparatorWidth: 1,
          });
        });

        drawMergedRow([
          { startCol: 0, endCol: 3, text: `TOTAL ${bloque.placa}`, align: 'center' },
          { startCol: 4, endCol: 4, text: `${fmtNum(bloque.totalTn)} TN`, align: 'center' },
          { startCol: 5, endCol: 11, text: '', align: 'left' },
        ], {
          bg: [226, 232, 240],
          bold: true,
          topSeparatorColor: [27, 116, 48],
          topSeparatorWidth: 1,
        });

        if (blockUsd > 0) {
          drawMergedRow([
            { startCol: 0, endCol: 11, text: `Total Dolares: $${fmtNum(blockUsd)}`, align: 'left' },
          ], {
            bold: true,
            topSeparatorColor: [27, 116, 48],
            topSeparatorWidth: 1,
          });
          globalUsd += blockUsd;
        }
        if (blockPen > 0) {
          drawMergedRow([
            { startCol: 0, endCol: 11, text: `Total Soles: S/${fmtNum(blockPen)}`, align: 'left' },
          ], {
            bold: true,
            topSeparatorColor: [27, 116, 48],
            topSeparatorWidth: 1,
          });
          globalPen += blockPen;
        }

        y += 3;
      });

      const totalWidth = colWidths.reduce((a, b) => a + b, 0);
      ensureSpace(56);
      pdf.setFillColor(232, 245, 233);
      pdf.rect(marginX, y, totalWidth, 56, 'F');
      pdf.setDrawColor(27, 116, 48);
      pdf.setLineWidth(0.8);
      pdf.rect(marginX, y, totalWidth, 56);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text('TOTALES GENERALES', marginX + 6, y + 14);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(31, 41, 55);
      pdf.text(`Total TN: ${fmtNum(data.totalesGenerales.totalTn)} TN`, marginX + 6, y + 28);
      if (globalUsd > 0) {
        pdf.text(`Total Dolares: $${fmtNum(globalUsd)}`, marginX + 6, y + 40);
      }
      if (globalPen > 0) {
        pdf.text(`Total Soles: S/${fmtNum(globalPen)}`, marginX + 6, y + 52);
      }

      const blobUrl = URL.createObjectURL(pdf.output('blob'));
      const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        console.warn('El navegador bloqueó la pestaña de vista previa del PDF.');
      }
    } catch (error) {
      console.error('Error generando PDF dinamico de guias:', error);
    }
  };

  const handleDownloadExcel = async () => {
    if (!data || data.error) return;
    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Guias Emitidas');
      const generatedAt = new Date().toLocaleString('es-PE');
      const semanaLabel = semana ? `Semana ${semana}` : 'Todo el mes';

      worksheet.views = [{ state: 'frozen', ySplit: 6 }];
      worksheet.columns = [
        { key: 'fecha', width: 14 },
        { key: 'grt', width: 18 },
        { key: 'conductor', width: 28 },
        { key: 'tnEnviada', width: 13 },
        { key: 'tnRecibida', width: 13 },
        { key: 'ticket', width: 13 },
        { key: 'grr', width: 16 },
        { key: 'cliente', width: 24 },
        { key: 'recorrido', width: 24 },
        { key: 'material', width: 20 },
        { key: 'precio', width: 12 },
        { key: 'divisa', width: 9 },
        { key: 'importe', width: 14 },
      ];

      worksheet.mergeCells('A1:B2');
      worksheet.getCell('A1').value = '';
      worksheet.mergeCells('C1:M1');
      worksheet.getCell('C1').value = `${data.empresa} - TRANSPORTE SEGUN GUIAS EMITIDAS`;
      worksheet.getCell('C1').font = { bold: true, size: 15, color: { argb: 'FF1B7430' } };
      worksheet.getCell('C1').alignment = { horizontal: 'left', vertical: 'middle' };

      worksheet.mergeCells('C2:M2');
      worksheet.getCell('C2').value = `Generado: ${generatedAt}`;
      worksheet.getCell('C2').font = { size: 10, color: { argb: 'FF4B5563' } };

      worksheet.mergeCells('A4:M4');
      worksheet.getCell('A4').value = `Mes: ${data.mes} | ${semanaLabel} | Empresa: ${empresa === 'TODAS' ? 'Todas las empresas' : data.empresa}`;
      worksheet.getCell('A4').font = { bold: true, size: 10, color: { argb: 'FF374151' } };
      worksheet.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5F4E7' } };

      try {
        const logoResponse = await fetch(logoEmpresa);
        const logoBlob = await logoResponse.blob();
        const logoBase64 = await toBase64(logoBlob);
        const imageId = workbook.addImage({
          base64: logoBase64,
          extension: 'png',
        });
        worksheet.addImage(imageId, {
          tl: { col: 0.1, row: 0.16 },
          ext: { width: 130, height: 60 },
          editAs: 'oneCell',
        });
      } catch (logoError) {
        console.warn('No se pudo insertar el logo en Excel de guias:', logoError);
      }

      const applySummaryRowStyle = (row, { fillColor, centerFirst = true, centerTn = true } = {}) => {
        row.height = 20;
        for (let c = 1; c <= 13; c++) {
          const cell = row.getCell(c);
          if (fillColor) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF1B7430' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          cell.font = { bold: true, size: 10, color: { argb: 'FF1E2A3A' } };
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }

        if (centerFirst) {
          row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        if (centerTn) {
          row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        }
      };

      const headerRowNum = 6;
      const headerRow = worksheet.getRow(headerRowNum);
      headerRow.values = ['Fecha', 'Guia (Transp.)', 'Conductor', 'TN Enviada', 'TN Recibida', 'N Ticket', 'Guia (Remitente)', 'Cliente', 'Recorrido', 'Material', 'Precio IGV', 'Divisa', 'Importe Total'];
      headerRow.height = 22;

      const headerFills = ['FF2563EB', 'FF2563EB', 'FF2563EB', 'FF5B21B6', 'FF5B21B6', 'FFB45309', 'FFB45309', 'FF145524', 'FF145524', 'FF145524', 'FF7F1D1D', 'FF2563EB', 'FF7F1D1D'];
      for (let col = 1; col <= 13; col++) {
        const cell = headerRow.getCell(col);
        cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFills[col - 1] } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };
      }

      let previousEmpresa = null;
      for (const bloque of data.bloques) {
        if (empresa === 'TODAS' && bloque.empresaNombre && bloque.empresaNombre !== previousEmpresa) {
          const row = worksheet.addRow([bloque.empresaNombre]);
          worksheet.mergeCells(row.number, 1, row.number, 13);
          row.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
          row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D3D19' } };
          previousEmpresa = bloque.empresaNombre;
        }

        const placaRow = worksheet.addRow([`UNID: ${bloque.placa}`]);
        worksheet.mergeCells(placaRow.number, 1, placaRow.number, 13);
        placaRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1B7430' } };
        placaRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };

        for (const sem of bloque.semanas) {
          for (const v of sem.viajes) {
            const divisa = v.divisa === 'PEN' ? 'S/' : '$';
            const row = worksheet.addRow([
              v.fecha ? String(v.fecha).substring(0, 10) : '',
              v.grt || '',
              v.conductor || '',
              `${(Number(v.peso) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TN`,
              `${(Number(v.pesoMina) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TN`,
              v.ticket || '',
              v.grr || '',
              v.cliente || '',
              v.recorrido || '',
              v.material || '',
              `${divisa}${(Number(v.precio) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              v.divisa || '',
              `${divisa}${(Number(v.importeTotal) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            ]);

            row.eachCell((cell) => {
              cell.font = { size: 9, color: { argb: 'FF1E2A3A' } };
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
              cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              };
            });
          }

          const subRow = worksheet.addRow([`Semana ${sem.semana}`, '', '', '', `${(Number(sem.totalTn) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TN`]);
          worksheet.mergeCells(subRow.number, 1, subRow.number, 4);
          worksheet.mergeCells(subRow.number, 6, subRow.number, 13);
          applySummaryRowStyle(subRow, { fillColor: 'FFF1F5F9', centerFirst: true, centerTn: true });
        }

        const totalRow = worksheet.addRow([`TOTAL ${bloque.placa}`, '', '', '', `${(Number(bloque.totalTn) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TN`]);
        worksheet.mergeCells(totalRow.number, 1, totalRow.number, 4);
        worksheet.mergeCells(totalRow.number, 6, totalRow.number, 13);
        applySummaryRowStyle(totalRow, { fillColor: 'FFE2E8F0', centerFirst: true, centerTn: true });

        if (Number(bloque.totalDolares) > 0) {
          const usdRow = worksheet.addRow([`Total Dolares: $${Number(bloque.totalDolares).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
          worksheet.mergeCells(usdRow.number, 1, usdRow.number, 13);
          applySummaryRowStyle(usdRow, { fillColor: null, centerFirst: false, centerTn: false });
          usdRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
        }
        if (Number(bloque.totalSoles) > 0) {
          const penRow = worksheet.addRow([`Total Soles: S/${Number(bloque.totalSoles).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
          worksheet.mergeCells(penRow.number, 1, penRow.number, 13);
          applySummaryRowStyle(penRow, { fillColor: null, centerFirst: false, centerTn: false });
          penRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
        }
        worksheet.addRow([]);
      }

      const titleTotals = worksheet.addRow(['TOTALES GENERALES']);
      worksheet.mergeCells(titleTotals.number, 1, titleTotals.number, 13);
      titleTotals.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      titleTotals.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B7430' } };

      worksheet.addRow([`Total TN: ${(Number(data.totalesGenerales.totalTn) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TN`]);
      if (Number(data.totalesGenerales.totalDolares) > 0) {
        worksheet.addRow([`Total Dolares: $${Number(data.totalesGenerales.totalDolares).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
      }
      if (Number(data.totalesGenerales.totalSoles) > 0) {
        worksheet.addRow([`Total Soles: S/${Number(data.totalesGenerales.totalSoles).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
      }

      worksheet.getRow(1).height = 34;
      worksheet.getRow(2).height = 22;
      worksheet.getRow(4).height = 20;

      const fileName = `Guias_${data.empresa}_${data.mes}${semana ? `_Sem${semana}` : ''}.xlsx`.replace(/\s+/g, '_');
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
      console.error('Error exportando Excel de guias:', error);
    }
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
              {meses.map(m => <option key={m} value={m}>{toTitleCase(m)}</option>)}
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
