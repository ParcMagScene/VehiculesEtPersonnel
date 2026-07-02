/* ═══════════════════════════════════════════════════════════════
   SuiviPanel — Module Suivi du Personnel Permanent
  Onglets : Fiches quotidiennes | Incidents | Synthèses
   ═══════════════════════════════════════════════════════════════ */

import './SuiviPanel.css';

import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  Loader2,
  Lock,
  LogOut,
  Printer,
  Star,
  UserCheck,
  Users,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Input, SearchBar } from '@/design-system';

import usePersonnelFavorites from '../../hooks/usePersonnelFavorites';
import { useRefreshSubscription } from '../../hooks/useRefreshSubscription';
import api from '../../utils/api/index.js';
import { refreshBus } from '../../utils/refresh-bus';
import { usePrintPreview } from '../ui/PrintPreviewProvider';
import FicheSuivi from './FicheSuivi';
import IncidentsSuiviPanel from './IncidentsSuiviPanel';
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

function SuiviPanel({
  currentUser,
  initialPersonId,
  isPersonalMode = false,
  onPersonalDataSaved = null,
}) {
  const printPreview = usePrintPreview();
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
  const [collapsedNonPermanents, setCollapsedNonPermanents] = useState(true);
  const [collapsedFavorites, setCollapsedFavorites] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  // Compteur d'invalidation pour relancer les useEffect de chargement lorsque le bus 'suivi' publie
  const [busTick, setBusTick] = useState(0);
  // Permet d'ignorer le bus 'suivi' que nous publions nous-mêmes après un save
  // (sinon on refetch la fiche en cours d'édition et on écrase la saisie).
  const ignoreNextSuiviBusRef = useRef(false);
  useRefreshSubscription('suivi', () => {
    if (ignoreNextSuiviBusRef.current) {
      ignoreNextSuiviBusRef.current = false;
      return;
    }
    setBusTick((t) => t + 1);
  });
  // Compte Equipe : personne sélectionnée via PIN/MDP
  const isTeamAccount = !!currentUser?.isTeam;
  const [suiviPerson, setSuiviPerson] = useState(null); // personne authentifiée pour le suivi
  const [teamAuthError, setTeamAuthError] = useState('');
  const [teamAuthLoading, setTeamAuthLoading] = useState(false);
  const [teamPinInput, setTeamPinInput] = useState('');
  const [teamPasswordInput, setTeamPasswordInput] = useState('');
  const [teamAuthMode, setTeamAuthMode] = useState('pin'); // 'pin' | 'password'
  const [teamSelectedPerson, setTeamSelectedPerson] = useState(null);
  const [permanentsHeight, setPermanentsHeight] = useState(280);
  const [isResizingGroups, setIsResizingGroups] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const personListRef = useRef(null);
  const resizeStartRef = useRef({ y: 0, height: 280 });
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef(null);
  const isAdmin = !!currentUser?.isAdmin;
  const { isFavorite, toggleFavorite, sortPersonsByFavorites } = usePersonnelFavorites();

  const personnelSource = useMemo(() => {
    let list = onlyFavorites ? personnel.filter((p) => isFavorite(p.id)) : personnel;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
        return fullName.includes(q);
      });
    }
    return list;
  }, [personnel, onlyFavorites, isFavorite, searchQuery]);

  // Groupes de personnel
  const permanents = useMemo(
    () =>
      sortPersonsByFavorites(
        personnelSource.filter((p) => ['permanent', 'apprenti', 'stagiaire'].includes(p.type)),
      ),
    [personnelSource, sortPersonsByFavorites],
  );
  const nonPermanentsAll = useMemo(
    () =>
      sortPersonsByFavorites(
        personnelSource.filter((p) => !['permanent', 'apprenti', 'stagiaire'].includes(p.type)),
      ),
    [personnelSource, sortPersonsByFavorites],
  );
  const favorites = useMemo(
    () => nonPermanentsAll.filter((p) => isFavorite(p.id)),
    [nonPermanentsAll, isFavorite],
  );
  const nonPermanents = useMemo(
    () => nonPermanentsAll.filter((p) => !isFavorite(p.id)),
    [nonPermanentsAll, isFavorite],
  );

  const visibleKeys = useMemo(
    () => personnelSource.map((p) => `${p.id}__${selectedDate}`),
    [personnelSource, selectedDate],
  );

  const selectedVisibleCount = useMemo(() => {
    let count = 0;
    visibleKeys.forEach((k) => {
      if (selectedSheetIds.has(k)) count += 1;
    });
    return count;
  }, [visibleKeys, selectedSheetIds]);

  // Ne retenir que la sélection correspondant au jour affiché.
  const selectedKeysForDate = useMemo(
    () => [...selectedSheetIds].filter((key) => key.endsWith(`__${selectedDate}`)),
    [selectedSheetIds, selectedDate],
  );

  // Charger la liste du personnel
  useEffect(() => {
    if (!onlyFavorites) return;
    setSelectedSheetIds((prev) => {
      const next = new Set([...prev].filter((key) => isFavorite(Number(key.split('__')[0]))));
      return next.size === prev.size ? prev : next;
    });
    if (selectedPerson && !isFavorite(selectedPerson.id)) {
      const nextPerson =
        sortPersonsByFavorites(personnel.filter((p) => isFavorite(p.id)))[0] || null;
      setSelectedPerson(nextPerson);
    }
  }, [onlyFavorites, personnel, selectedPerson, isFavorite, sortPersonsByFavorites]);

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
                  (p.user_id != null && p.user_id === currentUser.id) ||
                  (currentUser.name &&
                    (`${p.first_name} ${p.last_name}`.toLowerCase() ===
                      currentUser.name.toLowerCase() ||
                      `${p.last_name} ${p.first_name}`.toLowerCase() ===
                        currentUser.name.toLowerCase())),
              ));
          const firstMatch = userMatch || data.find((p) => p.type === 'permanent') || data[0];
          setSelectedPerson(firstMatch);
        }
      } catch (err) {
        setError('Erreur chargement personnel');
      }
    })();
  }, [currentUser, initialPersonId, selectedPerson, busTick]);

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
    // dépend uniquement de l'id (pas de l'objet entier) pour éviter les rechargements parasites
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPerson?.id, selectedDate, busTick]);

  const handleNavigateDay = useCallback(
    (delta) => {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() + delta);
      setSelectedDate(formatDateISO(d));
    },
    [selectedDate],
  );

  const handleGoToday = useCallback(() => {
    setSelectedDate(formatDateISO(new Date()));
  }, []);

  const handleSaveSheet = useCallback(
    async (data) => {
      if (!selectedPerson) return;
      pendingSaveRef.current = data;
      if (saveInFlightRef.current) return;

      saveInFlightRef.current = true;
      setSaving(true);
      setError(null);

      try {
        while (pendingSaveRef.current) {
          const payload = pendingSaveRef.current;
          pendingSaveRef.current = null;
          const updated = await api.updateSuiviSheet(selectedPerson.id, selectedDate, payload);
          setSheet(updated);
        }
        // Notifie les autres vues du module Suivi (incidents, synthèses, autres onglets)
        // mais on s'auto-ignore pour ne pas refetch la fiche qu'on vient de sauver
        // (écraserait la saisie en cours).
        ignoreNextSuiviBusRef.current = true;
        refreshBus.publish('suivi');
        // Mode personnel : déclencher l'auto-logout après sauvegarde
        if (isPersonalMode && onPersonalDataSaved) {
          await onPersonalDataSaved();
        }
      } catch (err) {
        setError('Erreur sauvegarde');
      } finally {
        saveInFlightRef.current = false;
        setSaving(false);
      }
    },
    [selectedPerson, selectedDate, isPersonalMode, onPersonalDataSaved],
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
        <Button
          variant="ghost"
          type="button"
          className={`suivi-person-fav${isFavorite(p.id) ? ' active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(p.id);
          }}
          title={isFavorite(p.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          aria-label={isFavorite(p.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <Star
            size={14}
            strokeWidth={2.25}
            className="suivi-person-fav-icon"
            fill={isFavorite(p.id) ? 'currentColor' : 'none'}
          />
        </Button>
        <Input
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
    [
      selectedPerson?.id,
      selectedSheetIds,
      selectedDate,
      handleToggleSelect,
      isFavorite,
      toggleFavorite,
    ],
  );

  const handleSelectAll = useCallback(() => {
    setSelectedSheetIds((prev) => {
      const next = new Set(prev);
      const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((k) => next.has(k));
      if (allVisibleSelected) {
        visibleKeys.forEach((k) => next.delete(k));
      } else {
        visibleKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  }, [visibleKeys]);

  const permanentKeys = useMemo(
    () => permanents.map((p) => `${p.id}__${selectedDate}`),
    [permanents, selectedDate],
  );

  const selectedPermanentsCount = useMemo(() => {
    let count = 0;
    permanentKeys.forEach((k) => {
      if (selectedSheetIds.has(k)) count += 1;
    });
    return count;
  }, [permanentKeys, selectedSheetIds]);

  const handleToggleSelectPermanents = useCallback(() => {
    setSelectedSheetIds((prev) => {
      const next = new Set(prev);
      const allSelected = permanentKeys.every((k) => next.has(k));
      if (allSelected) {
        permanentKeys.forEach((k) => next.delete(k));
      } else {
        permanentKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  }, [permanentKeys]);

  // Résoudre les IDs de fiches à partir de la sélection
  const resolveSheetIds = useCallback(async () => {
    const sheetIds = [];
    for (const key of selectedKeysForDate) {
      const [personId, date] = key.split('__');
      const data = await api.getSuiviSheet(personId, date);
      if (data?.id) sheetIds.push(data.id);
    }
    return sheetIds;
  }, [selectedKeysForDate]);

  const handleBatchExportPdf = useCallback(async () => {
    if (selectedKeysForDate.length === 0) return;
    setBatchExporting(true);
    setError(null);
    try {
      const sheetIds = await resolveSheetIds();
      if (sheetIds.length === 0) {
        setError('Aucune fiche trouvee pour la selection');
        return;
      }
      const blob = await api.exportSuiviBatchPdf(sheetIds);
      printPreview.showPdf(
        { blob },
        {
          title: `Fiches de suivi — ${selectedDate} (${sheetIds.length})`,
          filename: `fiches-suivi-${selectedDate}-${sheetIds.length}fiches.pdf`,
        },
      );
    } catch {
      setError('Erreur export PDF batch');
    } finally {
      setBatchExporting(false);
    }
  }, [selectedKeysForDate, selectedDate, resolveSheetIds, printPreview]);

  const handleBatchPrint = useCallback(async () => {
    if (selectedKeysForDate.length === 0) return;
    setBatchPrinting(true);
    setError(null);
    try {
      const sheetIds = await resolveSheetIds();
      if (sheetIds.length === 0) {
        setError('Aucune fiche trouvee pour la selection');
        return;
      }
      const blob = await api.printSuiviBatch(sheetIds);
      printPreview.showPdf(
        { blob },
        {
          title: `Impression fiches de suivi — ${selectedDate}`,
          filename: `fiches-suivi-impression-${selectedDate}.pdf`,
        },
      );
    } catch {
      setError('Erreur impression batch');
    } finally {
      setBatchPrinting(false);
    }
  }, [selectedKeysForDate, selectedDate, resolveSheetIds, printPreview]);

  const handleStartGroupResize = useCallback(
    (e) => {
      if ((collapsedNonPermanents && collapsedFavorites) || !personListRef.current) return;
      e.preventDefault();
      resizeStartRef.current = { y: e.clientY, height: permanentsHeight };
      setIsResizingGroups(true);
    },
    [collapsedNonPermanents, collapsedFavorites, permanentsHeight],
  );

  useEffect(() => {
    if (!isResizingGroups) return;

    const handleMouseMove = (e) => {
      const containerHeight = personListRef.current?.clientHeight || 0;
      if (!containerHeight) return;
      const delta = e.clientY - resizeStartRef.current.y;
      const minHeight = 120;
      const maxHeight = Math.max(minHeight, containerHeight - 120);
      const next = Math.min(maxHeight, Math.max(minHeight, resizeStartRef.current.height + delta));
      setPermanentsHeight(next);
    };

    const handleMouseUp = () => setIsResizingGroups(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingGroups]);

  const handleTeamAuth = async (e) => {
    e.preventDefault();
    if (!teamSelectedPerson) return;
    setTeamAuthError('');
    setTeamAuthLoading(true);
    try {
      const creds =
        teamAuthMode === 'pin' ? { pin: teamPinInput } : { password: teamPasswordInput };
      await api.suiviPersonalAuth(teamSelectedPerson.id, creds.pin, creds.password);
      setSuiviPerson(teamSelectedPerson);
      setSelectedPerson(teamSelectedPerson);
      setTeamPinInput('');
      setTeamPasswordInput('');
      setTeamSelectedPerson(null);
    } catch (err) {
      setTeamAuthError(err.message || 'Identifiants incorrects');
    } finally {
      setTeamAuthLoading(false);
    }
  };

  if (isTeamAccount && !suiviPerson) {
    return (
      <div className="suivi-panel suivi-team-auth">
        <div className="suivi-team-auth-card">
          <div className="suivi-team-auth-header">
            <UserCheck size={32} />
            <h2>Accès au suivi</h2>
            <p>Sélectionnez votre nom et entrez votre code PIN ou mot de passe</p>
          </div>

          <form className="suivi-team-auth-form" onSubmit={handleTeamAuth}>
            {/* Sélection de la personne */}
            <div className="suivi-team-person-list">
              {sortPersonsByFavorites(personnel).map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  className={`suivi-team-person-item ${teamSelectedPerson?.id === p.id ? 'selected' : ''}`}
                  onClick={() => {
                    setTeamSelectedPerson(p);
                    setTeamAuthError('');
                  }}
                >
                  <span className={`suivi-team-person-fav${isFavorite(p.id) ? ' active' : ''}`}>
                    <Star size={12} fill={isFavorite(p.id) ? 'currentColor' : 'none'} />
                  </span>
                  <span className="suivi-team-person-name">
                    {p.first_name} {p.last_name}
                  </span>
                  <span className={`suivi-person-type suivi-type-${p.type || 'permanent'}`}>
                    {TYPE_LABELS[p.type] || p.type}
                  </span>
                </Button>
              ))}
            </div>

            {teamSelectedPerson && (
              <>
                <div className="suivi-team-auth-mode-toggle">
                  <Button
                    type="button"
                    className={`suivi-auth-mode-btn ${teamAuthMode === 'pin' ? 'active' : ''}`}
                    onClick={() => setTeamAuthMode('pin')}
                  >
                    Code PIN
                  </Button>
                  <Button
                    type="button"
                    className={`suivi-auth-mode-btn ${teamAuthMode === 'password' ? 'active' : ''}`}
                    onClick={() => setTeamAuthMode('password')}
                  >
                    Mot de passe
                  </Button>
                </div>

                {teamAuthMode === 'pin' ? (
                  <div className="suivi-team-auth-field">
                    <label>Code PIN (4 chiffres)</label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      pattern="\d{4}"
                      value={teamPinInput}
                      onChange={(e) =>
                        setTeamPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                      }
                      placeholder="••••"
                      required
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="suivi-team-auth-field">
                    <label>Mot de passe</label>
                    <Input
                      type="password"
                      value={teamPasswordInput}
                      onChange={(e) => setTeamPasswordInput(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoFocus
                    />
                  </div>
                )}
              </>
            )}

            {teamAuthError && <div className="suivi-team-auth-error">{teamAuthError}</div>}

            <Button
              type="submit"
              className="suivi-team-auth-submit"
              disabled={!teamSelectedPerson || teamAuthLoading}
            >
              <Lock size={16} />
              {teamAuthLoading ? 'Vérification...' : 'Accéder à mon suivi'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="suivi-panel">
      {/* Bouton quitter le suivi (compte Equipe) */}
      {isTeamAccount && suiviPerson && (
        <div className="suivi-team-session-bar">
          <span>
            <UserCheck size={14} />
            {suiviPerson.first_name} {suiviPerson.last_name}
          </span>
          <Button
            variant="ghost"
            className="suivi-team-quit-btn"
            onClick={() => {
              setSuiviPerson(null);
              setSelectedPerson(null);
            }}
          >
            <LogOut size={14} />
            Quitter mon suivi
          </Button>
        </div>
      )}
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
          className={`suivi-tab ${activeTab === 'incidents' ? 'active' : ''}`}
          onClick={() => setActiveTab('incidents')}
        >
          <AlertTriangle size={16} />
          Incidents
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

            <div className="suivi-search-wrap">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Rechercher un personnel…"
                size="sm"
              />
            </div>

            <div className="suivi-person-list" ref={personListRef}>
              {personnelSource.length === 0 ? (
                <div className="suivi-person-empty">
                  {searchQuery.trim()
                    ? 'Aucun resultat'
                    : onlyFavorites
                      ? 'Aucun favori trouvé'
                      : 'Aucun personnel trouvé'}
                </div>
              ) : (
                <>
                  {/* Sélectionner tout / PDF + Imprimer sélection */}
                  <div className="suivi-batch-bar">
                    <div className="suivi-batch-options">
                      <label className="suivi-select-all" title="Tout sélectionner">
                        <Input
                          type="checkbox"
                          checked={
                            visibleKeys.length > 0 && selectedVisibleCount === visibleKeys.length
                          }
                          onChange={handleSelectAll}
                        />
                        <span>Tout</span>
                      </label>
                      <label className="suivi-select-all" title="Sélectionner tous les permanents">
                        <Input
                          type="checkbox"
                          checked={
                            permanents.length > 0 && selectedPermanentsCount === permanents.length
                          }
                          onChange={handleToggleSelectPermanents}
                        />
                        <span>Tous permanents</span>
                      </label>
                      <label className="suivi-select-all" title="Afficher uniquement les favoris">
                        <Input
                          type="checkbox"
                          checked={onlyFavorites}
                          onChange={(e) => setOnlyFavorites(e.target.checked)}
                        />
                        <span>Favoris seulement</span>
                      </label>
                    </div>
                    {selectedKeysForDate.length > 0 && (
                      <div className="suivi-batch-actions">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="suivi-btn suivi-btn-batch-pdf"
                          onClick={handleBatchExportPdf}
                          disabled={batchExporting}
                          title={`Exporter ${selectedKeysForDate.length} fiche(s) en PDF`}
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
                          title={`Imprimer ${selectedKeysForDate.length} fiche(s) recto-verso`}
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
                  <div className="suivi-groups-stack">
                    {/* Groupe Permanents */}
                    {permanents.length > 0 && (
                      <div
                        className="suivi-group suivi-group-permanents"
                        style={{ height: 'auto' }}
                      >
                        <div className="suivi-group-header">Permanents ({permanents.length})</div>
                        <div className="suivi-group-body">
                          {permanents.map((p) => renderPersonItem(p))}
                        </div>
                      </div>
                    )}

                    {/* Poignee horizontale */}
                    {permanents.length > 0 &&
                      (favorites.length > 0 || nonPermanents.length > 0) &&
                      (!collapsedFavorites || !collapsedNonPermanents) && (
                        <div
                          className={`suivi-group-resizer ${isResizingGroups ? 'is-resizing' : ''}`}
                          onMouseDown={handleStartGroupResize}
                          role="separator"
                          aria-orientation="horizontal"
                          title="Redimensionner la section permanents"
                        />
                      )}

                    {/* Groupe Favoris */}
                    {favorites.length > 0 && (
                      <div className="suivi-group suivi-group-favorites">
                        <div
                          className="suivi-group-header suivi-group-header-collapsible"
                          onClick={() => setCollapsedFavorites((v) => !v)}
                          role="button"
                          tabIndex={0}
                          title={collapsedFavorites ? 'Afficher' : 'Masquer'}
                        >
                          <span className="suivi-group-toggle-icon">
                            {collapsedFavorites ? '▶' : '▼'}
                          </span>
                          Favoris ({favorites.length})
                        </div>
                        {!collapsedFavorites && (
                          <div className="suivi-group-body">
                            {favorites.map((p) => renderPersonItem(p))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Groupe Contractuels */}
                    {nonPermanents.length > 0 && (
                      <div className="suivi-group suivi-group-non-permanents">
                        <div
                          className="suivi-group-header suivi-group-header-collapsible"
                          onClick={() => setCollapsedNonPermanents((v) => !v)}
                          role="button"
                          tabIndex={0}
                          title={collapsedNonPermanents ? 'Afficher' : 'Masquer'}
                        >
                          <span className="suivi-group-toggle-icon">
                            {collapsedNonPermanents ? '▶' : '▼'}
                          </span>
                          Contractuels ({nonPermanents.length})
                        </div>
                        {!collapsedNonPermanents && (
                          <div className="suivi-group-body">
                            {nonPermanents.map((p) => renderPersonItem(p))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>

          {/* ─── Zone principale ─── */}
          <main className="suivi-main">
            {/* Nav date */}
            <div className="suivi-date-nav">
              <div className="suivi-date-nav-group">
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
                  <Input
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

                <Button
                  variant="secondary"
                  size="sm"
                  className="suivi-btn-today"
                  onClick={handleGoToday}
                  title="Revenir à aujourd'hui"
                >
                  Aujourd'hui
                </Button>
              </div>
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
      {activeTab === 'incidents' && <IncidentsSuiviPanel currentUser={currentUser} />}
    </div>
  );
}

export default memo(SuiviPanel);
