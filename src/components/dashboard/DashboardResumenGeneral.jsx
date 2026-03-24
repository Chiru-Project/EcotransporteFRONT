import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { dashboardService } from '../../services/api';
import TablasDetalladasModal from './TablasDetalladasModal';
import ReporteGuiasModal from './ReporteGuiasModal';
import './DashboardComponents.css';

const fmtNum = (n) => (Number(n) || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DashboardResumenGeneral = () => {
  const [meses, setMeses] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [mes, setMes] = useState('');
  const [semana, setSemana] = useState('');
  const [divisa, setDivisa] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTablas, setShowTablas] = useState(false);
  const [showGuias, setShowGuias] = useState(false);
  const [expandedClients, setExpandedClients] = useState({});
  const dataCacheRef = useRef({});

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const seg = await dashboardService.getSegmentadores();
        const mesesDisponibles = seg?.meses || [];
        setMeses(mesesDisponibles);

        if (mesesDisponibles.length > 0) {
          setMes(mesesDisponibles[0]);
        } else {
          setData(null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error cargando resumen general:', error);
        setData(null);
        setLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    const loadSemanasByMes = async () => {
      if (!mes) return;
      try {
        const segMes = await dashboardService.getSegmentadoresFiltrados({ mes });
        const semanasMes = segMes?.semanas || [];
        setSemanas(semanasMes);
        if (semana && !semanasMes.includes(semana)) {
          setSemana('');
        }
      } catch (error) {
        console.error('Error cargando semanas por mes:', error);
      }
    };

    loadSemanasByMes();
  }, [mes]);

  useEffect(() => {
    const loadResumen = async () => {
      if (!mes) return;

      const cacheKey = `${mes}|${semana || 'all'}`;
      if (dataCacheRef.current[cacheKey]) {
        setData(dataCacheRef.current[cacheKey]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const result = await dashboardService.getTablasDetalladas(mes, semana || undefined);
        dataCacheRef.current[cacheKey] = result;
        setData(result);
      } catch (error) {
        console.error('Error cargando tabla de resumen general:', error);
      } finally {
        setLoading(false);
      }
    };

    loadResumen();
  }, [mes, semana]);

  const getImporteByDivisa = (material, currency) => {
    const raw = Number(material?.data?.general?.importeVenta) || 0;
    return material?.divisa === currency ? raw : 0;
  };

  const groupedData = useMemo(() => {
    if (!data || !Array.isArray(data.grupos)) return [];

    return data.grupos
      .map((grupo) => {
        const materiales = (grupo.materiales || []).filter((mat) => {
          if (!divisa) return true;
          return mat.divisa === divisa;
        });

        const totals = materiales.reduce(
          (acc, mat) => {
            acc.tne += Number(mat?.data?.general?.tne) || 0;
            acc.usd += getImporteByDivisa(mat, 'USD');
            acc.pen += getImporteByDivisa(mat, 'PEN');
            return acc;
          },
          { tne: 0, usd: 0, pen: 0 },
        );

        return {
          cliente: grupo.cliente,
          materiales,
          totals,
        };
      })
      .filter((g) => g.materiales.length > 0);
  }, [data, divisa]);

  useEffect(() => {
    setExpandedClients((prev) => {
      const next = {};
      groupedData.forEach((g) => {
        next[g.cliente] = prev[g.cliente] ?? false;
      });
      return next;
    });
  }, [groupedData]);

  const displayTotals = useMemo(
    () =>
      groupedData.reduce(
        (acc, g) => {
          acc.tne += g.totals.tne;
          acc.usd += g.totals.usd;
          acc.pen += g.totals.pen;
          return acc;
        },
        { tne: 0, usd: 0, pen: 0 },
      ),
    [groupedData],
  );

  const toggleClient = (cliente) => {
    setExpandedClients((prev) => ({
      ...prev,
      [cliente]: !prev[cliente],
    }));
  };

  if (loading) {
    return <div className="loading-section"><div className="spinner"></div></div>;
  }

  if (!data || !Array.isArray(data.grupos)) {
    return <div className="empty-section">No hay datos disponibles</div>;
  }

  return (
    <div className="dashboard-resumen-general">
      <div className="section-card">
        <div className="resumen-general-header">
          <h2>📊 Resumen General</h2>
          <div className="resumen-general-filters">
            <div className="filter-item">
              <label>Mes</label>
              <select value={mes} onChange={(e) => setMes(e.target.value)}>
                {meses.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label>Semana</label>
              <select value={semana} onChange={(e) => setSemana(e.target.value)}>
                <option value="">Todas</option>
                {semanas.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label>Divisa</label>
              <select value={divisa} onChange={(e) => setDivisa(e.target.value)}>
                <option value="">Todas</option>
                <option value="USD">Dólares (USD)</option>
                <option value="PEN">Soles (PEN)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="table-container resumen-general-table-wrap">
          <table className="data-table resumen-general-table">
            <thead>
              <tr>
                <th className="col-cliente-material">Cliente / Material</th>
                <th className="col-general">General (TNE)</th>
                <th className="col-general">General (USD)</th>
                <th className="col-general">General (PEN)</th>
              </tr>
            </thead>
            <tbody>
              {groupedData.map((grupo) => (
                <Fragment key={`bloque-${grupo.cliente}`}>
                  <tr className="fila-cliente-header fila-cliente-resumen" onClick={() => toggleClient(grupo.cliente)}>
                    <td>
                      <button className="btn-toggle-cliente" type="button" aria-label={`Expandir ${grupo.cliente}`}>
                        {expandedClients[grupo.cliente] ? '▼' : '▶'}
                      </button>
                      <span className="cliente-name">{grupo.cliente}</span>
                    </td>
                    <td>{fmtNum(grupo.totals.tne)} TN</td>
                    <td>${fmtNum(grupo.totals.usd)}</td>
                    <td>S/{fmtNum(grupo.totals.pen)}</td>
                  </tr>
                  {expandedClients[grupo.cliente] && grupo.materiales.map((mat) => (
                    <tr key={`${grupo.cliente}-${mat.label}`}>
                      <td className="material-cell">{mat.label}</td>
                      <td>{fmtNum(mat?.data?.general?.tne)} TN</td>
                      <td>${fmtNum(getImporteByDivisa(mat, 'USD'))}</td>
                      <td>S/{fmtNum(getImporteByDivisa(mat, 'PEN'))}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}

              <tr className="fila-total">
                <td>Total General</td>
                <td>{fmtNum(displayTotals.tne)} TN</td>
                <td>${fmtNum(displayTotals.usd)}</td>
                <td>S/{fmtNum(displayTotals.pen)}</td>
              </tr>

              {!groupedData.length && (
                <tr>
                  <td colSpan={4} className="empty-message">No hay datos para la divisa seleccionada</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-card" style={{ textAlign: 'center', display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn-ver-tablas" onClick={() => setShowTablas(true)}>
          📊 Tablas Detalladas
        </button>
        <button className="btn-ver-tablas btn-ver-guias" onClick={() => setShowGuias(true)}>
          🚛 Reporte de Guías
        </button>
      </div>

      <TablasDetalladasModal
        isOpen={showTablas}
        onClose={() => setShowTablas(false)}
        mesesDisponibles={meses}
      />

      <ReporteGuiasModal
        isOpen={showGuias}
        onClose={() => setShowGuias(false)}
      />
    </div>
  );
};

export default DashboardResumenGeneral;
