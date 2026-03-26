import { useState, useEffect, useRef } from 'react';
import { dashboardService } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import logoEmpresa from '../assets/Images/logo-empresa.png';
import './ViajesCliente.css';

const ViajesCliente = () => {
  const [clientes, setClientes] = useState([]);
  const [placas, setPlacas] = useState([]);
  const [meses, setMeses] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [selectedPlaca, setSelectedPlaca] = useState('');
  const [selectedMes, setSelectedMes] = useState('');
  const [diasViajes, setDiasViajes] = useState([]);
  const [viajesPorPlaca, setViajesPorPlaca] = useState([]);
  const [resumen, setResumen] = useState({ viajes: 0, traslados: 0 });
  const [loading, setLoading] = useState(true);
  const contentRef = useRef(null);
  const graficPlacaRef = useRef(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingPlacaPdf, setExportingPlacaPdf] = useState(false);

  // Paleta de colores equilibrada
  const COLORS = [
    '#1B7430', '#4A86B8', '#C4883A', '#8E6BAD', '#3A9E9E',
    '#C06050', '#5D8A5D', '#6882A8', '#B87840', '#9E6575'
  ];

  // Cargar filtros iniciales y cuando cambian los filtros seleccionados
  useEffect(() => {
    loadFiltros();
  }, [selectedCliente, selectedPlaca, selectedMes]);

  // Cargar datos cuando cambian los filtros
  useEffect(() => {
    loadData();
  }, [selectedCliente, selectedPlaca, selectedMes]);

  const loadFiltros = async () => {
    try {
      const filters = {};
      if (selectedCliente) filters.cliente = selectedCliente;
      if (selectedPlaca) filters.unidad = selectedPlaca;
      if (selectedMes) filters.mes = selectedMes;
      const segmentadores = await dashboardService.getSegmentadoresFiltrados(filters);
      setClientes(segmentadores.clientes || []);
      setPlacas(segmentadores.unidades || []);
      setMeses(segmentadores.meses || []);
    } catch (error) {
      console.error('Error cargando filtros:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (selectedCliente) filters.cliente = selectedCliente;
      if (selectedPlaca) filters.unidad = selectedPlaca;
      if (selectedMes) filters.mes = selectedMes;

      console.log('[ViajesCliente] Cargando datos con filtros:', filters);

      const [diasRes, placasRes, resumenRes] = await Promise.all([
        dashboardService.getDiasConViajes(filters),
        dashboardService.getViajesPorPlaca(filters),
        dashboardService.getResumenViajesCliente(filters),
      ]);

      console.log('[ViajesCliente] getDiasConViajes — total filas:', diasRes?.length);
      if (diasRes?.length > 0) {
        console.log('[ViajesCliente] Primeras 3 filas:', diasRes.slice(0, 3));
        console.log('[ViajesCliente] Tipos fila[0]:', {
          fecha: typeof diasRes[0].fecha, fechaVal: diasRes[0].fecha,
          traslados: typeof diasRes[0].traslados, trasladosVal: diasRes[0].traslados,
          tonelaje_recibido: typeof diasRes[0].tonelaje_recibido, tonelajeVal: diasRes[0].tonelaje_recibido,
        });
      }
      console.log('[ViajesCliente] getViajesPorPlaca — total filas:', placasRes?.length);
      console.log('[ViajesCliente] getResumenViajesCliente:', resumenRes);

      setDiasViajes(diasRes || []);
      setViajesPorPlaca((placasRes || []).map(item => ({ ...item, viajes: parseInt(item.viajes) || 0 })));
      setResumen(resumenRes || { viajes: 0, traslados: 0 });
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFecha = (fecha) => {
    if (!fecha) return '-';
    // Parsear solo la parte YYYY-MM-DD para evitar el desfase de timezone UTC-5.
    // Si hacemos new Date("2026-01-01T00:00:00.000Z") en Peru, da 31/12/2025.
    const dateStr = typeof fecha === 'string' ? fecha.substring(0, 10) : new Date(fecha).toISOString().substring(0, 10);
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // fecha local, sin UTC
    return date.toLocaleDateString('es-PE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatFechaCorta = (fecha) => {
    if (!fecha) return '-';
    const dateStr = typeof fecha === 'string' ? fecha.substring(0, 10) : new Date(fecha).toISOString().substring(0, 10);
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const limpiarFiltros = () => {
    setSelectedCliente('');
    setSelectedPlaca('');
    setSelectedMes('');
  };

  const capitalizeText = (text) => {
    if (!text) return '';
    return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  const toBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const descargarPDF = async () => {
    if (!contentRef.current) return;
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

      const captureChartImage = async () => {
        if (!graficPlacaRef.current) return null;
        const sourceChart = graficPlacaRef.current.querySelector('.grafico-container') || graficPlacaRef.current;
        const clone = sourceChart.cloneNode(true);
        clone.style.width = `${sourceChart.scrollWidth}px`;
        clone.style.maxWidth = 'none';
        clone.style.background = '#ffffff';
        clone.style.opacity = '1';

        clone.querySelectorAll('button').forEach((btn) => {
          btn.style.display = 'none';
        });

        const wrapper = document.createElement('div');
        wrapper.style.position = 'fixed';
        wrapper.style.left = '-10000px';
        wrapper.style.top = '0';
        wrapper.style.width = `${sourceChart.scrollWidth}px`;
        wrapper.style.background = '#ffffff';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        const canvas = await html2canvas(clone, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
        });

        document.body.removeChild(wrapper);
        return {
          dataUrl: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height,
        };
      };

      const filterParts = [];
      if (selectedMes) filterParts.push(capitalizeText(selectedMes));
      if (selectedCliente) filterParts.push(capitalizeText(selectedCliente));
      if (selectedPlaca) filterParts.push(`Placa: ${selectedPlaca.toUpperCase()}`);
      const subtitle = filterParts.length > 0 ? filterParts.join(' \u2014 ') : 'General';
      const logoDataUrl = await loadImageAsDataUrl(logoEmpresa).catch(() => null);
      const chartCapture = await captureChartImage().catch(() => null);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 24;
      const contentTop = addPdfHeader(pdf, 'Viajes por Cliente', subtitle, logoDataUrl);

      const cardGap = 14;
      const cardY = contentTop + 10;
      const cardH = 58;
      const cardW = (pageWidth - marginX * 2 - cardGap) / 2;

      const drawKpiCard = (x, y, w, h, title, value, subtitleText) => {
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(220, 230, 223);
        pdf.setLineWidth(1);
        pdf.roundedRect(x, y, w, h, 6, 6, 'FD');
        pdf.setDrawColor(27, 116, 48);
        pdf.setLineWidth(2);
        pdf.line(x, y + 4, x, y + h - 4);

        pdf.setTextColor(102, 102, 102);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text(title, x + 12, y + 16);

        pdf.setTextColor(27, 116, 48);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(20);
        pdf.text(String(value ?? 0), x + 12, y + 38);

        pdf.setTextColor(122, 122, 122);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.text(subtitleText, x + 12, y + 50);
      };

      drawKpiCard(marginX, cardY, cardW, cardH, 'VIAJES', resumen.viajes || 0, 'Por fecha y cliente');
      drawKpiCard(marginX + cardW + cardGap, cardY, cardW, cardH, 'TRASLADOS', resumen.traslados || 0, 'Total documentos');

      const bodyY = cardY + cardH + 12;
      const bodyH = pageHeight - bodyY - 16;
      const tableW = Math.max(250, (pageWidth - marginX * 2) * 0.36);
      const chartW = pageWidth - marginX * 2 - tableW - cardGap;
      const tableX = marginX;
      const chartX = tableX + tableW + cardGap;

      pdf.setTextColor(51, 51, 51);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Dias con Viajes', tableX, bodyY + 12);
      pdf.setDrawColor(27, 116, 48);
      pdf.setLineWidth(1.2);
      pdf.line(tableX, bodyY + 16, tableX + 110, bodyY + 16);

      const tHeadY = bodyY + 22;
      const tHeadH = 18;
      const colFecha = tableW * 0.43;
      const colTras = tableW * 0.20;
      const colTon = tableW - colFecha - colTras;

      pdf.setFillColor(245, 247, 249);
      pdf.rect(tableX, tHeadY, tableW, tHeadH, 'F');
      pdf.setTextColor(45, 45, 45);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.2);
      pdf.text('Fecha', tableX + 5, tHeadY + 12);
      pdf.text('Traslados', tableX + colFecha + 5, tHeadY + 12);
      pdf.text('Tonelaje Recibido', tableX + colFecha + colTras + 5, tHeadY + 12);

      const rows = diasViajes || [];
      const availableRowsHeight = bodyY + bodyH - (tHeadY + tHeadH) - 2;
      const rowHeight = Math.max(9, Math.min(13, rows.length > 0 ? availableRowsHeight / rows.length : 11));
      let y = tHeadY + tHeadH;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.8);
      rows.forEach((dia, idx) => {
        if (y + rowHeight > bodyY + bodyH) return;

        if (idx % 2 === 1) {
          pdf.setFillColor(251, 252, 253);
          pdf.rect(tableX, y, tableW, rowHeight, 'F');
        }

        const fecha = formatFecha(dia.fecha);
        const traslados = String(parseInt(dia.traslados, 10) || 0);
        const ton = dia.tonelaje_recibido != null
          ? `${Number(dia.tonelaje_recibido).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TN`
          : '-';

        pdf.setTextColor(34, 34, 34);
        pdf.text(fecha, tableX + 5, y + rowHeight - 3);
        pdf.text(traslados, tableX + colFecha + 5, y + rowHeight - 3);
        pdf.text(ton, tableX + colFecha + colTras + 5, y + rowHeight - 3);

        pdf.setDrawColor(236, 236, 236);
        pdf.line(tableX, y + rowHeight, tableX + tableW, y + rowHeight);
        y += rowHeight;
      });

      const chartTitle = isThreeFiltersSelected ? 'Tonelaje por Fecha' : 'Traslados por Placa';
      pdf.setTextColor(51, 51, 51);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(chartTitle, chartX, bodyY + 12);
      pdf.setDrawColor(27, 116, 48);
      pdf.setLineWidth(1.2);
      pdf.line(chartX, bodyY + 16, chartX + 130, bodyY + 16);

      const chartTop = bodyY + 18;
      const chartHeight = bodyH - 4;
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(235, 235, 235);
      pdf.rect(chartX, chartTop, chartW, chartHeight, 'FD');

      if (chartCapture?.dataUrl) {
        const ratio = Math.min(
          (chartW - 8) / chartCapture.width,
          (chartHeight - 8) / chartCapture.height,
        );
        const renderWidth = chartCapture.width * ratio;
        const renderHeight = chartCapture.height * ratio;
        pdf.addImage(
          chartCapture.dataUrl,
          'PNG',
          chartX + (chartW - renderWidth) / 2,
          chartTop + (chartHeight - renderHeight) / 2,
          renderWidth,
          renderHeight,
        );
      }

      pdf.save('Viajes_por_Cliente.pdf');
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  const descargarDiasExcel = async () => {
    if (diasViajes.length === 0) return;
    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Dias con Viajes');
      worksheet.views = [{ state: 'frozen', ySplit: 6 }];

      worksheet.columns = [
        { key: 'fecha', width: 18 },
        { key: 'traslados', width: 18 },
        { key: 'tonelaje', width: 34 },
      ];

      worksheet.mergeCells('A1:A2');
      worksheet.getCell('A1').value = '';

      worksheet.mergeCells('B1:C1');
      worksheet.getCell('B1').value = 'ECOTRANSPORTE - REPORTE DE DIAS CON VIAJES';
      worksheet.getCell('B1').font = { bold: true, size: 15, color: { argb: 'FF1B7430' } };
      worksheet.getCell('B1').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      worksheet.mergeCells('B2:C2');
      worksheet.getCell('B2').value = `Generado: ${new Date().toLocaleString('es-PE')}`;
      worksheet.getCell('B2').font = { size: 10, color: { argb: 'FF4B5563' } };
      worksheet.getCell('B2').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      const filterParts = [];
      if (selectedMes) filterParts.push(capitalizeText(selectedMes));
      if (selectedCliente) filterParts.push(capitalizeText(selectedCliente));
      if (selectedPlaca) filterParts.push(`Placa: ${selectedPlaca.toUpperCase()}`);
      const filterText = filterParts.length > 0 ? filterParts.join(' - ') : 'Sin filtros';

      worksheet.mergeCells('A4:C4');
      worksheet.getCell('A4').value = `Total dias exportados: ${diasViajes.length} | Filtros: ${filterText}`;
      worksheet.getCell('A4').font = { bold: true, size: 10, color: { argb: 'FF374151' } };
      worksheet.getCell('A4').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      worksheet.getCell('A4').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5F4E7' },
      };

      try {
        const logoResponse = await fetch(logoEmpresa);
        const logoBlob = await logoResponse.blob();
        const logoBase64 = await toBase64(logoBlob);
        const imageId = workbook.addImage({
          base64: logoBase64,
          extension: 'png',
        });
        worksheet.addImage(imageId, {
          tl: { col: 0.08, row: 0.12 },
          ext: { width: 128, height: 52 },
          editAs: 'oneCell',
        });
      } catch (logoError) {
        console.warn('No se pudo insertar el logo en Excel:', logoError);
      }

      const headerRowNumber = 6;
      const headerRow = worksheet.getRow(headerRowNumber);
      headerRow.values = ['Fecha', 'Traslados', 'Tonelaje Recibido (TN)'];
      headerRow.height = 24;

      for (let col = 1; col <= 3; col++) {
        const cell = headerRow.getCell(col);
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1B7430' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF15803D' } },
          left: { style: 'thin', color: { argb: 'FF15803D' } },
          bottom: { style: 'thin', color: { argb: 'FF15803D' } },
          right: { style: 'thin', color: { argb: 'FF15803D' } },
        };
      }

      diasViajes.forEach((dia) => {
        const trasladoCount = parseInt(dia.traslados, 10) || 0;
        const tonelajeRecibido = Number(dia.tonelaje_recibido);

        const row = worksheet.addRow({
          fecha: formatFecha(dia.fecha),
          traslados: trasladoCount,
          tonelaje: Number.isFinite(tonelajeRecibido) ? tonelajeRecibido : 0,
        });

        row.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 1 ? 'left' : 'center',
            wrapText: false,
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
        });

        row.getCell(3).numFmt = '#,##0.00';
      });

      worksheet.autoFilter = {
        from: { row: headerRowNumber, column: 1 },
        to: { row: headerRowNumber, column: 3 },
      };

      worksheet.getRow(1).height = 40;
      worksheet.getRow(2).height = 22;
      worksheet.getRow(4).height = 24;

      worksheet.getCell('A1').value = '';

      const fileName = `dias_con_viajes_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      console.error('Error exportando dias con viajes a Excel:', error);
    }
  };

  const descargarPlacaPDF = async () => {
    if (!graficPlacaRef.current) return;
    setExportingPlacaPdf(true);
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

      const filterParts = [];
      if (selectedMes) filterParts.push(capitalizeText(selectedMes));
      if (selectedCliente) filterParts.push(capitalizeText(selectedCliente));
      if (selectedPlaca) filterParts.push(`Placa: ${selectedPlaca.toUpperCase()}`);
      const subtitle = filterParts.length > 0 ? filterParts.join(' \u2014 ') : 'General';

      const clone = graficPlacaRef.current.cloneNode(true);
      clone.style.width = `${graficPlacaRef.current.scrollWidth}px`;
      clone.style.maxWidth = 'none';
      clone.style.background = '#ffffff';
      clone.style.opacity = '1';

      clone.querySelectorAll('button').forEach((btn) => {
        btn.style.display = 'none';
      });

      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-10000px';
      wrapper.style.top = '0';
      wrapper.style.width = `${graficPlacaRef.current.scrollWidth}px`;
      wrapper.style.background = '#ffffff';
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
      });
      document.body.removeChild(wrapper);

      const logoDataUrl = await loadImageAsDataUrl(logoEmpresa).catch(() => null);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 24;
      const contentTop = addPdfHeader(pdf, 'Traslados por Placa', subtitle, logoDataUrl);
      const maxWidth = pageWidth - marginX * 2;
      const maxHeight = pageHeight - contentTop - 18;
      const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
      const renderWidth = canvas.width * ratio;
      const renderHeight = canvas.height * ratio;
      const imgData = canvas.toDataURL('image/png');

      pdf.addImage(imgData, 'PNG', (pageWidth - renderWidth) / 2, contentTop, renderWidth, renderHeight);
      pdf.save('Traslados_por_Placa.pdf');
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setExportingPlacaPdf(false);
    }
  };

  const isThreeFiltersSelected = Boolean(selectedMes && selectedCliente && selectedPlaca);
  const toneladasPorFecha = (diasViajes || []).map((dia) => ({
    fechaLabel: formatFechaCorta(dia.fecha),
    fechaFull: formatFecha(dia.fecha),
    tonelaje: Number(dia.tonelaje_recibido) || 0,
    traslados: parseInt(dia.traslados, 10) || 0,
  }));
  const hasChartData = isThreeFiltersSelected ? toneladasPorFecha.length > 0 : viajesPorPlaca.length > 0;

  return (
    <div className="viajes-cliente-container">
      <h1>Viajes por Cliente</h1>

      {/* Filtros */}
      <div className="filtros-viajes">
        <div className="filtro-group">
          <label>Mes</label>
          <select
            value={selectedMes}
            onChange={(e) => setSelectedMes(e.target.value)}
          >
            <option value="">-- Todos --</option>
            {meses.map((mes, idx) => (
              <option key={idx} value={mes}>{mes}</option>
            ))}
          </select>
        </div>

        <div className="filtro-group">
          <label>Cliente</label>
          <select
            value={selectedCliente}
            onChange={(e) => setSelectedCliente(e.target.value)}
          >
            <option value="">-- Todos --</option>
            {clientes.map((cliente, idx) => (
              <option key={idx} value={cliente}>{cliente}</option>
            ))}
          </select>
        </div>

        <div className="filtro-group">
          <label>Placa (Unidad)</label>
          <select
            value={selectedPlaca}
            onChange={(e) => setSelectedPlaca(e.target.value)}
          >
            <option value="">-- Todas --</option>
            {placas.map((placa, idx) => (
              <option key={idx} value={placa}>{placa}</option>
            ))}
          </select>
        </div>

        <button className="btn-limpiar" onClick={limpiarFiltros}>
          Limpiar Filtros
        </button>

        <button
          className="btn-limpiar"
          onClick={descargarPDF}
          disabled={exportingPdf}
          style={{ marginLeft: 'auto', background: '#1B7430', color: '#fff', border: 'none' }}
        >
          {exportingPdf ? 'Generando...' : '\uD83D\uDCE5 Descargar PDF'}
        </button>
      </div>

      {loading ? (
        <div className="loading-section"><div className="spinner"></div></div>
      ) : (
        <div ref={contentRef}>
          {/* Indicadores */}
          <div className="indicadores-viajes">
            <div className="indicador-card">
              <div className="indicador-icon">🚛</div>
              <div className="indicador-content">
                <h3>Viajes</h3>
                <p className="indicador-value">{resumen.viajes}</p>
                <span className="indicador-label">Por fecha y cliente</span>
              </div>
            </div>

            <div className="indicador-card">
              <div className="indicador-icon">🚛</div>
              <div className="indicador-content">
                <h3>Traslados</h3>
                <p className="indicador-value">{resumen.traslados}</p>
                <span className="indicador-label">Total documentos</span>
              </div>
            </div>
          </div>

          {/* Contenido principal */}
          <div className="contenido-viajes">
            {/* Lista de días */}
            <div className="seccion-dias">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Días con Viajes</h2>
                <button
                  className="btn-limpiar"
                  onClick={descargarDiasExcel}
                  disabled={diasViajes.length === 0}
                  style={{ background: '#1B7430', color: '#fff', border: 'none', fontSize: 13, padding: '6px 14px' }}
                >
                  📥 Descargar Excel
                </button>
              </div>
              {diasViajes.length === 0 ? (
                <p className="empty-message">No hay viajes registrados</p>
              ) : (
                <div className="tabla-dias">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Traslados</th>
                        <th>Tonelaje Recibido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diasViajes.map((dia, idx) => (
                        <tr key={idx}>
                          <td>{formatFecha(dia.fecha)}</td>
                          <td>{dia.traslados}</td>
                          <td>
                            {dia.tonelaje_recibido != null
                              ? `${Number(dia.tonelaje_recibido).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TN`
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Gráfico de barras */}
            <div className="seccion-grafico" ref={graficPlacaRef}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>
                  {isThreeFiltersSelected ? 'Tonelaje por Fecha' : 'Traslados por Placa'}
                </h2>
                <button
                  className="btn-limpiar"
                  onClick={descargarPlacaPDF}
                  disabled={exportingPlacaPdf || !hasChartData}
                  style={{ background: '#1B7430', color: '#fff', border: 'none', fontSize: 13, padding: '6px 14px' }}
                >
                  {exportingPlacaPdf ? 'Generando...' : '\uD83D\uDCE5 Descargar PDF'}
                </button>
              </div>
              {!hasChartData ? (
                <p className="empty-message">No hay datos para mostrar</p>
              ) : (
                <div className="grafico-container">
                  {isThreeFiltersSelected ? (
                    <ResponsiveContainer width="100%" height={Math.max(340, toneladasPorFecha.length * 40)}>
                      <BarChart
                        data={toneladasPorFecha}
                        margin={{ top: 10, right: 30, left: 10, bottom: 32 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="fechaLabel"
                          tick={{ fontSize: 11, fill: '#555' }}
                          angle={-20}
                          textAnchor="end"
                          height={52}
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#555' }} width={75} />
                        <Tooltip
                          formatter={(value, _name, payload) => [
                            `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TN`,
                            `Tonelaje (${payload?.payload?.traslados || 0} traslados)`
                          ]}
                          labelFormatter={(_label, payload) => payload?.[0]?.payload?.fechaFull || 'Fecha'}
                        />
                        <Bar dataKey="tonelaje" name="Tonelaje Recibido">
                          {toneladasPorFecha.map((entry, index) => (
                            <Cell key={`cell-ton-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                          <LabelList
                            dataKey="tonelaje"
                            position="top"
                            style={{ fontSize: 10, fontWeight: 600, fill: '#333' }}
                            formatter={(value) => `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TN`}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(400, viajesPorPlaca.length * 25)}>
                      <BarChart
                        data={viajesPorPlaca}
                        layout="vertical"
                        margin={{ top: 10, right: 60, left: 10, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" hide />
                        <YAxis
                          dataKey="placa"
                          type="category"
                          width={80}
                          tick={{ fontSize: 11, fill: '#555' }}
                        />
                        <Tooltip
                          formatter={(value) => [`${value} traslados`, 'Traslados']}
                          labelFormatter={(label) => `Placa: ${label}`}
                        />
                        <Bar dataKey="viajes" name="Traslados">
                          {viajesPorPlaca.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                          <LabelList dataKey="viajes" position="right" style={{ fontSize: 11, fontWeight: 600, fill: '#333' }} formatter={(value) => Number(value) === 1 ? `${value} traslado` : `${value} traslados`} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViajesCliente;
