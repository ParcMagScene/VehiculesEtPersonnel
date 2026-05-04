/* ═══════════════════════════════════════════════════════════════
   SynthesesPanel — Synthèses journalière / hebdo / mensuelle
   Tableaux récapitulatifs + export PDF
   ═══════════════════════════════════════════════════════════════ */

import {
  AlertTriangle,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Loader2,
} from 'lucide-react';
import { Fragment, memo, useCallback, useEffect, useMemo, useState } from 'react';

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

/** Convertit des minutes en "Xh MM" */
function fmtHM(minutes) {
  if (!minutes) return '0h00';
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function SynthesesPanel({ currentUser: _currentUser }) {
  const [mode, setMode] = useState('jour');
  const [dateJour, setDateJour] = useState(formatDateISO(new Date()));
  const [semaine, setSemaine] = useState(getISOWeek(new Date()));
  const [mois, setMois] = useState(formatMonthISO(new Date()));
  const [synthese, setSynthese] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedPersons, setExpandedPersons] = useState(new Set());
  const [onlyPermanents, setOnlyPermanents] = useState(false);

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
  const incidentSummary = synthese?.incidents?.summary || null;
  const incidentByAffaire = Array.isArray(synthese?.incidents?.by_affaire)
    ? synthese.incidents.by_affaire
    : [];

  // Groupement par personne (agrégation des stats)
  const sheetsByPerson = useMemo(() => {
    if (!synthese?.sheets) return [];
    const map = new Map();
    for (const sh of synthese.sheets) {
      const key = sh.person_id;
      if (!map.has(key)) {
        map.set(key, {
          person_id: sh.person_id,
          first_name: sh.first_name,
          last_name: sh.last_name,
          person_type: sh.person_type || '',
          sheets: [],
          stats: {
            total: 0,
            done: 0,
            not_done: 0,
            time: 0,
            unreported_am: false,
            unreported_pm: false,
          },
        });
      }
      const entry = map.get(key);
      entry.sheets.push(sh);
      entry.stats.total += sh.stats?.total ?? 0;
      entry.stats.done += sh.stats?.done ?? 0;
      entry.stats.not_done += sh.stats?.not_done ?? 0;
      entry.stats.time += sh.stats?.time ?? 0;
      if (sh.stats?.unreported_am) entry.stats.unreported_am = true;
      if (sh.stats?.unreported_pm) entry.stats.unreported_pm = true;
    }
    return Array.from(map.values()).sort((a, b) =>
      `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`),
    );
  }, [synthese]);

  const PERMANENT_TYPES = ['permanent', 'apprenti', 'stagiaire'];
  const filteredPersons = useMemo(
    () =>
      onlyPermanents
        ? sheetsByPerson.filter((pg) => PERMANENT_TYPES.includes(pg.person_type))
        : sheetsByPerson,
    [sheetsByPerson, onlyPermanents],
  );

  const togglePerson = (personId) => {
    setExpandedPersons((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

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

          <label
            className="suivi-select-all syntheses-filter-permanents"
            title="Afficher uniquement les permanents, apprentis et stagiaires"
          >
            <input
              type="checkbox"
              checked={onlyPermanents}
              onChange={(e) => setOnlyPermanents(e.target.checked)}
            />
            <span>
              Permanents uniquement
              {onlyPermanents && sheetsByPerson.length > 0 && (
                <em style={{ fontStyle: 'normal', opacity: 0.7, marginLeft: 4 }}>
                  ({filteredPersons.length}/{sheetsByPerson.length})
                </em>
              )}
            </span>
          </label>

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
                  <span className="summary-value">{fmtHM(s.total_time)}</span>
                  <span className="summary-label">Temps total</span>
                </div>
              </div>
              <div className="summary-card">
                <AlertTriangle size={20} />
                <div>
                  <span className="summary-value">{incidentSummary?.total_tickets || 0}</span>
                  <span className="summary-label">Tickets incidents</span>
                </div>
              </div>
              <div className="summary-card">
                <AlertTriangle size={20} />
                <div>
                  <span className="summary-value">{incidentSummary?.total_incidents || 0}</span>
                  <span className="summary-label">Incidents déclarés</span>
                </div>
              </div>
            </div>
          )}

          {/* Tableau par Personnel */}
          {filteredPersons.length > 0 ? (
            <div className="syntheses-table-wrap">
              <table className="syntheses-table">
                <thead>
                  <tr>
                    <th>Personnel</th>
                    {mode !== 'jour' && <th style={{ width: 28 }} />}
                    <th>Total</th>
                    <th>Fait</th>
                    <th>Non fait</th>
                    <th>Temps</th>
                    <th>Contexte</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPersons.map((pg) => {
                    // Une personne en indispo/mission sur toutes ses fiches n'est pas en anomalie pour les non-renseignées
                    const allSheetsHaveContext =
                      pg.sheets.length > 0 &&
                      pg.sheets.every((sh) => {
                        const c = sh.day_context || {};
                        return (
                          c.has_unavailability ||
                          c.has_leave ||
                          c.has_mission ||
                          c.has_enterprise_presence
                        );
                      });
                    const hasWarning =
                      pg.stats.not_done > 0 ||
                      (!allSheetsHaveContext && (pg.stats.unreported_am || pg.stats.unreported_pm));
                    const isExpanded = expandedPersons.has(pg.person_id);
                    const canExpand = mode !== 'jour' && pg.sheets.length > 1;
                    return (
                      <Fragment key={pg.person_id}>
                        <tr
                          className={hasWarning ? 'row-warning' : 'row-ok'}
                          style={canExpand ? { cursor: 'pointer' } : undefined}
                          onClick={canExpand ? () => togglePerson(pg.person_id) : undefined}
                        >
                          <td>
                            <strong>
                              {pg.first_name} {pg.last_name}
                            </strong>
                          </td>
                          {mode !== 'jour' && (
                            <td style={{ textAlign: 'center', opacity: 0.5 }}>
                              {canExpand ? (
                                isExpanded ? (
                                  <ChevronUp size={14} />
                                ) : (
                                  <ChevronDown size={14} />
                                )
                              ) : null}
                            </td>
                          )}
                          <td>{pg.stats.total}</td>
                          <td>{pg.stats.done}</td>
                          <td>{pg.stats.not_done}</td>
                          <td>{fmtHM(pg.stats.time)}</td>
                          <td>
                            {pg.stats.unreported_am && !allSheetsHaveContext && (
                              <span className="synthese-badge synthese-badge-unreported">
                                AM non-renseignée
                              </span>
                            )}
                            {pg.stats.unreported_pm && !allSheetsHaveContext && (
                              <span className="synthese-badge synthese-badge-unreported">
                                PM non-renseignée
                              </span>
                            )}
                          </td>
                        </tr>
                        {canExpand &&
                          isExpanded &&
                          pg.sheets.map((sh) => {
                            const ctx = sh.day_context || {};
                            const hasContext =
                              ctx.has_unavailability ||
                              ctx.has_leave ||
                              ctx.has_mission ||
                              ctx.has_enterprise_presence;
                            const shWarning =
                              sh.stats?.not_done > 0 ||
                              (!hasContext && (sh.stats?.unreported_am || sh.stats?.unreported_pm));
                            const availLabels = (ctx.availabilities || []).map(
                              (a) => a.type_label || a.type,
                            );
                            const missionLabels = (ctx.missions || []).map(
                              (m) => m.title || m.affaire || 'Mission',
                            );
                            const planningAffaires = Array.isArray(ctx.planning_affaires)
                              ? ctx.planning_affaires
                              : [];
                            const planningAlertes = planningAffaires
                              .map((a) => {
                                const num = String(a.affaire_num || '').trim();
                                if (!num) return null;
                                const label = String(a.affaire_label || '').trim();
                                const hasDistinctLabel =
                                  label && label.toLowerCase() !== num.toLowerCase();
                                const base = hasDistinctLabel ? `${num} (${label})` : num;
                                return a.is_tournee
                                  ? `Affaire ${base} [Tournée]`
                                  : `Affaire ${base}`;
                              })
                              .filter(Boolean);
                            return (
                              <tr
                                key={sh.id}
                                className={`syntheses-detail-row ${shWarning ? 'row-warning' : ''}`}
                              >
                                <td style={{ paddingLeft: '2rem', color: 'var(--text-secondary)' }}>
                                  {sh.date}
                                </td>
                                <td />
                                <td>{sh.stats?.total ?? 0}</td>
                                <td>{sh.stats?.done ?? 0}</td>
                                <td>{sh.stats?.not_done ?? 0}</td>
                                <td>{fmtHM(sh.stats?.time ?? 0)}</td>
                                <td>
                                  {sh.stats?.unreported_am && !hasContext && (
                                    <span className="synthese-badge synthese-badge-unreported">
                                      AM
                                    </span>
                                  )}
                                  {sh.stats?.unreported_pm && !hasContext && (
                                    <span className="synthese-badge synthese-badge-unreported">
                                      PM
                                    </span>
                                  )}
                                  {availLabels.map((l, i) => (
                                    <span key={i} className="synthese-badge synthese-badge-avail">
                                      {l}
                                    </span>
                                  ))}
                                  {missionLabels.map((l, i) => (
                                    <span key={i} className="synthese-badge synthese-badge-mission">
                                      {l}
                                    </span>
                                  ))}
                                  {planningAlertes.map((l, i) => (
                                    <span
                                      key={`aff-${i}`}
                                      className="synthese-badge synthese-badge-info"
                                    >
                                      {l}
                                    </span>
                                  ))}
                                </td>
                              </tr>
                            );
                          })}
                      </Fragment>
                    );
                  })}
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
                    <strong>{a.person}</strong> ({a.date}) :{' '}
                    {a.not_done > 0 && `${a.not_done} tâche(s) non effectuée(s)`}
                    {a.not_done > 0 && a.unreported_periods?.length > 0 && ' — '}
                    {a.unreported_periods?.length > 0 &&
                      `Activité non renseignée : ${a.unreported_periods.join(', ')}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Incidents par affaire (periode en cours) */}
          {incidentSummary && incidentSummary.total_tickets === 0 && (
            <div className="syntheses-anomalies" style={{ opacity: 0.6 }}>
              <h4>
                <AlertTriangle size={16} /> Tickets incidents — aucun pour cette période
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem' }}>
                Les incidents sont saisis par semaine. Consultez la semaine concernée ou la vue
                Mois.
              </p>
            </div>
          )}
          {incidentByAffaire.length > 0 && (
            <div className="syntheses-anomalies">
              <h4>
                <AlertTriangle size={16} /> Tickets incidents par affaire
              </h4>
              <ul>
                {incidentByAffaire.slice(0, 10).map((a) => (
                  <li key={a.affaire_num}>
                    <strong>{a.affaire_name || a.affaire_num}</strong> : {a.tickets} ticket(s),{' '}
                    {a.incidents} incident(s)
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
