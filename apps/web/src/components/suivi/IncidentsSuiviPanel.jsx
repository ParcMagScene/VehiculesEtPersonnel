import './IncidentsSuiviPanel.css';

import { Calendar, ClipboardList, Loader2, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { Button, Input, Select, Textarea } from '@/design-system';

// [PERF Phase 4.G2] Composants Virtuoso pour la liste des tickets de la semaine.
// Definis au module pour eviter remount a chaque render du parent.
// On force les classes CSS metier (si-ticket-list / si-ticket-item) pour conserver
// le style et la semantique (ul/li).
const VirtuosoTicketList = forwardRef(function VirtuosoTicketList({ className, ...props }, ref) {
  return <ul ref={ref} {...props} className={`si-ticket-list ${className || ''}`.trim()} />;
});
const VirtuosoTicketItem = forwardRef(function VirtuosoTicketItem({ className, ...props }, ref) {
  return <li ref={ref} {...props} className={`si-ticket-item ${className || ''}`.trim()} />;
});
const VIRTUOSO_TICKET_COMPONENTS = {
  List: VirtuosoTicketList,
  Item: VirtuosoTicketItem,
};
// Seuil: en dessous, le map natif est plus rapide que l'overhead Virtuoso.
const TICKETS_VIRTUALIZE_THRESHOLD = 50;

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useRefreshSubscription } from '../../hooks/useRefreshSubscription';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import EntityCombobox from '../ui/EntityCombobox';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../ui/Modal';

const INCIDENT_TYPE_OPTIONS = [
  { value: 'vehicle_problem', label: 'Problème sur véhicule' },
  { value: 'equipment_problem', label: 'Problème sur équipement' },
  { value: 'equipment_omission', label: 'Oubli équipement' },
  { value: 'equipment_error', label: 'Erreur équipement' },
  { value: 'other', label: 'Autre incident' },
];

const CONTEXT_OPTIONS = [
  { value: 'transports', label: 'Transports' },
  { value: 'depots', label: 'Dépôts' },
  { value: 'relation_clientele', label: 'Relation clientèle' },
  { value: 'relations_collaborateurs', label: 'Relations collaborateurs' },
  { value: 'logistique', label: 'Logistique' },
  { value: 'securite', label: 'Sécurité' },
  { value: 'materiel', label: 'Matériel' },
  { value: 'autre_contexte', label: 'Autre contexte' },
];

const CTX_PREFIX = 'CTX:';
const isContextKey = (key) => String(key || '').startsWith(CTX_PREFIX);
const getContextLabel = (key) => {
  const type = String(key || '').slice(CTX_PREFIX.length);
  return CONTEXT_OPTIONS.find((o) => o.value === type)?.label || type;
};

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Ramène au jeudi de la semaine ISO (référence standard)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function formatMonthISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatIncidentType(type) {
  return INCIDENT_TYPE_OPTIONS.find((x) => x.value === type)?.label || type;
}

function makeEmptyIncident() {
  return {
    incident_type: 'vehicle_problem',
    description: '',
    reporter_person_id: '',
    vehicle_id: '',
    vehicle_name_snapshot: '',
    linked_maintenance_id: null,
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function makeEmptyTicketForm(affaireNum = '') {
  return {
    affaire_num: affaireNum,
    affaire_name: '',
    incident_date: todayISO(),
    affaire_start_date: '',
    affaire_end_date: '',
    is_tournee: false,
    linked_reservations: [],
    linked_personnel: [],
    notes: '',
    incidents: [makeEmptyIncident()],
  };
}

function buildFormFromTicket(ticket) {
  return {
    affaire_num: ticket.affaire_num,
    affaire_name: ticket.affaire_name || ticket.affaire_num,
    incident_date: ticket.incident_date || ticket.period_start_date || todayISO(),
    affaire_start_date: ticket.affaire_start_date || '',
    affaire_end_date: ticket.affaire_end_date || '',
    is_tournee: !!ticket.is_tournee,
    linked_reservations: Array.isArray(ticket.linked_reservations)
      ? ticket.linked_reservations
      : [],
    linked_personnel: Array.isArray(ticket.linked_personnel) ? ticket.linked_personnel : [],
    notes: ticket.notes || '',
    incidents:
      Array.isArray(ticket.incidents) && ticket.incidents.length > 0
        ? ticket.incidents.map((i) => ({
            incident_type: i.incident_type || 'other',
            description: i.description || '',
            reporter_person_id:
              i.reporter_person_id === null || i.reporter_person_id === undefined
                ? ''
                : String(i.reporter_person_id),
            vehicle_id:
              i.vehicle_id === null || i.vehicle_id === undefined ? '' : String(i.vehicle_id),
            vehicle_name_snapshot: i.vehicle_name_snapshot || '',
            linked_maintenance_id: i.linked_maintenance_id || null,
          }))
        : [makeEmptyIncident()],
  };
}

function IncidentsSuiviPanel({ currentUser: _currentUser }) {
  const [weekKey, setWeekKey] = useState(getISOWeek(new Date()));
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [tickets, setTickets] = useState([]);

  const [affaires, setAffaires] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);

  const [selectedAffaireNum, setSelectedAffaireNum] = useState('');
  const [ticketMode, setTicketMode] = useState('affaire'); // 'affaire' | 'contexte'
  const [selectedContextType, setSelectedContextType] = useState(CONTEXT_OPTIONS[0].value);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingTicketId, setDeletingTicketId] = useState(null);
  const [error, setError] = useState('');
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();

  // Lorsque true, le prochain useEffect de préremplissage est sauté
  // (utilisé quand on charge un ticket existant via startEditingTicket).
  const skipPrefillRef = useRef(false);

  const [form, setForm] = useState(makeEmptyTicketForm());

  const [synthMode, setSynthMode] = useState('semaine');
  const [synthWeek, setSynthWeek] = useState(getISOWeek(new Date()));
  const [synthMonth, setSynthMonth] = useState(formatMonthISO(new Date()));
  const [synthYear, setSynthYear] = useState(String(new Date().getFullYear()));
  const [synthLoading, setSynthLoading] = useState(false);
  const [synthese, setSynthese] = useState(null);

  const vehicleById = useMemo(() => {
    const map = new Map();
    for (const v of vehicles) map.set(String(v.id), v);
    return map;
  }, [vehicles]);

  const affaireOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    for (const a of affaires) {
      const numero = String(a.numeroAffaire || a.numero_affaire || '').trim();
      if (!numero || seen.has(numero)) continue;

      const nom = String(a.nom || a.titre || a.eventName || a.client || '').trim();
      options.push({
        id: numero,
        label: `${numero}${nom ? ` — ${nom}` : ''}`,
      });
      seen.add(numero);
    }

    return options;
  }, [affaires]);

  const personnelOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    for (const p of personnel) {
      const id = String(p.id ?? '').trim();
      if (!id || seen.has(id)) continue;

      const firstName = String(p.first_name || '').trim();
      const lastName = String(p.last_name || '').trim();
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || `Personnel #${id}`;

      options.push({ id, label: fullName });
      seen.add(id);
    }

    return options;
  }, [personnel]);

  const vehicleOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    for (const v of vehicles) {
      const id = String(v.id ?? '').trim();
      if (!id || seen.has(id)) continue;

      const name = String(v.name || '').trim() || `Véhicule #${id}`;
      const registration = String(v.registration || '').trim();
      const type = String(v.type || '').trim();

      const bits = [];
      if (registration) bits.push(registration);
      if (type) bits.push(type);

      options.push({
        id,
        label: bits.length > 0 ? `${name} — ${bits.join(' · ')}` : name,
      });
      seen.add(id);
    }

    return options;
  }, [vehicles]);

  const resetForm = useCallback(() => {
    setSelectedTicketId(null);
    setForm(makeEmptyTicketForm(selectedAffaireNum));
  }, [selectedAffaireNum]);

  const clearEditorForNewTicket = useCallback(() => {
    setSelectedAffaireNum('');
    setSelectedTicketId(null);
    setTicketMode('affaire');
    setSelectedContextType(CONTEXT_OPTIONS[0].value);
    setForm(makeEmptyTicketForm());
  }, []);

  const handleTicketModeChange = useCallback((mode) => {
    setTicketMode(mode);
    if (mode === 'contexte') {
      const ctxKey = CTX_PREFIX + CONTEXT_OPTIONS[0].value;
      setSelectedContextType(CONTEXT_OPTIONS[0].value);
      setSelectedAffaireNum(ctxKey);
    } else {
      setSelectedAffaireNum('');
      setForm(makeEmptyTicketForm());
    }
  }, []);

  const handleContextTypeChange = useCallback((value) => {
    setSelectedContextType(value);
    setSelectedAffaireNum(CTX_PREFIX + value);
  }, []);

  const loadWeekTickets = useCallback(async () => {
    setLoadingWeek(true);
    setError('');
    try {
      const data = await api.getSuiviIncidentTickets(weekKey);
      setTickets(Array.isArray(data?.tickets) ? data.tickets : []);
    } catch (err) {
      setError(err?.message || 'Erreur chargement des tickets incidents');
      setTickets([]);
    } finally {
      setLoadingWeek(false);
    }
  }, [weekKey]);

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    setError('');
    try {
      const [affairesData, personnelData, vehiclesData] = await Promise.all([
        api.getAffaires(),
        api.getSuiviPersonnel(),
        api.getVehicles(),
      ]);
      setAffaires(Array.isArray(affairesData) ? affairesData : []);
      setPersonnel(Array.isArray(personnelData) ? personnelData : []);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
    } catch (err) {
      setError(err?.message || 'Erreur chargement des données de référence');
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    loadWeekTickets();
  }, [loadWeekTickets]);

  // Recharge tickets + synthèse quand un autre composant du module Suivi publie
  useRefreshSubscription('suivi', () => {
    loadWeekTickets();
    loadSynthese();
  });

  useEffect(() => {
    if (skipPrefillRef.current) {
      skipPrefillRef.current = false;
      return;
    }
    if (!selectedAffaireNum) {
      resetForm();
      return;
    }

    // NB : on n'auto-charge plus un ticket existant pour la même affaire/contexte.
    // Plusieurs tickets sont autorisés par semaine + affaire/contexte. Pour éditer
    // un ticket existant, l'utilisateur clique dessus dans la liste « Tickets de
    // la semaine » (handler startEditingTicket).

    // Pour les tickets contexte (sans affaire), initialiser un formulaire vide
    if (isContextKey(selectedAffaireNum)) {
      setSelectedTicketId(null);
      setForm({
        ...makeEmptyTicketForm(),
        affaire_num: selectedAffaireNum,
        affaire_name: getContextLabel(selectedAffaireNum),
      });
      return;
    }

    (async () => {
      try {
        const base = await api.getSuiviIncidentAffaireBase(selectedAffaireNum);
        setSelectedTicketId(null);
        setForm({
          affaire_num: base.affaire_num || selectedAffaireNum,
          affaire_name: base.affaire_name || selectedAffaireNum,
          incident_date: todayISO(),
          affaire_start_date: base.affaire_start_date || '',
          affaire_end_date: base.affaire_end_date || '',
          is_tournee: !!base.is_tournee,
          linked_reservations: Array.isArray(base.linked_reservations)
            ? base.linked_reservations
            : [],
          linked_personnel: Array.isArray(base.linked_personnel) ? base.linked_personnel : [],
          notes: '',
          incidents: [makeEmptyIncident()],
        });
      } catch (err) {
        setError(err?.message || 'Erreur préremplissage affaire');
      }
    })();
  }, [selectedAffaireNum, resetForm]);

  const loadSynthese = useCallback(async () => {
    setSynthLoading(true);
    setError('');
    try {
      let data;
      if (synthMode === 'semaine') data = await api.getSuiviIncidentSyntheseSemaine(synthWeek);
      else if (synthMode === 'mois') data = await api.getSuiviIncidentSyntheseMois(synthMonth);
      else data = await api.getSuiviIncidentSyntheseAnnee(synthYear);
      setSynthese(data);
    } catch (err) {
      setError(err?.message || 'Erreur chargement synthèse incidents');
      setSynthese(null);
    } finally {
      setSynthLoading(false);
    }
  }, [synthMode, synthWeek, synthMonth, synthYear]);

  useEffect(() => {
    loadSynthese();
  }, [loadSynthese]);

  const handleIncidentChange = (idx, patch) => {
    setForm((prev) => ({
      ...prev,
      incidents: prev.incidents.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        if (Object.prototype.hasOwnProperty.call(patch, 'incident_type')) {
          if (patch.incident_type !== 'vehicle_problem') {
            next.vehicle_id = '';
            next.vehicle_name_snapshot = '';
            next.linked_maintenance_id = null;
          }
        }
        return next;
      }),
    }));
  };

  const addIncident = () => {
    setForm((prev) => ({ ...prev, incidents: [...prev.incidents, makeEmptyIncident()] }));
  };

  const removeIncident = (idx) => {
    setForm((prev) => ({
      ...prev,
      incidents:
        prev.incidents.length === 1
          ? [makeEmptyIncident()]
          : prev.incidents.filter((_, i) => i !== idx),
    }));
  };

  const startEditingTicket = useCallback((ticket) => {
    if (!ticket) return;
    const isCtx = isContextKey(ticket.affaire_num);
    skipPrefillRef.current = true; // évite l'écrasement par le prefill effect
    setTicketMode(isCtx ? 'contexte' : 'affaire');
    if (isCtx) {
      setSelectedContextType(String(ticket.affaire_num || '').slice(CTX_PREFIX.length));
    }
    setSelectedAffaireNum(ticket.affaire_num || '');
    setSelectedTicketId(ticket.id || null);
    setForm(buildFormFromTicket(ticket));
    setError('');
    setEditorOpen(true);
  }, []);

  const handleOpenCreate = useCallback(() => {
    skipPrefillRef.current = true;
    setSelectedTicketId(null);
    setTicketMode('affaire');
    setSelectedContextType(CONTEXT_OPTIONS[0].value);
    setSelectedAffaireNum('');
    setForm(makeEmptyTicketForm());
    setError('');
    setEditorOpen(true);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setEditorOpen(false);
  }, []);

  const handleSave = async () => {
    if (!form.affaire_num) {
      setError('Sélectionnez une affaire ou un contexte');
      return;
    }

    const incidentsWithDescription = form.incidents.filter(
      (i) => String(i.description || '').trim().length > 0,
    );

    const missingVehicle = incidentsWithDescription.find(
      (i) => i.incident_type === 'vehicle_problem' && !String(i.vehicle_id || '').trim(),
    );
    if (missingVehicle) {
      setError('Sélectionnez un véhicule pour chaque incident de type "Problème sur véhicule"');
      return;
    }

    const incidentsPayload = form.incidents
      .map((i) => ({
        incident_type: i.incident_type,
        description: String(i.description || '').trim(),
        reporter_person_id: i.reporter_person_id ? Number(i.reporter_person_id) : null,
        vehicle_id:
          i.incident_type === 'vehicle_problem' && i.vehicle_id ? Number(i.vehicle_id) : null,
        vehicle_name_snapshot:
          i.incident_type === 'vehicle_problem' && i.vehicle_id
            ? vehicleById.get(String(i.vehicle_id))?.name || i.vehicle_name_snapshot || ''
            : '',
        linked_maintenance_id: i.linked_maintenance_id || null,
      }))
      .filter((i) => i.description.length > 0);

    setSaving(true);
    setError('');
    try {
      await api.upsertSuiviIncidentTicket({
        id: selectedTicketId || undefined,
        week_key: weekKey,
        affaire_num: form.affaire_num,
        affaire_name: form.affaire_name,
        incident_date: form.incident_date || todayISO(),
        affaire_start_date: form.affaire_start_date || null,
        affaire_end_date: form.affaire_end_date || null,
        is_tournee: !!form.is_tournee,
        linked_reservations: form.linked_reservations,
        linked_personnel: form.linked_personnel,
        notes: form.notes || '',
        incidents: incidentsPayload,
      });
      await Promise.all([loadWeekTickets(), loadSynthese()]);
      refreshBus.publish('suivi');
      setEditorOpen(false);
      clearEditorForNewTicket();
    } catch (err) {
      setError(err?.message || 'Erreur sauvegarde ticket incident');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTicketId) return;
    setDeleting(true);
    setError('');
    try {
      await api.deleteSuiviIncidentTicket(selectedTicketId);
      await Promise.all([loadWeekTickets(), loadSynthese()]);
      refreshBus.publish('suivi');
      setEditorOpen(false);
      resetForm();
    } catch (err) {
      setError(err?.message || 'Erreur suppression ticket incident');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteTicket = (ticketId) => {
    if (!ticketId) return;
    confirm({
      title: 'Supprimer le ticket',
      message: 'Supprimer définitivement ce ticket incident ?',
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        setDeletingTicketId(ticketId);
        setError('');
        try {
          await api.deleteSuiviIncidentTicket(ticketId);
          if (selectedTicketId === ticketId) {
            setEditorOpen(false);
            resetForm();
          }
          await Promise.all([loadWeekTickets(), loadSynthese()]);
          refreshBus.publish('suivi');
        } catch (err) {
          setError(err?.message || 'Erreur suppression ticket incident');
        } finally {
          setDeletingTicketId(null);
        }
      },
    });
  };

  return (
    <div className="suivi-incidents-panel">
      {error && <div className="si-error">{error}</div>}

      <div className="si-grid">
        <section className="si-editor-card">
          <div className="si-card-header si-card-header--actions">
            <h4>
              <ClipboardList size={15} /> Tickets incidents
            </h4>
            <Button variant="primary" size="sm" onClick={handleOpenCreate}>
              <Plus size={13} /> Nouveau ticket
            </Button>
          </div>

          <div className="si-field-row">
            <label>Semaine</label>
            <Input type="week" value={weekKey} onChange={(e) => setWeekKey(e.target.value)} />
          </div>

          <div className="si-week-list">
            <div className="si-linked-title">Tickets de la semaine ({tickets.length})</div>
            {loadingWeek ? (
              <div className="si-loading-inline">
                <Loader2 size={14} className="animate-spin" /> Chargement...
              </div>
            ) : tickets.length === 0 ? (
              <div className="si-empty">Aucun ticket cette semaine</div>
            ) : (
              (() => {
                // [PERF Phase 4.G2] Rendu d'un ticket extrait pour reutilisation
                // entre le mode <ul>.map() (petit jeu) et le mode Virtuoso (grand jeu).
                const renderTicketInner = (t) => (
                  <>
                    <Button
                      type="button"
                      className="si-ticket-pick"
                      onClick={() => startEditingTicket(t)}
                      title="Modifier ce ticket"
                    >
                      <span>
                        {t.incident_date ? `[${t.incident_date}] ` : ''}
                        {isContextKey(t.affaire_num)
                          ? `[${getContextLabel(t.affaire_num)}]`
                          : `${t.affaire_num} — ${t.affaire_name || t.affaire_num}`}
                      </span>
                      <span>{Array.isArray(t.incidents) ? t.incidents.length : 0} incident(s)</span>
                    </Button>
                    <div className="si-ticket-row-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditingTicket(t)}
                        title="Modifier le ticket"
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="si-danger"
                        onClick={() => handleDeleteTicket(t.id)}
                        disabled={deletingTicketId === t.id}
                        title="Supprimer le ticket"
                      >
                        {deletingTicketId === t.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </Button>
                    </div>
                  </>
                );

                if (tickets.length > TICKETS_VIRTUALIZE_THRESHOLD) {
                  return (
                    <Virtuoso
                      style={{ height: 480 }}
                      data={tickets}
                      components={VIRTUOSO_TICKET_COMPONENTS}
                      computeItemKey={(_idx, t) => t.id}
                      itemContent={(_idx, t) => renderTicketInner(t)}
                    />
                  );
                }
                return (
                  <ul className="si-ticket-list">
                    {tickets.map((t) => (
                      <li key={t.id} className="si-ticket-item">
                        {renderTicketInner(t)}
                      </li>
                    ))}
                  </ul>
                );
              })()
            )}
          </div>
        </section>

        <section className="si-synthese-card">
          <div className="si-card-header">
            <h4>
              <Calendar size={15} /> Synthèses incidents
            </h4>
          </div>

          <div className="si-synth-controls">
            <div className="si-mode-tabs">
              <Button
                className={synthMode === 'semaine' ? 'active' : ''}
                onClick={() => setSynthMode('semaine')}
              >
                Semaine
              </Button>
              <Button
                className={synthMode === 'mois' ? 'active' : ''}
                onClick={() => setSynthMode('mois')}
              >
                Mois
              </Button>
              <Button
                className={synthMode === 'annee' ? 'active' : ''}
                onClick={() => setSynthMode('annee')}
              >
                Année
              </Button>
            </div>

            {synthMode === 'semaine' && (
              <Input type="week" value={synthWeek} onChange={(e) => setSynthWeek(e.target.value)} />
            )}
            {synthMode === 'mois' && (
              <Input
                type="month"
                value={synthMonth}
                onChange={(e) => setSynthMonth(e.target.value)}
              />
            )}
            {synthMode === 'annee' && (
              <Input
                type="number"
                min="2020"
                max="2100"
                value={synthYear}
                onChange={(e) => setSynthYear(e.target.value)}
              />
            )}
          </div>

          {synthLoading ? (
            <div className="si-loading-inline">
              <Loader2 size={14} className="animate-spin" /> Génération synthèse...
            </div>
          ) : !synthese ? (
            <div className="si-empty">Aucune synthèse disponible</div>
          ) : (
            <>
              <div className="si-kpis">
                <div className="si-kpi">
                  <span className="value">{synthese.summary?.total_tickets || 0}</span>
                  <span className="label">Tickets</span>
                </div>
                <div className="si-kpi">
                  <span className="value">{synthese.summary?.total_incidents || 0}</span>
                  <span className="label">Incidents</span>
                </div>
                <div className="si-kpi">
                  <span className="value">{synthese.summary?.affaires_count || 0}</span>
                  <span className="label">Affaires touchées</span>
                </div>
              </div>

              <div className="si-linked-block">
                <div className="si-linked-title">Incidents par type</div>
                <ul>
                  {Object.entries(synthese.summary?.incident_type_counts || {}).length === 0 ? (
                    <li>Aucun incident</li>
                  ) : (
                    Object.entries(synthese.summary.incident_type_counts).map(([k, v]) => (
                      <li key={k}>
                        {formatIncidentType(k)}: {v}
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="si-linked-block">
                <div className="si-linked-title">Affaires les plus impactées</div>
                {Array.isArray(synthese.by_affaire) && synthese.by_affaire.length > 0 ? (
                  <table className="si-table">
                    <thead>
                      <tr>
                        <th>Affaire</th>
                        <th>Tickets</th>
                        <th>Incidents</th>
                        <th>Tournée</th>
                      </tr>
                    </thead>
                    <tbody>
                      {synthese.by_affaire.slice(0, 20).map((a) => (
                        <tr key={a.affaire_num}>
                          <td>
                            {a.affaire_num} — {a.affaire_name}
                          </td>
                          <td>{a.tickets}</td>
                          <td>{a.incidents}</td>
                          <td>{a.is_tournee ? 'Oui' : 'Non'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="si-empty">Aucune affaire dans cette période</div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <Modal open={editorOpen} onClose={handleCloseEditor} size="lg">
        <ModalHeader icon={<ClipboardList size={18} />} onClose={handleCloseEditor}>
          {selectedTicketId ? 'Modifier le ticket incident' : 'Nouveau ticket incident'}
        </ModalHeader>
        <ModalBody>
          {error && <div className="si-error">{error}</div>}

          <div className="si-field-row">
            <label>Type</label>
            <div className="si-mode-toggle">
              <Button
                type="button"
                className={ticketMode === 'affaire' ? 'active' : ''}
                onClick={() => handleTicketModeChange('affaire')}
              >
                Affaire
              </Button>
              <Button
                type="button"
                className={ticketMode === 'contexte' ? 'active' : ''}
                onClick={() => handleTicketModeChange('contexte')}
              >
                Contexte
              </Button>
            </div>
          </div>

          {ticketMode === 'affaire' ? (
            <div className="si-field-row">
              <label>Affaire</label>
              <EntityCombobox
                value={selectedAffaireNum}
                onChange={setSelectedAffaireNum}
                options={affaireOptions}
                placeholder="— Rechercher une affaire —"
                className="si-affaire-combobox"
                disabled={loadingLists}
              />
            </div>
          ) : (
            <div className="si-field-row">
              <label>Contexte</label>
              <Select
                value={selectedContextType}
                onChange={(e) => handleContextTypeChange(e.target.value)}
                className="si-context-select"
              >
                {CONTEXT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {ticketMode === 'affaire' && (
            <div className="si-prefill">
              <div>
                <strong>Numéro:</strong> {form.affaire_num || '—'}
              </div>
              <div>
                <strong>Nom:</strong> {form.affaire_name || '—'}
              </div>
              <div>
                <strong>Dates:</strong> {form.affaire_start_date || '—'} →{' '}
                {form.affaire_end_date || '—'}
              </div>
              <div>
                <strong>Tournée:</strong> {form.is_tournee ? 'Oui' : 'Non'}
              </div>
              <div>
                <strong>Réservations liées:</strong> {form.linked_reservations.length}
              </div>
              <div>
                <strong>Personnels liés:</strong> {form.linked_personnel.length}
              </div>
            </div>
          )}

          {form.linked_reservations.length > 0 && (
            <div className="si-linked-block">
              <div className="si-linked-title">Réservations liées</div>
              <ul>
                {form.linked_reservations.slice(0, 10).map((r) => (
                  <li key={r.id}>
                    {r.vehicle_name || r.vehicle_id || 'Véhicule'} — {r.start_date || '—'} →{' '}
                    {r.end_date || '—'}
                    {r.is_tournee ? ' [Tournée]' : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {form.linked_personnel.length > 0 && (
            <div className="si-linked-block">
              <div className="si-linked-title">Personnels liés</div>
              <ul>
                {form.linked_personnel.slice(0, 12).map((p, idx) => (
                  <li key={`${p.id || 'x'}-${idx}`}>
                    {[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Personnel'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="si-field-row">
            <label>Date incident</label>
            <Input
              type="date"
              value={form.incident_date || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, incident_date: e.target.value }))}
            />
          </div>

          <div className="si-field-row">
            <label>Notes ticket</label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
              placeholder="Contexte global du ticket incident"
            />
          </div>

          <div className="si-incidents-head">
            <span>Incidents</span>
            <Button variant="secondary" size="sm" onClick={addIncident}>
              <Plus size={13} /> Ajouter
            </Button>
          </div>

          <div className="si-incidents-list">
            {form.incidents.map((inc, idx) => (
              <div key={idx} className="si-incident-row">
                <div className="si-incident-row-top">
                  <Select
                    value={inc.incident_type}
                    onChange={(e) => handleIncidentChange(idx, { incident_type: e.target.value })}
                  >
                    {INCIDENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                  <EntityCombobox
                    value={String(inc.reporter_person_id || '')}
                    onChange={(value) => handleIncidentChange(idx, { reporter_person_id: value })}
                    options={personnelOptions}
                    placeholder="— Rechercher le signaleur —"
                    className="si-reporter-combobox"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="si-danger"
                    onClick={() => removeIncident(idx)}
                    title="Supprimer incident"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  value={inc.description}
                  onChange={(e) => handleIncidentChange(idx, { description: e.target.value })}
                  placeholder="Décrivez l'incident"
                />

                {inc.incident_type === 'vehicle_problem' && (
                  <div className="si-incident-extra">
                    <EntityCombobox
                      value={String(inc.vehicle_id || '')}
                      onChange={(value) => {
                        const selected = vehicleById.get(String(value));
                        handleIncidentChange(idx, {
                          vehicle_id: value,
                          vehicle_name_snapshot: selected?.name || '',
                        });
                      }}
                      options={vehicleOptions}
                      placeholder="— Choisir le véhicule concerné —"
                      className="si-vehicle-combobox"
                      disabled={loadingLists}
                    />
                    {inc.linked_maintenance_id ? (
                      <div className="si-incident-help">
                        Signalement panne lié: {inc.linked_maintenance_id}
                      </div>
                    ) : (
                      <div className="si-incident-help">
                        Un signalement de panne sera créé automatiquement à l'enregistrement.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ModalBody>
        <ModalFooter align="between">
          <div>
            {selectedTicketId && (
              <Button
                variant="ghost"
                className="si-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}{' '}
                Supprimer
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={handleCloseEditor} disabled={saving}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || !form.affaire_num}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{' '}
              {selectedTicketId ? 'Mettre à jour' : 'Créer ticket'}
            </Button>
          </div>
        </ModalFooter>
      </Modal>
      {ConfirmDialogRenderer}
    </div>
  );
}

export default memo(IncidentsSuiviPanel);
