/* ═══════════════════════════════════════════════════════════════
   SuiviPanel — Module Suivi du Personnel Permanent
   Onglets : Fiches quotidiennes | Synthèses
   ═══════════════════════════════════════════════════════════════ */

import './SuiviPanel.css';

import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  Loader2,
  Users,
} from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';

import api from '../../utils/api/index.js';
import FicheSuivi from './FicheSuivi';
import SynthesesPanel from './SynthesesPanel';

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateFR(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function SuiviPanel({ currentUser }) {
  const [activeTab, setActiveTab] = useState('fiches');
  const [personnel, setPersonnel] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedDate, setSelectedDate] = useState(formatDateISO(new Date()));
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const isAdmin = !!currentUser?.isAdmin;

  // Charger la liste du personnel
  useEffect(() => {
    (async () => {
      try {
        const data = await api.getSuiviPersonnel();
        setPersonnel(data);
        if (data.length > 0 && !selectedPerson) {
          setSelectedPerson(data[0]);
        }
      } catch (err) {
        setError('Erreur chargement personnel');
      }
    })();
  }, []);

  // Charger la fiche quand personne ou date change
  useEffect(() => {
    if (!selectedPerson) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getSuiviSheet(selectedPerson.id, selectedDate);
        if (!cancelled) setSheet(data);
      } catch (err) {
        if (!cancelled) setError('Erreur chargement fiche');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPerson?.id, selectedDate]);

  const handleNavigateDay = useCallback(
    (delta) => {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() + delta);
      setSelectedDate(formatDateISO(d));
    },
    [selectedDate],
  );

  const handleSaveSheet = useCallback(
    async (data) => {
      if (!selectedPerson) return;
      setSaving(true);
      setError(null);
      try {
        const updated = await api.updateSuiviSheet(selectedPerson.id, selectedDate, data);
        setSheet(updated);
      } catch (err) {
        setError('Erreur sauvegarde');
      } finally {
        setSaving(false);
      }
    },
    [selectedPerson, selectedDate],
  );

  const handleExportPdf = useCallback(async () => {
    if (!sheet?.id) return;
    try {
      const blob = await api.exportSuiviSheetPdf(sheet.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fiche-suivi-${selectedPerson?.last_name || 'personnel'}-${selectedDate}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Erreur export PDF');
    }
  }, [sheet?.id, selectedPerson, selectedDate]);

  const handleValidate = useCallback(async () => {
    if (!sheet?.id) return;
    try {
      const updated = await api.validateSuiviSheet(sheet.id);
      setSheet(updated);
    } catch {
      setError('Erreur validation');
    }
  }, [sheet?.id]);

  return (
    <div className="suivi-panel">
      {/* Barre d'onglets */}
      <div className="suivi-tabs-bar">
        <button
          className={`suivi-tab ${activeTab === 'fiches' ? 'active' : ''}`}
          onClick={() => setActiveTab('fiches')}
        >
          <ClipboardCheck size={16} />
          Fiches quotidiennes
        </button>
        <button
          className={`suivi-tab ${activeTab === 'syntheses' ? 'active' : ''}`}
          onClick={() => setActiveTab('syntheses')}
        >
          <FileText size={16} />
          Synthèses
        </button>
      </div>

      {activeTab === 'fiches' && (
        <div className="suivi-fiches-layout">
          {/* ─── Sidebar personnel ─── */}
          <aside className="suivi-sidebar">
            <h3 className="suivi-sidebar-title">
              <Users size={16} /> Personnel
            </h3>
            <div className="suivi-person-list">
              {personnel.map((p) => (
                <button
                  key={p.id}
                  className={`suivi-person-item ${selectedPerson?.id === p.id ? 'selected' : ''}`}
                  onClick={() => setSelectedPerson(p)}
                >
                  <span className="suivi-person-name">
                    {p.first_name} {p.last_name}
                  </span>
                  <span className="suivi-person-stats">
                    {p.validated_sheets ?? 0}/{p.total_sheets ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          {/* ─── Zone principale ─── */}
          <main className="suivi-main">
            {/* Nav date */}
            <div className="suivi-date-nav">
              <button className="suivi-nav-btn" onClick={() => handleNavigateDay(-1)}>
                <ChevronLeft size={18} />
              </button>
              <div className="suivi-date-display">
                <Calendar size={16} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="suivi-date-input"
                />
                <span className="suivi-date-label">{formatDateFR(selectedDate)}</span>
              </div>
              <button className="suivi-nav-btn" onClick={() => handleNavigateDay(1)}>
                <ChevronRight size={18} />
              </button>

              <div className="suivi-actions">
                {sheet && (
                  <>
                    <button
                      className="suivi-btn suivi-btn-pdf"
                      onClick={handleExportPdf}
                      title="Exporter PDF"
                    >
                      <Download size={14} /> PDF
                    </button>
                    {isAdmin && sheet.status !== 'validated' && (
                      <button
                        className="suivi-btn suivi-btn-validate"
                        onClick={handleValidate}
                        title="Valider la fiche"
                      >
                        <CheckCircle2 size={14} /> Valider
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Statut */}
            {sheet && (
              <div className={`suivi-status suivi-status-${sheet.status}`}>
                {sheet.status === 'validated'
                  ? '✓ Fiche validée'
                  : sheet.status === 'submitted'
                    ? '◎ Fiche soumise'
                    : '✎ Brouillon'}
              </div>
            )}

            {error && <div className="suivi-error">{error}</div>}

            {loading ? (
              <div className="suivi-loading">
                <Loader2 size={24} className="animate-spin" /> Chargement…
              </div>
            ) : sheet ? (
              <FicheSuivi
                sheet={sheet}
                onSave={handleSaveSheet}
                saving={saving}
                isAdmin={isAdmin}
                currentUser={currentUser}
              />
            ) : (
              <div className="suivi-empty">Sélectionnez un personnel pour voir sa fiche</div>
            )}
          </main>
        </div>
      )}

      {activeTab === 'syntheses' && <SynthesesPanel currentUser={currentUser} />}
    </div>
  );
}

export default memo(SuiviPanel);
