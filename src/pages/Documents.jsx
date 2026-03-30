import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { documentService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import logoEmpresa from '../assets/Images/logo-empresa.png';
import './Documents.css';
import FileDropdown from '../components/FileDropdown';

const Documents = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const saved = JSON.parse(sessionStorage.getItem('docs_filters') || 'null');
  const [searchTerm, setSearchTerm] = useState(saved?.searchTerm || '');
  const [deleteId, setDeleteId] = useState(null);
  const [currentPage, setCurrentPage] = useState(saved?.currentPage || 1);
  const [openFilesFor, setOpenFilesFor] = useState(null);
  const [filterIncomplete, setFilterIncomplete] = useState(saved?.filterIncomplete || false);
  const [filterDateFrom, setFilterDateFrom] = useState(saved?.filterDateFrom || '');
  const [filterDateTo, setFilterDateTo] = useState(saved?.filterDateTo || '');
  const PAGE_SIZE = 20;
  const notification = useNotification();

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    sessionStorage.setItem('docs_filters', JSON.stringify({
      searchTerm, currentPage, filterIncomplete, filterDateFrom, filterDateTo
    }));
  }, [searchTerm, currentPage, filterIncomplete, filterDateFrom, filterDateTo]);

  const loadDocuments = async () => {
    try {
      const response = await documentService.getAll();
      setDocuments(response.data || []);
    } catch (error) {
      console.error('Error cargando documentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const toBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const formatExcelDate = (value) => {
    if (!value) return '';

    // Evita desfases por zona horaria: si viene YYYY-MM-DD o ISO, se toma la parte de fecha literal.
    const dateText = String(value).trim();
    const isoPrefix = dateText.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoPrefix) {
      const [, year, month, day] = isoPrefix;
      return `${day}/${month}/${year}`;
    }

    const parsed = new Date(dateText);
    if (Number.isNaN(parsed.getTime())) return dateText.substring(0, 10);
    return parsed.toLocaleDateString('es-PE');
  };

  const getAttachedFiles = (doc) => {
    return Array.isArray(doc.documentos) ? doc.documentos.filter(Boolean) : [];
  };

  const getFriendlyFileName = (url) => {
    if (!url) return 'Abrir archivo';
    try {
      const cleanUrl = String(url).split('?')[0];
      const parts = cleanUrl.split('/');
      const rawName = parts[parts.length - 1] || 'archivo';
      return decodeURIComponent(rawName);
    } catch {
      return 'Abrir archivo';
    }
  };

  const handleExportExcel = async () => {
    if (!filteredDocuments.length) {
      notification.warning('No hay documentos para exportar con los filtros actuales');
      return;
    }

    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Documentos');
      worksheet.views = [{ state: 'frozen', ySplit: 6 }];

      worksheet.columns = [
        { key: 'fecha', width: 16 },
        { key: 'grt', width: 18 },
        { key: 'grr', width: 18 },
        { key: 'conductor', width: 34 },
        { key: 'peso', width: 28 },
        { key: 'cliente', width: 34 },
        { key: 'factura', width: 20 },
        { key: 'archivos', width: 60 },
      ];

      worksheet.mergeCells('A1:B2');
      worksheet.getCell('A1').value = '';

      worksheet.mergeCells('C1:H1');
      worksheet.getCell('C1').value = 'ECOTRANSPORTE - REPORTE DE DOCUMENTOS';
      worksheet.getCell('C1').font = { bold: true, size: 15, color: { argb: 'FF1B7430' } };
      worksheet.getCell('C1').alignment = { vertical: 'middle', horizontal: 'left' };

      worksheet.mergeCells('C2:H2');
      worksheet.getCell('C2').value = `Generado: ${new Date().toLocaleString('es-PE')}`;
      worksheet.getCell('C2').font = { size: 10, color: { argb: 'FF4B5563' } };

      worksheet.mergeCells('A4:H4');
      worksheet.getCell('A4').value = `Total documentos exportados: ${filteredDocuments.length}`;
      worksheet.getCell('A4').font = { bold: true, size: 10, color: { argb: 'FF374151' } };
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
        // Inserta el logo dentro del rango A1:B2 para que quede como celda lateral al titulo.
        worksheet.addImage(imageId, 'A1:B2');
      } catch (logoError) {
        console.warn('No se pudo insertar el logo en Excel:', logoError);
      }

      const headerRowNumber = 6;
      const headerRow = worksheet.getRow(headerRowNumber);
      headerRow.values = ['Fecha', 'GRT', 'GRR', 'Conductor', 'Peso Ticket (TN Recibida)', 'Cliente', 'Factura', 'Archivos (Opcional)'];
      headerRow.height = 24;

      for (let col = 1; col <= 8; col++) {
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

      filteredDocuments.forEach((doc) => {
        const files = getAttachedFiles(doc);
        const firstFile = files[0] || '';
        const numericTnRecibida = Number.parseFloat(doc.tn_recibida ?? '');
        const row = worksheet.addRow({
          fecha: formatExcelDate(doc.fecha),
          grt: doc.grt || '',
          grr: doc.grr || '',
          conductor: doc.transportista || '',
          peso: Number.isFinite(numericTnRecibida) ? numericTnRecibida : '',
          cliente: doc.cliente || '',
          factura: doc.anulado ? 'ANULADO' : (doc.factura || ''),
          archivos: firstFile ? getFriendlyFileName(firstFile) : '',
        });

        row.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: 'top',
            horizontal: colNumber === 5 ? 'right' : 'left',
            wrapText: colNumber === 8,
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
        });

        row.getCell(5).numFmt = '#,##0.00';

        // Hiperlink real para abrir el archivo con un clic.
        if (firstFile) {
          row.getCell(8).value = {
            text: files.length > 1
              ? `${getFriendlyFileName(firstFile)} (+${files.length - 1} más)`
              : getFriendlyFileName(firstFile),
            hyperlink: firstFile,
          };
          row.getCell(8).font = {
            color: { argb: 'FF1155CC' },
            underline: true,
          };
          row.getCell(8).alignment = {
            vertical: 'top',
            horizontal: 'left',
            wrapText: false,
          };
        }
      });

      worksheet.autoFilter = {
        from: { row: headerRowNumber, column: 1 },
        to: { row: headerRowNumber, column: 8 },
      };

      worksheet.getRow(1).height = 34;
      worksheet.getRow(2).height = 22;
      worksheet.getRow(4).height = 20;

      // Limpia explícitamente celdas que Google Sheets podría mostrar con valores previos.
      worksheet.getCell('A1').value = '';
      worksheet.getCell('B1').value = '';

      const fileName = `documentos_ecotransporte_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

      notification.success('Reporte Excel exportado correctamente');
    } catch (error) {
      console.error('Error exportando a Excel:', error);
      notification.error('No se pudo exportar el Excel');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este documento?')) return;
    
    setDeleteId(id);
    try {
      await documentService.delete(id);
      setDocuments(documents.filter(doc => doc.id !== id));
      notification.success('Documento eliminado correctamente');
    } catch (error) {
      console.error('Error eliminando documento:', error);
      notification.error('Error al eliminar el documento');
    } finally {
      setDeleteId(null);
    }
  };

  const isIncomplete = (doc) => {
    if (doc?.anulado) return false;

    const hasMotivo = !!String(doc?.motivo || '').trim();
    const missingTarifa = doc?.precio_unitario === null || doc?.precio_unitario === undefined || doc?.precio_unitario === '';

    // Mantener misma regla visual que DocumentDetail: sin tarifa => incompleto.
    return hasMotivo || missingTarifa;
  };

  const incompleteCount = documents.filter(isIncomplete).length;

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch =
      doc.grt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.transportista?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.grr?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.factura?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIncomplete = filterIncomplete ? isIncomplete(doc) : true;
    const docFecha = doc.fecha ? doc.fecha.toString().substring(0, 10) : '';
    const matchesDateFrom = filterDateFrom ? docFecha >= filterDateFrom : true;
    const matchesDateTo = filterDateTo ? docFecha <= filterDateTo : true;
    return matchesSearch && matchesIncomplete && matchesDateFrom && matchesDateTo;
  });

  const getSortTimestamp = (doc) => {
    // Regla principal pedida: ordenar por FECHA del documento (no por created_at).
    const fecha = doc?.fecha ? new Date(doc.fecha).getTime() : Number.NaN;
    if (!Number.isNaN(fecha)) return fecha;

    const fallback = doc?.created_at || doc?.updated_at;
    const parsedFallback = fallback ? new Date(fallback).getTime() : Number.NaN;
    if (!Number.isNaN(parsedFallback)) return parsedFallback;

    return 0;
  };

  const getGuideNumeric = (doc) => {
    const grt = String(doc?.grt || '').trim();
    const match = grt.match(/(\d+)$/);
    return match ? Number.parseInt(match[1], 10) : -1;
  };

  // Orden global: fecha mas antigua primero; desempate por numero de guia menor a mayor.
  filteredDocuments.sort((a, b) => {
    const diff = getSortTimestamp(a) - getSortTimestamp(b);
    if (diff !== 0) return diff;

    const guideDiff = getGuideNumeric(a) - getGuideNumeric(b);
    if (guideDiff !== 0) return guideDiff;

    return (Number(a?.id) || 0) - (Number(b?.id) || 0);
  });

  const totalPages = Math.ceil(filteredDocuments.length / PAGE_SIZE);
  const paginatedDocuments = filteredDocuments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const isoPrefix = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoPrefix) {
      const [, year, month, day] = isoPrefix;
      return `${day}/${month}/${year}`;
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return String(dateString).substring(0, 10);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando documentos...</p>
      </div>
    );
  }

  return (
    <div className="documents-page">
      <div className="documents-header">
        <div className="header-title">
          <img src={logoEmpresa} alt="Logo Empresa" className="page-logo" />
          <h1>📄 Documentos</h1>
        </div>
        <div className="documents-actions">
          <input
            type="text"
            placeholder="Buscar por GRT, transportista, cliente..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
          <div className="date-filter-group">
            <label>Desde:</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
              className="date-filter-input"
            />
            <label>Hasta:</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
              className="date-filter-input"
            />
            {(filterDateFrom || filterDateTo) && (
              <button className="btn-clear-date" onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setCurrentPage(1); }} title="Limpiar filtro de fecha">
                &times;
              </button>
            )}
          </div>
          <button
            className={`btn-filter-incomplete${filterIncomplete ? ' active' : ''}`}
            onClick={() => { setFilterIncomplete(f => !f); setCurrentPage(1); }}
            title="Mostrar solo documentos con datos incompletos (sin tarifa)"
          >
            ⚠️ Incompletos
            {incompleteCount > 0 && (
              <span className="incomplete-badge">{incompleteCount}</span>
            )}
          </button>
          <button
            className="btn-export-excel"
            onClick={handleExportExcel}
            title="Exportar a Excel"
          >
            📊 Exportar Excel
          </button>
          {user?.role === 1 && (
            <div className="documents-quick-actions">
              <Link to="/upload" className="btn-export-excel btn-export-link">
                + Subir PDF
              </Link>
              <Link to="/manual-register" className="btn-export-excel btn-export-link">
                ✏️ Agregar Registro
              </Link>
            </div>
          )}
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="empty-state">
          <p>{searchTerm ? 'No se encontraron documentos' : 'No hay documentos aún'}</p>
          {!searchTerm && user?.role === 1 && (
            <Link to="/upload" className="btn-primary">Subir tu primer PDF</Link>
          )}
        </div>
      ) : (
        <div className="documents-table-container">
          <table className="documents-table">
            <thead>
              <tr>
                <th>Archivos</th>
                <th>Fecha</th>
                <th>GRT</th>
                <th>GRR</th>
                <th>Conductor</th>
                <th>Peso Ticket (TN Recibida)</th>
                <th>Cliente</th>
                <th>Factura</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDocuments.map((doc) => (
                <>
                  <tr key={doc.id} className={`${doc.anulado ? 'row-anulado' : ''} ${isIncomplete(doc) ? 'row-incomplete' : ''}`}>
                    <td className="files-cell">
                      <button
                        className="btn-files"
                        onClick={() => setOpenFilesFor(openFilesFor === doc.id ? null : doc.id)}
                        title="Administrar archivos"
                      >
                        📎
                      </button>
                    </td>
                  <td className="date-col">{formatDate(doc.fecha)}</td>
                  <td className="code">{doc.grt}</td>
                  <td className="code">{doc.grr}</td>
                  <td>{doc.transportista}</td>
                  <td className="number">{doc.tn_recibida}</td>
                  <td>{doc.cliente}</td>
                  <td className="code factura-cell">{doc.factura || <span className="no-factura">—</span>}</td>
                  <td className="actions">
                    <Link to={`/documents/${doc.id}`} className="btn-action btn-view" title="Ver detalle">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </Link>
                    <Link to={`/documents/${doc.id}/edit`} className="btn-action btn-edit" title="Editar">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </Link>
                    {user?.role === 1 && (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="btn-action btn-delete"
                        disabled={deleteId === doc.id}
                        title="Eliminar"
                      >
                        {deleteId === doc.id ? '...' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>}
                      </button>
                    )}
                    </td>
                  </tr>
                  {openFilesFor === doc.id && (
                    <tr className="files-row">
                      <td colSpan="9">
                        <FileDropdown
                          document={doc}
                          onUpdate={(updated) => {
                            setDocuments(docs => docs.map(x => x.id === updated.id ? updated : x));
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>&laquo;</button>
          <button className="page-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>&lsaquo;</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((item, idx) =>
              item === '...' ? (
                <span key={`ellipsis-${idx}`} className="page-ellipsis">&#8230;</span>
              ) : (
                <button
                  key={item}
                  className={`page-btn${currentPage === item ? ' active' : ''}`}
                  onClick={() => setCurrentPage(item)}
                >
                  {item}
                </button>
              )
            )}
          <button className="page-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>&rsaquo;</button>
          <button className="page-btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>&raquo;</button>
        </div>
      )}

      <div className="documents-count">
        Mostrando {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredDocuments.length)} de {filteredDocuments.length} documentos
        {documents.length !== filteredDocuments.length && ` (filtrados de ${documents.length})`}
      </div>
    </div>
  );
};

export default Documents;
