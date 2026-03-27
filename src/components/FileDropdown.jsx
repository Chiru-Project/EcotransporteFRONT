import { useState } from 'react';
import { documentService, API_URL } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import './FileDropdown.css';

const FileDropdown = ({ document, onUpdate }) => {
  const notification = useNotification();
  const [files, setFiles] = useState(document.documentos || []);
  const [uploading, setUploading] = useState(false);

  const refresh = (updatedDoc) => {
    const urls = updatedDoc.documentos || [];
    setFiles(urls);
    onUpdate && onUpdate(updatedDoc);
  };

  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length === 0) return;
    if (uploading) return;
    setUploading(true);

    for (const file of selected) {
      try {
        const resp = await documentService.uploadFile(document.id, file);
        if (resp.document) {
          refresh(resp.document);
          notification.success(`Archivo "${file.name}" agregado correctamente`);
        }
      } catch (err) {
        notification.error(err.message || `Error subiendo archivo "${file.name}"`);
      }
    }

    setUploading(false);
    e.target.value = null;
  };

  const handleRemove = async (url) => {
    if (!window.confirm('¿Eliminar este archivo?')) return;
    try {
      const resp = await documentService.deleteFile(document.id, url);
      if (resp.document) {
        refresh(resp.document);
        notification.success('Archivo eliminado');
      }
    } catch (err) {
      notification.error(err.message || 'Error eliminando el archivo');
    }
  };

  const onDragStart = (e, idx) => {
    e.dataTransfer.setData('text/plain', idx);
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = async (e, idx) => {
    const from = Number(e.dataTransfer.getData('text/plain'));
    if (isNaN(from) || from === idx) return;
    const newOrder = [...files];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(idx, 0, moved);
    try {
      const resp = await documentService.update(document.id, { documentos: newOrder });
      if (resp.data) {
        refresh(resp.data);
        notification.success('Orden actualizado');
      }
    } catch (err) {
      notification.error(err.message || 'Error reordenando');
    }
  };

  const downloadFile = (url, idx) => {
    const proxyUrl = `${API_URL}/documents/${document.id}/files/${idx}`;
    window.open(proxyUrl, '_blank');
  };

  const getProxyUrl = (idx) => `${API_URL}/documents/${document.id}/files/${idx}`;
  const isPdfUrl = (url) => /\.pdf($|\?)/i.test(url || '') || /\/raw\/upload\//i.test(url || '');


  return (
    <div className="file-dropdown">
      <ul className="file-list">
        {files.map((url, idx) => (
          <li
            key={url}
            className="file-item"
            draggable
            onDragStart={(e) => onDragStart(e, idx)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, idx)}
          >
            <div className="file-preview" onClick={() => window.open(getProxyUrl(idx), '_blank')}>
              {isPdfUrl(url) ? (
                <embed src={getProxyUrl(idx)} type="application/pdf" width="100%" height="80" />
              ) : (
                <img src={getProxyUrl(idx)} alt="preview" />
              )}
            </div>
            <div className="file-actions">
              <button
                className="btn-small btn-download"
                onClick={() => downloadFile(url, idx)}
                title="Descargar"
              >
                ↓
              </button>
              <button className="btn-small btn-delete" onClick={() => handleRemove(url)} title="Eliminar">
                ✕
              </button>
            </div>
          </li>
        ))}
        <li className="file-item add-item">
          <label className="btn-upload">
            {uploading ? 'Subiendo...' : 'Agregar PDF, fotos y archivos'}
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileChange}
              multiple
              hidden
            />
          </label>
        </li>
      </ul>
    </div>
  );
};

export default FileDropdown;
