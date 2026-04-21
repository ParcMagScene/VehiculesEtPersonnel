/* ═══════════════════════════════════════════════════════════════
   SuiviPanel — Module Suivi du Personnel Permanent
   Onglets : Fiches quotidiennes | Synthèses
   ═══════════════════════════════════════════════════════════════ */

import './SuiviPanel.css';

import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  Loader2,
  Printer,
  Users,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import Button from '../ui/Button';
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

const TYPE_LABELS = {
  permanent: 'Permanent',
  apprenti: 'Apprenti',
  contractuel: 'Contractuel',
  stagiaire: 'Stagiaire',
};

function SuiviPanel({ currentUser, initialPersonId }) {
  const [activeTab, setActiveTab] = useState('fiches');
  const [personnel, setPersonnel] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedDate, setSelectedDate] = useState(formatDateISO(new Date()));
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedSheetIds, setSelectedSheetIds] = useState(new Set());
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchPrinting, setBatchPrinting] = useState(false);
  const isAdmin = !!currentUser?.isAdmin;

  // Groupes de personnel
  const permanents = useMemo(
    () => personnel.filter((p) => ['permanent', 'apprenti', 'stagiaire'].includes(p.type)),
    [personnel],
  );
  const nonPermanents = useMemo(
    () => personnel.filter((p) => !['permanent', 'apprenti', 'stagiaire'].includes(p.type)),
    [personnel],
  );

  // Charger la liste du personnel
  useEffect(() => {
    (async () => {
      try {
        const data = await api.getSuiviPersonnel();
        setPersonnel(data);
        if (data.length > 0 && !selectedPerson) {
          // Tenter de sélectionner la fiche de l'utilisateur connecté ou initialPersonId
          const userMatch =
            (initialPersonId && data.find((p) => p.id === initialPersonId)) ||
            (currentUser &&
              data.find(
                (p) =>
                  p.id === currentUser.person_id ||
                  (currentUser.first_name &&
                    p.first_name?.toLowerCase() === currentUser.first_name.toLowerCase() &&
                    p.last_name?.toLowerCase() === currentUser.last_name?.toLowerCase()),
              ));
          const firstMatch = userMatch || data.find((p) => p.type === 'permanent') || data[0];
          setSelectedPerson(firstMatch);
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

  // ─── Sélection multi-fiches pour impression ───
  const handleToggleSelect = useCallback(
    (personId) => {
      // On cherche si cette personne a une fiche pour la date sélectionnée
      // On stocke l'ID personne + date pour résoudre les sheet IDs au moment de l'export
      setSelectedSheetIds((prev) => {
        const next = new Set(prev);
        const key = `${personId}__${selectedDate}`;
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [selectedDate],
  );

  // ─── Renderer d'un item personnel ───
  const renderPersonItem = useCallback(
    (p) => (
      <div
        key={p.id}
        className={`suivi-person-item ${selectedPerson?.id === p.id ? 'selected' : ''}`}
      >
        <input
          type="checkbox"
          className="suivi-person-check"
          checked={selectedSheetIds.has(`${p.id}__${selectedDate}`)}
          onChange={() => handleToggleSelect(p.id)}
          onClick={(e) => e.stopPropagation()}
        />
        <Button variant="ghost" className="suivi-person-btn" onClick={() => setSelectedPerson(p)}>
          <div className="suivi-person-info">
            <span className="suivi-person-name">
              {p.first_name} {p.last_name}
            </span>
            <span className={`suivi-person-type suivi-type-${p.type || 'permanent'}`}>
              {TYPE_LABELS[p.type] || p.type}
            </span>
          </div>
          <span className="suivi-person-stats">
            {p.validated_sheets ?? 0}/{p.total_sheets ?? 0}
          </span>
        </Button>
      </div>
    ),
    [selectedPerson?.id, selectedSheetIds, selectedDate, handleToggleSelect],
  );

  const handleSelectAll = useCallback(() => {
    if (selectedSheetIds.size === personnel.length) {
      setSelectedSheetIds(new Set());
    } else {
      setSelectedSheetIds(new Set(personnel.map((p) => `${p.id}__${selectedDate}`)));
    }
  }, [personnel, selectedDate, selectedSheetIds.size]);

  // Résoudre les IDs de fiches à partir de la sélection
  const resolveSheetIds = useCallback(async () => {
    const sheetIds = [];
    for (const key of selectedSheetIds) {
      const [personId, date] = key.split('__');
      const data = await api.getSuiviSheet(personId, date);
      if (data?.id) sheetIds.push(data.id);
    }
    return sheetIds;
  }, [selectedSheetIds]);

  const handleBatchExportPdf = useCallback(async () => {
    if (selectedSheetIds.size === 0) return;
    setBatchExporting(true);
    setError(null);
    try {
      const sheetIds = await resolveSheetIds();
      if (sheetIds.length === 0) {
        setError('Aucune fiche trouvee pour la selection');
        return;
      }
      const blob = await api.exportSuiviBatchPdf(sheetIds);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fiches-suivi-${selectedDate}-${sheetIds.length}fiches.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Erreur export PDF batch');
    } finally {
      setBatchExporting(false);
    }
  }, [selectedSheetIds, selectedDate, resolveSheetIds]);

  const handleBatchPrint = useCallback(async () => {
    if (selectedSheetIds.size === 0) return;
    setBatchPrinting(true);
    setError(null);
    try {
      const sheetIds = await resolveSheetIds();
      if (sheetIds.length === 0) {
        setError('Aucune fiche trouvee pour la selection');
        return;
      }
      const blob = await api.printSuiviBatch(sheetIds);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      setError('Erreur impression batch');
    } finally {
      setBatchPrinting(false);
    }
  }, [selectedSheetIds, resolveSheetIds]);

  return (
    <div className="suivi-panel">
      {/* Barre d'onglets */}
      <div className="suivi-tabs-bar">
        <Button
          variant="ghost"
          className={`suivi-tab ${activeTab === 'fiches' ? 'active' : ''}`}
          onClick={() => setActiveTab('fiches')}
        >
          <ClipboardCheck size={16} />
          Fiches quotidiennes
        </Button>
        <Button
          variant="ghost"
          className={`suivi-tab ${activeTab === 'syntheses' ? 'active' : ''}`}
          onClick={() => setActiveTab('syntheses')}
        >
          <FileText size={16} />
          Synthèses
        </Button>
      </div>

      {activeTab === 'fiches' && (
        <div className="suivi-fiches-layout">
          {/* ─── Sidebar personnel ─── */}
          <aside className="suivi-sidebar">
            <h3 className="suivi-sidebar-title">
              <Users size={16} /> Personnel
            </h3>

            <div className="suivi-person-list">
              {personnel.length === 0 ? (
                <div className="suivi-person-empty">Aucun personnel trouvé</div>
              ) : (
                <>
                  {/* Sélectionner tout / PDF + Imprimer sélection */}
                  <div className="suivi-batch-bar">
                    <label className="suivi-select-all" title="Tout sélectionner">
                      <input
                        type="checkbox"
                        checked={selectedSheetIds.size === personnel.length && personnel.length > 0}
                        onChange={handleSelectAll}
                      />
                      <span>Tout</span>
                    </label>
                    {selectedSheetIds.size > 0 && (
                      <div className="suivi-batch-actions">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="suivi-btn suivi-btn-batch-pdf"
                          onClick={handleBatchExportPdf}
                          disabled={batchExporting}
                          title={`Exporter ${selectedSheetIds.size} fiche(s) en PDF`}
                        >
                          {batchExporting ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Download size={13} />
                          )}
                          PDF
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="suivi-btn suivi-btn-batch-print"
                          onClick={handleBatchPrint}
                          disabled={batchPrinting}
                          title={`Imprimer ${selectedSheetIds.size} fiche(s) recto-verso`}
                        >
                          {batchPrinting ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Printer size={13} />
                          )}
                          Imprimer
                        </Button>
                      </div>
                    )}
                  </div>
                  {/* Groupe Permanents */}
                  {permanents.length > 0 && (
                    <div className="suivi-group">
                      <div className="suivi-group-header">Permanents ({permanents.length})</div>
                      {permanents.map((p) => renderPersonItem(p))}
                    </div>
                  )}
                  {/* Groupe Contractuels */}
                  {nonPermanents.length > 0 && (
                    <div className="suivi-group">
                      <div className="suivi-group-header">
                        Contractuels ({nonPermanents.length})
                      </div>
                      {nonPermanents.map((p) => renderPersonItem(p))}
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>

          {/* ─── Zone principale ─── */}
          <main className="suivi-main">
            {/* Nav date */}
            <div className="suivi-date-nav">
              <Button
                variant="ghost"
                iconOnly
                className="suivi-nav-btn"
                onClick={() => handleNavigateDay(-1)}
                title="Jour précédent"
                aria-label="Jour précédent"
              >
                <ChevronLeft size={18} />
              </Button>
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
              <Button
                variant="ghost"
                iconOnly
                className="suivi-nav-btn"
                onClick={() => handleNavigateDay(1)}
                title="Jour suivant"
                aria-label="Jour suivant"
              >
                <ChevronRight size={18} />
              </Button>

              <div className="suivi-actions" />
            </div>

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
