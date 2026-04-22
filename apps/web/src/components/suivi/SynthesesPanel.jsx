/* ═══════════════════════════════════════════════════════════════
   SynthesesPanel — Synthèses journalière / hebdo / mensuelle
   Tableaux récapitulatifs + export PDF
   ═══════════════════════════════════════════════════════════════ */

import {
  AlertTriangle,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
} from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';

import api from '../../utils/api/index.js';
import Button from '../ui/Button';

function getISOWeek(d) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function formatMonthISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function SynthesesPanel({ currentUser }) {
  const [mode, setMode] = useState('jour');
  const [dateJour, setDateJour] = useState(formatDateISO(new Date()));
  const [semaine, setSemaine] = useState(getISOWeek(new Date()));
  const [mois, setMois] = useState(formatMonthISO(new Date()));
  const [synthese, setSynthese] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSynthese = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (mode === 'jour') data = await api.getSuiviSyntheseJour(dateJour);
      else if (mode === 'semaine') data = await api.getSuiviSyntheseSemaine(semaine);
      else data = await api.getSuiviSyntheseMois(mois);
      setSynthese(data);
    } catch {
      setError('Erreur chargement synthèse');
    } finally {
      setLoading(false);
    }
  }, [mode, dateJour, semaine, mois]);

  useEffect(() => {
    fetchSynthese();
  }, [fetchSynthese]);

  const handleNavigateDay = (delta) => {
    const d = new Date(dateJour + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setDateJour(formatDateISO(d));
  };

  const handleNavigateWeek = (delta) => {
    const [y, wPart] = semaine.split('-W');
    const w = parseInt(wPart, 10) + delta;
    // Simplifié : on navigue en ajoutant des jours
    const d = new Date(parseInt(y, 10), 0, 4);
    d.setDate(d.getDate() + (w - 1) * 7);
    setSemaine(getISOWeek(d));
  };

  const handleNavigateMonth = (delta) => {
    const [y, m] = mois.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMois(formatMonthISO(d));
  };

  const handleExportPdf = async () => {
    try {
      let blob;
      if (mode === 'jour') blob = await api.exportSuiviSyntheseJourPdf(dateJour);
      else if (mode === 'semaine') blob = await api.exportSuiviSyntheseSemainePdf(semaine);
      else blob = await api.exportSuiviSyntheseMoisPdf(mois);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `synthese-${mode}-${mode === 'jour' ? dateJour : mode === 'semaine' ? semaine : mois}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Erreur export PDF');
    }
  };

  const s = synthese?.summary;

  return (
    <div className="syntheses-panel">
      {/* Mode selector */}
      <div className="syntheses-controls">
        <div className="syntheses-mode-tabs">
          {['jour', 'semaine', 'mois'].map((m) => (
            <Button
              key={m}
              variant="ghost"
              className={`suivi-tab ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'jour' ? 'Jour' : m === 'semaine' ? 'Semaine' : 'Mois'}
            </Button>
          ))}
        </div>

        <div className="syntheses-date-nav">
          <Button
            variant="ghost"
            iconOnly
            className="suivi-nav-btn"
            title="Période précédente"
            aria-label="Période précédente"
            onClick={() =>
              mode === 'jour'
                ? handleNavigateDay(-1)
                : mode === 'semaine'
                  ? handleNavigateWeek(-1)
                  : handleNavigateMonth(-1)
            }
          >
            <ChevronLeft size={18} />
          </Button>

          {mode === 'jour' && (
            <input
              type="date"
              value={dateJour}
              onChange={(e) => setDateJour(e.target.value)}
              className="suivi-date-input"
            />
          )}
          {mode === 'semaine' && (
            <input
              type="week"
              value={semaine}
              onChange={(e) => setSemaine(e.target.value)}
              className="suivi-date-input"
            />
          )}
          {mode === 'mois' && (
            <input
              type="month"
              value={mois}
              onChange={(e) => setMois(e.target.value)}
              className="suivi-date-input"
            />
          )}

          <Button
            variant="ghost"
            iconOnly
            className="suivi-nav-btn"
            title="Période suivante"
            aria-label="Période suivante"
            onClick={() =>
              mode === 'jour'
                ? handleNavigateDay(1)
                : mode === 'semaine'
                  ? handleNavigateWeek(1)
                  : handleNavigateMonth(1)
            }
          >
            <ChevronRight size={18} />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="suivi-btn suivi-btn-pdf"
            onClick={handleExportPdf}
            title="Exporter PDF"
          >
            <Download size={14} /> PDF
          </Button>
        </div>
      </div>

      {error && <div className="suivi-error">{error}</div>}

      {loading ? (
        <div className="suivi-loading">
          <Loader2 size={24} className="animate-spin" /> Chargement…
        </div>
      ) : synthese ? (
        <>
          {/* Résumé global */}
          {s && (
            <div className="syntheses-summary">
              <div className="summary-card">
                <BarChart3 size={20} />
                <div>
                  <span className="summary-value">{s.total_sheets}</span>
                  <span className="summary-label">Fiches</span>
                </div>
              </div>
              <div className="summary-card">
                <Calendar size={20} />
                <div>
                  <span className="summary-value">
                    {s.completed_tasks}/{s.total_tasks}
                  </span>
                  <span className="summary-label">Tâches effectuées</span>
                </div>
              </div>
              <div className="summary-card">
                <BarChart3 size={20} />
                <div>
                  <span className="summary-value">{s.completion_rate}%</span>
                  <span className="summary-label">Taux</span>
                </div>
              </div>
              <div className="summary-card">
                <Calendar size={20} />
                <div>
                  <span className="summary-value">{s.total_time}h</span>
                  <span className="summary-label">Temps total</span>
                </div>
              </div>
            </div>
          )}

          {/* Tableau détaillé */}
          {synthese.sheets?.length > 0 ? (
            <div className="syntheses-table-wrap">
              <table className="syntheses-table">
                <thead>
                  <tr>
                    <th>Personnel</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Fait</th>
                    <th>Non fait</th>
                    <th>Temps (h)</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {synthese.sheets.map((sh) => (
                    <tr key={sh.id} className={sh.stats?.not_done > 0 ? 'row-warning' : 'row-ok'}>
                      <td>
                        {sh.first_name} {sh.last_name}
                      </td>
                      <td>{sh.date}</td>
                      <td>{sh.stats?.total ?? 0}</td>
                      <td>{sh.stats?.done ?? 0}</td>
                      <td>{sh.stats?.not_done ?? 0}</td>
                      <td>{sh.stats?.time ?? 0}</td>
                      <td>
                        <span className={`synthese-badge synthese-badge-${sh.status}`}>
                          {sh.status === 'validated'
                            ? 'Validée'
                            : sh.status === 'submitted'
                              ? 'Soumise'
                              : 'Brouillon'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="suivi-empty">Aucune fiche pour cette période</div>
          )}

          {/* Anomalies */}
          {s?.anomalies?.length > 0 && (
            <div className="syntheses-anomalies">
              <h4>
                <AlertTriangle size={16} /> Anomalies
              </h4>
              <ul>
                {s.anomalies.map((a, i) => (
                  <li key={i}>
                    <strong>{a.person}</strong> ({a.date}) : {a.not_done} tâche(s) non effectuée(s)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

export default memo(SynthesesPanel);
