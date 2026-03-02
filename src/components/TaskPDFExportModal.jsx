import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, FileDown, Eye, Check, CheckSquare, Square, Minus,
  User, Clock, Briefcase, Loader2, MapPin, Calendar
} from 'lucide-react';
import api from '../utils/api';
import { formatDateFr } from '../utils/formatUtils';
import './TaskPDFExportModal.css';

// ═══ Constantes sections (identiques au planning) ═══
const SECTIONS = {
  rdv:                 { label: 'Rendez-vous',          emoji: '📅', color: '#059669' },
  taches_prioritaires: { label: 'Tâches Prioritaires',  emoji: '🔴', color: '#ef4444' },
  courses:             { label: 'Courses',               emoji: '🚗', color: '#8b5cf6' },
  prep_locations:      { label: 'Préparations Locations',      emoji: '📦', color: '#f59e0b', affaireOnly: true },
  prep_prestations:    { label: 'Préparations Prestations',    emoji: '🎤', color: '#3b82f6', affaireOnly: true },
  prep_ventes:         { label: 'Préparations Ventes',         emoji: '🏷️', color: '#10b981', affaireOnly: true },
  prep_installations:  { label: 'Préparations Installations',  emoji: '⚙️', color: '#8b5cf6', affaireOnly: true },
  chargement:          { label: 'Chargement',           emoji: '📦', color: '#f59e0b', affaireOnly: true },
  depart:              { label: 'Départ',               emoji: '🚀', color: '#3b82f6', affaireOnly: true },
  enlevement:          { label: 'Enlèvement',           emoji: '🚚', color: '#10b981', affaireOnly: true },
  retour:              { label: 'Retour',               emoji: '↩️', color: '#8b5cf6', affaireOnly: true },
  recuperation:        { label: 'Récupération',         emoji: '📥', color: '#ef4444', affaireOnly: true },
  installation:        { label: 'Installation',         emoji: '🛠️', color: '#10b981', affaireOnly: true },
  evenements:          { label: 'Autres Événements',    emoji: '📌', color: '#64748b' },
  taches_secondaires:  { label: 'Tâches Secondaires',   emoji: '🟡', color: '#f59e0b' },
  manual:              { label: 'Autres',                emoji: '📋', color: 'var(--theme-text-secondary)' },
};

const AFFAIRE_TYPE_INFO = {
  'Prestation':   { label: 'Prestation',   emoji: '🎭', section: 'prep_prestations' },
  'Location':     { label: 'Location',     emoji: '🏗️', section: 'prep_locations' },
  'Vente':        { label: 'Vente',        emoji: '💰', section: 'prep_ventes' },
  'Installation': { label: 'Installation', emoji: '⚙️', section: 'prep_installations' },
};

const EVENT_TYPES = {
  preparation:  { label: 'Préparation',  emoji: '🔧' },
  enlevement:   { label: 'Enlèvement',   emoji: '📦' },
  livraison:    { label: 'Livraison',     emoji: '🚚' },
  depart:       { label: 'Départ',        emoji: '🚀' },
  retour:       { label: 'Retour',        emoji: '↩️' },
  recuperation: { label: 'Récupération',  emoji: '📥' },
};

const STATUS_ICONS = {
  pending: '○',
  in_progress: '◐',
  done: '●',
  cancelled: '✕',
};

const STATUS_LABELS = {
  pending: 'À faire',
  in_progress: 'En cours',
  done: 'Fait',
  cancelled: 'Annulé',
};

const mapEventToSection = (event) => {
  const type = event.type;
  const cat = event.category;
  if (type === 'preparation') {
    if (cat === 'location') return 'prep_locations';
    if (cat === 'prestation') return 'prep_prestations';
    if (cat === 'vente') return 'prep_ventes';
    if (cat === 'installation') return 'prep_installations';
    return 'prep_locations';
  }
  if (type === 'enlevement') return 'enlevement';
  if (type === 'depart') return 'depart';
  if (type === 'livraison') return 'chargement';
  if (type === 'retour') return 'retour';
  if (type === 'recuperation') return 'recuperation';
  if (type === 'installation') return 'installation';
  return 'evenements';
};

const mapAffaireToSection = (affaire) => {
  const info = AFFAIRE_TYPE_INFO[affaire.type];
  return info ? info.section : 'manual';
};

function TaskPDFExportModal({ date, tasks, affaires = [], displayEvents = [], googleRdvEvents = [], onClose }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [pdfUrl, setPdfUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // ── Construire les items par section (identique au planning) ──
  const { allItems, grouped, activeSections } = useMemo(() => {
    const items = [];
    const groups = {};
    Object.keys(SECTIONS).forEach(k => { groups[k] = []; });

    // 1) Tâches manuelles
    (tasks || []).forEach(t => {
      const sec = t.section || 'manual';
      const item = { uid: `task-${t.id}`, type: 'task', section: sec, data: t };
      items.push(item);
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(item);
    });

    // 2) Affaires — section mappée + RDV si titre contient "rdv"
    (affaires || []).forEach(a => {
      const sec = mapAffaireToSection(a);
      const item = { uid: `affaire-${a.id}`, type: 'affaire', section: sec, data: a };
      items.push(item);
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(item);
      if (a.titre && /rdv/i.test(a.titre)) {
        const rdvItem = { uid: `affaire-rdv-${a.id}`, type: 'affaire-rdv', section: 'rdv', data: a };
        items.push(rdvItem);
        if (!groups.rdv) groups.rdv = [];
        groups.rdv.push(rdvItem);
      }
    });

    // 3) Événements d'affichage non liés à des tâches
    const linkedEventIds = new Set((tasks || []).filter(t => t.displayEventId).map(t => t.displayEventId));
    (displayEvents || []).filter(ev => !linkedEventIds.has(ev.id)).forEach(ev => {
      const sec = mapEventToSection(ev);
      const item = { uid: `event-${ev.id}`, type: 'event', section: sec, data: ev };
      items.push(item);
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(item);
    });

    // 4) Google Calendar RDV
    (googleRdvEvents || []).forEach(ev => {
      const item = { uid: `gcal-${ev.id}`, type: 'gcal', section: 'rdv', data: ev };
      items.push(item);
      if (!groups.rdv) groups.rdv = [];
      groups.rdv.push(item);
    });

    const active = Object.keys(SECTIONS).filter(k => (groups[k] || []).length > 0);
    return { allItems: items, grouped: groups, activeSections: active };
  }, [tasks, affaires, displayEvents, googleRdvEvents]);

  // Initialiser avec tout sélectionné
  useEffect(() => {
    if (allItems.length > 0) {
      setSelectedIds(new Set(allItems.map(i => i.uid)));
    }
  }, [allItems]);

  // Extraire les IDs sélectionnés par type
  const getSelectedPayload = useCallback(() => {
    const taskIds = [], affaireIds = new Set(), eventIds = [], gcalEvents = [];
    allItems.forEach(item => {
      if (!selectedIds.has(item.uid)) return;
      if (item.type === 'task') taskIds.push(item.data.id);
      else if (item.type === 'affaire' || item.type === 'affaire-rdv') {
        affaireIds.add(item.data.id);
      }
      else if (item.type === 'event') eventIds.push(item.data.id);
      else if (item.type === 'gcal') gcalEvents.push({
        summary: item.data.summary || 'RDV',
        start: item.data.start?.dateTime || item.data.start?.date || '',
        end: item.data.end?.dateTime || item.data.end?.date || '',
        location: item.data.location || '',
        affaire: item.data.affaire || '',
      });
    });
    return { taskIds, affaireIds: [...affaireIds], eventIds, gcalEvents };
  }, [allItems, selectedIds]);

  // Générer l'aperçu PDF
  const generatePreview = useCallback(async () => {
    if (selectedIds.size === 0) { setPdfUrl(null); return; }
    setGenerating(true);
    try {
      const sel = getSelectedPayload();
      const blob = await api.exportTasksPdf(date, sel.taskIds, sel.affaireIds, sel.eventIds, sel.gcalEvents);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error('Erreur aperçu PDF:', err);
    } finally {
      setGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedIds, pdfUrl, getSelectedPayload]);

  useEffect(() => {
    if (selectedIds.size === 0) { setPdfUrl(null); return; }
    const timer = setTimeout(() => generatePreview(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, date]);

  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleItem = (uid) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const toggleSection = (sectionKey) => {
    const sectionUids = (grouped[sectionKey] || []).map(i => i.uid);
    const allSelected = sectionUids.every(uid => selectedIds.has(uid));
    setSelectedIds(prev => {
      const next = new Set(prev);
      sectionUids.forEach(uid => { if (allSelected) next.delete(uid); else next.add(uid); });
      return next;
    });
  };

  const toggleAll = () => {
    const allUids = allItems.map(i => i.uid);
    setSelectedIds(selectedIds.size === allUids.length ? new Set() : new Set(allUids));
  };

  const sectionState = (sectionKey) => {
    const uids = (grouped[sectionKey] || []).map(i => i.uid);
    if (uids.length === 0) return 'none';
    const sel = uids.filter(uid => selectedIds.has(uid)).length;
    if (sel === 0) return 'none';
    if (sel === uids.length) return 'all';
    return 'partial';
  };

  const handleDownload = async () => {
    if (selectedIds.size === 0) return;
    setDownloading(true);
    try {
      const sel = getSelectedPayload();
      const blob = await api.exportTasksPdf(date, sel.taskIds, sel.affaireIds, sel.eventIds, sel.gcalEvents);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `fiche-${date}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur téléchargement:', err);
    } finally {
      setDownloading(false);
    }
  };

  const totalItems = allItems.length;
  const dateFr = formatDateFr(date);

  // ── Index affaires par numéro pour enrichir les tâches ──
  const affaireByNum = useMemo(() => {
    const map = new Map();
    (affaires || []).forEach(a => {
      if (a.numeroAffaire) map.set(a.numeroAffaire.toUpperCase(), a);
    });
    return map;
  }, [affaires]);

  // ── Nettoyage titre de tâche (supprimer doublons section/affaire) ──
  const cleanTaskTitle = (task) => {
    let title = task.title || '-';
    const sectionInfo = SECTIONS[task.section];
    const affNum = task.affaireNum || (title.match(/\bAF\s*\d{3,}/i) || [''])[0];
    // 1. Retirer le suffixe " — eventSummary"
    if (task.googleEventTitle) {
      const dashIdx = title.indexOf(' — ');
      if (dashIdx >= 0) {
        const suffix = title.slice(dashIdx + 3).trim();
        if (suffix.toLowerCase() === task.googleEventTitle.trim().toLowerCase()) {
          title = title.slice(0, dashIdx).trim();
        }
      }
    }
    // 2. Retirer label de section (redondant avec le bandeau)
    if (sectionInfo?.affaireOnly) {
      title = title
        .replace(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+\s*/u, '')
        .replace(/^(Préparation|Chargement|Départ|Enlèvement|Retour|Récupération|Installation|Livraison)\s*—?\s*/i, '')
        .trim();
      if (!title) title = task.googleEventTitle || task.notes || '-';
    }
    // 3. Retirer N° affaire du titre
    if (affNum) {
      const esc = affNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      title = title.replace(new RegExp(esc, 'gi'), '').replace(/\s{2,}/g, ' ').trim();
    }
    // 4. Enrichir avec client/titre affaire si titre trop générique
    const linkedAffaire = affNum ? affaireByNum.get(affNum.toUpperCase()) : null;
    if (linkedAffaire && (!title || /^(Location|Prestation|Vente|Installation|Livraison)\s*$/i.test(title))) {
      title = linkedAffaire.client || linkedAffaire.titre || linkedAffaire.eventName || title || '-';
    }
    return title || '-';
  };

  // ── Rendu d'un item dans la liste de sélection ──
  const renderItemRow = (item) => {
    const checked = selectedIds.has(item.uid);
    const sectionInfo = SECTIONS[item.section];
    const isAffaireOnly = sectionInfo?.affaireOnly;

    if (item.type === 'task') {
      const task = item.data;
      const isDone = task.status === 'done';
      const displayTitle = cleanTaskTitle(task);
      return (
        <div key={item.uid} className={`task-checkbox-row ${checked ? 'selected' : ''} ${isDone ? 'done' : ''}`} onClick={() => toggleItem(item.uid)}>
          <span className={`task-cb ${checked ? 'checked' : ''}`}>{checked && <Check size={10} />}</span>
          <span className="task-cb-status" title={STATUS_LABELS[task.status]}>{STATUS_ICONS[task.status]}</span>
          <span className={`task-cb-title ${isDone ? 'done' : ''}`}>{displayTitle}</span>
          {(task.personFirstName || task.personLastName) && (
            <span className="task-cb-person"><User size={10} /> {task.personFirstName} {task.personLastName?.charAt(0)}.</span>
          )}
        </div>
      );
    }

    if (item.type === 'affaire' || item.type === 'affaire-rdv') {
      const a = item.data;
      const ti = AFFAIRE_TYPE_INFO[a.type] || { label: a.type || 'Affaire', emoji: '📋' };
      return (
        <div key={item.uid} className={`task-checkbox-row ${checked ? 'selected' : ''}`} onClick={() => toggleItem(item.uid)}>
          <span className={`task-cb ${checked ? 'checked' : ''}`}>{checked && <Check size={10} />}</span>
          <Briefcase size={11} style={{ color: 'var(--theme-purple-accent)', flexShrink: 0 }} />
          <span className="task-cb-title">{ti.emoji} {a.numeroAffaire} — {a.client || 'Sans client'}</span>
          {a.adresseLivraison && <span className="task-cb-person"><MapPin size={10} /> {a.adresseLivraison.split('\n')[0].slice(0, 25)}</span>}
        </div>
      );
    }

    if (item.type === 'event') {
      const ev = item.data;
      const ti = EVENT_TYPES[ev.type] || { label: ev.type || 'Événement', emoji: '📌' };
      // Dans les sections affaireOnly, ne pas répéter le type
      const displayText = isAffaireOnly
        ? [ev.affaireId, ev.client].filter(Boolean).join(' — ') || ti.label
        : `${ti.label} ${ev.affaireId ? `(${ev.affaireId})` : ''} ${ev.client ? `— ${ev.client}` : ''}`;
      return (
        <div key={item.uid} className={`task-checkbox-row ${checked ? 'selected' : ''}`} onClick={() => toggleItem(item.uid)}>
          <span className={`task-cb ${checked ? 'checked' : ''}`}>{checked && <Check size={10} />}</span>
          <span className="task-cb-status">{isAffaireOnly ? '' : ti.emoji}</span>
          <span className="task-cb-title">{displayText}</span>
          {ev.location && <span className="task-cb-person"><MapPin size={10} /> {ev.location.slice(0, 20)}</span>}
        </div>
      );
    }

    if (item.type === 'gcal') {
      const ev = item.data;
      const startDT = ev.start?.dateTime || ev.start?.date || '';
      const timeStr = startDT.includes('T')
        ? new Date(startDT).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : '';
      return (
        <div key={item.uid} className={`task-checkbox-row ${checked ? 'selected' : ''}`} onClick={() => toggleItem(item.uid)}>
          <span className={`task-cb ${checked ? 'checked' : ''}`}>{checked && <Check size={10} />}</span>
          <Calendar size={11} style={{ color: 'var(--theme-primary)', flexShrink: 0 }} />
          <span className="task-cb-title">
            {ev.affaire && <strong style={{ color: '#059669' }}>{ev.affaire} </strong>}
            {ev.summary || 'RDV'}
          </span>
          {timeStr && <span className="task-cb-person"><Clock size={10} /> {timeStr}</span>}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="pdf-export-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pdf-export-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="pdf-export-header">
          <div className="pdf-export-header-left">
            <FileDown size={20} />
            <div>
              <h3>Export PDF — Fiche du jour</h3>
              <span className="pdf-export-date">{dateFr}</span>
            </div>
          </div>
          <button className="pdf-export-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="pdf-export-body">
          {/* Panneau de sélection (gauche) */}
          <div className="pdf-export-selection">
            <div className="selection-toolbar">
              <button className="select-all-btn" onClick={toggleAll}>
                {selectedIds.size === totalItems ? (
                  <><CheckSquare size={15} /> Tout désélectionner</>
                ) : (
                  <><Square size={15} /> Tout sélectionner</>
                )}
              </button>
              <span className="selection-count">
                {selectedIds.size}/{totalItems} élément{selectedIds.size > 1 ? 's' : ''}
              </span>
            </div>

            <div className="selection-sections">
              {activeSections.map(sectionKey => {
                const info = SECTIONS[sectionKey];
                const sectionItems = grouped[sectionKey] || [];
                const state = sectionState(sectionKey);

                return (
                  <div key={sectionKey} className="selection-section">
                    <div className="section-checkbox-row" onClick={() => toggleSection(sectionKey)}>
                      <span className="section-cb" style={{ borderColor: info.color }}>
                        {state === 'all' && <Check size={12} style={{ color: info.color }} />}
                        {state === 'partial' && <Minus size={12} style={{ color: info.color }} />}
                      </span>
                      <span className="section-cb-emoji">{info.emoji}</span>
                      <span className="section-cb-label">{info.label}</span>
                      <span className="section-cb-count" style={{ color: info.color }}>
                        {sectionItems.filter(i => selectedIds.has(i.uid)).length}/{sectionItems.length}
                      </span>
                    </div>

                    <div className="section-tasks-list">
                      {sectionItems.map(renderItemRow)}
                    </div>
                  </div>
                );
              })}

              {activeSections.length === 0 && (
                <div className="empty-selection">
                  <p>Aucun élément pour cette date</p>
                </div>
              )}
            </div>
          </div>

          {/* Aperçu PDF (droite) */}
          <div className="pdf-export-preview">
            {generating ? (
              <div className="preview-loading">
                <Loader2 size={32} className="spin" />
                <p>Génération de l'aperçu…</p>
              </div>
            ) : pdfUrl ? (
              <iframe src={pdfUrl} className="pdf-preview-frame" title="Aperçu PDF" />
            ) : (
              <div className="preview-empty">
                <Eye size={40} />
                <p>Sélectionnez au moins un élément<br />pour voir l'aperçu</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pdf-export-footer">
          <button className="btn-cancel" onClick={onClose}>Annuler</button>
          <button className="btn-download" onClick={handleDownload} disabled={selectedIds.size === 0 || downloading}>
            {downloading ? (
              <><Loader2 size={15} className="spin" /> Téléchargement…</>
            ) : (
              <><FileDown size={15} /> Télécharger le PDF ({selectedIds.size} élément{selectedIds.size > 1 ? 's' : ''})</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskPDFExportModal;
