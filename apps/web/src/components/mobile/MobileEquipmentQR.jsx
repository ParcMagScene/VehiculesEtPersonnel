import './MobileEquipmentQR.css';

import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  Home,
  Loader,
  Settings,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, InlineAlert, Input, Select, Spinner, Textarea } from '@/design-system';

import { EQUIPMENT_STATUS, STATUS } from '../../constants';
import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import MobileControlsScreen from './MobileControlsScreen';

// ═══ ÉCRAN QR — PAGE D'ATTERRISSAGE APRÈS SCAN QR CODE ═══
// URL: /#/mobile/equipment/EMAG-XXXXX
// Affiche un menu multi-choix pour l'équipement scanné

const SAV_STATUS = {
  open: { label: 'Ouvert', color: STATUS_COLORS.danger },
  in_progress: { label: 'En cours', color: STATUS_COLORS.warning },
  waiting_parts: { label: 'Attente pièces', color: ACCENT_COLORS.violet },
  resolved: { label: 'Résolu', color: STATUS_COLORS.success },
  closed: { label: 'Clôturé', color: 'var(--theme-text-gray)' },
};

const safeDate = (d) => {
  if (!d) return '—';
  try {
    const m = String(d)
      .trim()
      .match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return '—';
  } catch {
    return '—';
  }
};

function MobileEquipmentQR({ uid, onBack, onNavigateHome, currentUser }) {
  const toast = useToast();
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [screen, setScreen] = useState('menu'); // menu | fiche | defaut | sav | intervention
  const [defautForm, setDefautForm] = useState({ title: '', description: '' });
  const [savForm, setSavForm] = useState({
    title: '',
    description: '',
    type: 'panne',
    priority: 'medium',
  });
  const [interventionForm, setInterventionForm] = useState({
    title: '',
    description: '',
    type: 'reparation',
    resolution: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  const isAdmin = currentUser?.isAdmin === true;
  const canManageEquipmentMaintenance =
    isAdmin || currentUser?.permissions?.canManageEquipmentMaintenance === true;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await api.getEquipmentByUid(uid);
        // Modèle A : 1 ligne equipment = 1 unité physique avec uid+serial uniques.
        setEquipment(data);
      } catch (err) {
        setError(err.message || 'Équipement introuvable');
      } finally {
        setLoading(false);
      }
    };
    if (uid) load();
  }, [uid]);

  const handleSubmitDefaut = async () => {
    if (!defautForm.title.trim()) return toast.warning('Titre requis');
    setSubmitting(true);
    try {
      await api.createSavRequest({
        equipment_id: equipment.id,
        title: `⚠️ ${defautForm.title}`,
        description: defautForm.description,
        type: 'panne',
        priority: 'medium',
      });
      setSubmitSuccess('Signalement envoyé !');
      setDefautForm({ title: '', description: '' });
      setTimeout(() => {
        setSubmitSuccess(null);
        setScreen('menu');
      }, 2000);
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSav = async () => {
    if (!savForm.title.trim()) return toast.warning('Titre requis');
    setSubmitting(true);
    try {
      if (canManageEquipmentMaintenance) {
        await api.createSavTicket({
          equipment_id: equipment.id,
          title: savForm.title,
          description: savForm.description,
          type: savForm.type,
          priority: savForm.priority,
        });
        setSubmitSuccess('Ticket SAV créé !');
      } else {
        await api.createSavRequest({
          equipment_id: equipment.id,
          title: savForm.title,
          description: savForm.description,
          type: savForm.type,
          priority: savForm.priority,
        });
        setSubmitSuccess('Demande SAV créée !');
      }
      setSavForm({ title: '', description: '', type: 'panne', priority: 'medium' });
      setTimeout(() => {
        setSubmitSuccess(null);
        setScreen('menu');
      }, 2000);
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitIntervention = async () => {
    if (!interventionForm.title.trim()) return toast.warning('Titre requis');
    setSubmitting(true);
    try {
      await api.createSavTicket({
        equipment_id: equipment.id,
        title: interventionForm.title,
        description: interventionForm.description,
        type: interventionForm.type,
        priority: 'medium',
        status: 'resolved',
        resolution: interventionForm.resolution,
        assigned_to: null,
      });
      setSubmitSuccess('Intervention enregistrée !');
      setInterventionForm({ title: '', description: '', type: 'reparation', resolution: '' });
      setTimeout(() => {
        setSubmitSuccess(null);
        setScreen('menu');
      }, 2000);
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="m-eq-qr">
        <div className="m-eq-qr-loading">
          <Spinner size="lg" />
          <p>Recherche de l'équipement...</p>
          <code>{uid}</code>
        </div>
      </div>
    );
  }

  if (error || !equipment) {
    return (
      <div className="m-eq-qr">
        <div className="m-eq-qr-error">
          <AlertTriangle size={48} color={STATUS_COLORS.danger} />
          <h2>Équipement introuvable</h2>
          <p>
            UID : <code>{uid}</code>
          </p>
          <p>{error}</p>
          <Button variant="ghost" className="m-eq-qr-btn" onClick={onBack || onNavigateHome}>
            <Home size={18} /> Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  const st = EQUIPMENT_STATUS[equipment.status] || EQUIPMENT_STATUS.available;
  const activeTickets = (equipment.savTickets || []).filter(
    (t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting_parts',
  );

  // ═══ FICHE ÉQUIPEMENT ═══
  if (screen === 'fiche') {
    return (
      <div className="m-eq-qr">
        <div className="m-eq-qr-header">
          <Button variant="ghost" onClick={() => setScreen('menu')} aria-label="Retour">
            <ArrowLeft size={20} />
          </Button>
          <h2>Fiche Équipement</h2>
        </div>
        <div className="m-eq-qr-fiche">
          <div className="m-eq-qr-fiche-title">
            <span className="m-eq-qr-cat-icon">
              {equipment.categoryIcon || equipment.category_icon || '📦'}
            </span>
            <div>
              <h3>{equipment.name}</h3>
              <span className="m-eq-qr-status" style={{ background: st.color }}>
                {st.icon} {st.label}
              </span>
            </div>
          </div>
          <div className="m-eq-qr-fiche-grid">
            <div>
              <label>UID</label>
              <strong>
                <code>{equipment.uid}</code>
              </strong>
            </div>
            {equipment.reference && (
              <div>
                <label>Référence</label>
                <strong>{equipment.reference}</strong>
              </div>
            )}
            {(equipment.serialNumber || equipment.serial_number) && (
              <div>
                <label>N° Série</label>
                <strong>{equipment.serialNumber || equipment.serial_number}</strong>
              </div>
            )}
            {equipment.brand && (
              <div>
                <label>Marque</label>
                <strong>{equipment.brand}</strong>
              </div>
            )}
            {equipment.location && (
              <div>
                <label>Zone</label>
                <strong>{equipment.location}</strong>
              </div>
            )}
            {(equipment.categoryName || equipment.category_name) && (
              <div>
                <label>Catégorie</label>
                <strong>{equipment.categoryName || equipment.category_name}</strong>
              </div>
            )}
            {(equipment.purchaseDate || equipment.purchase_date) && (
              <div>
                <label>Achat</label>
                <strong>{safeDate(equipment.purchaseDate || equipment.purchase_date)}</strong>
              </div>
            )}
            {(equipment.warrantyEnd || equipment.warranty_end) && (
              <div>
                <label>Garantie</label>
                <strong>→ {safeDate(equipment.warrantyEnd || equipment.warranty_end)}</strong>
              </div>
            )}
          </div>
          {equipment.notes && (
            <div className="m-eq-qr-notes">
              <p>{equipment.notes}</p>
            </div>
          )}

          {/* Attributions actives */}
          {equipment.assignments?.filter((a) => a.status === STATUS.ACTIVE).length > 0 && (
            <div className="m-eq-qr-section">
              <h4>👤 Attribué à</h4>
              {equipment.assignments
                .filter((a) => a.status === STATUS.ACTIVE)
                .map((a) => (
                  <div key={a.id} className="m-eq-qr-assign">
                    <strong>
                      {a.firstName || a.first_name} {a.lastName || a.last_name}
                    </strong>
                    <span>depuis le {safeDate(a.startDate || a.start_date)}</span>
                  </div>
                ))}
            </div>
          )}

          {/* Tickets SAV actifs */}
          {activeTickets.length > 0 && (
            <div className="m-eq-qr-section">
              <h4 style={{ color: STATUS_COLORS.warning }}>
                🔧 Interventions en cours ({activeTickets.length})
              </h4>
              {activeTickets.map((t) => {
                const tst = SAV_STATUS[t.status] || SAV_STATUS.open;
                return (
                  <div key={t.id} className="m-eq-qr-ticket">
                    <div className="m-eq-qr-ticket-head">
                      <span className="m-eq-qr-ticket-status" style={{ background: tst.color }}>
                        {tst.label}
                      </span>
                      <span>{safeDate(t.created_at)}</span>
                    </div>
                    <strong>{t.title}</strong>
                    {t.description && <p>{t.description}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══ SIGNALISATION DÉFAUT ═══
  if (screen === 'defaut') {
    return (
      <div className="m-eq-qr">
        <div className="m-eq-qr-header">
          <Button variant="ghost" onClick={() => setScreen('menu')} aria-label="Retour">
            <ArrowLeft size={20} />
          </Button>
          <h2>⚠️ Signaler un défaut</h2>
        </div>
        {submitSuccess ? (
          <InlineAlert variant="success">{submitSuccess}</InlineAlert>
        ) : (
          <div className="m-eq-qr-form">
            <p className="m-eq-qr-eq-label">
              {equipment.categoryIcon || '📦'} {equipment.name} — <code>{equipment.uid}</code>
            </p>
            <label>Quel est le problème ? *</label>
            <Input
              type="text"
              value={defautForm.title}
              onChange={(e) => setDefautForm({ ...defautForm, title: e.target.value })}
              placeholder="Ex: Câble arraché, bouton cassé..."
              autoFocus
            />
            <label>Détails (optionnel)</label>
            <Textarea
              value={defautForm.description}
              onChange={(e) => setDefautForm({ ...defautForm, description: e.target.value })}
              rows={4}
              placeholder="Quand est-ce arrivé ? Circonstances..."
            />
            <Button
              variant="ghost"
              className="m-eq-qr-submit warn"
              onClick={handleSubmitDefaut}
              disabled={submitting}
            >
              {submitting ? <Loader size={16} className="spin" /> : <AlertTriangle size={16} />}
              Envoyer le signalement
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ═══ DEMANDE DE SAV ═══
  if (screen === 'sav') {
    return (
      <div className="m-eq-qr">
        <div className="m-eq-qr-header">
          <Button variant="ghost" onClick={() => setScreen('menu')} aria-label="Retour">
            <ArrowLeft size={20} />
          </Button>
          <h2>{canManageEquipmentMaintenance ? '🔧 Ticket SAV' : '🔧 Demande de SAV'}</h2>
        </div>
        {submitSuccess ? (
          <InlineAlert variant="success">{submitSuccess}</InlineAlert>
        ) : (
          <div className="m-eq-qr-form">
            <p className="m-eq-qr-eq-label">
              {equipment.categoryIcon || '📦'} {equipment.name} — <code>{equipment.uid}</code>
            </p>
            <label>Type d'intervention</label>
            <Select
              value={savForm.type}
              onChange={(e) => setSavForm({ ...savForm, type: e.target.value })}
            >
              <option value="panne">Panne</option>
              <option value="entretien">Entretien</option>
              <option value="reparation">Réparation</option>
              <option value="calibrage">Calibrage</option>
            </Select>
            <label>Priorité</label>
            <Select
              value={savForm.priority}
              onChange={(e) => setSavForm({ ...savForm, priority: e.target.value })}
            >
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
              <option value="urgent">Urgente</option>
            </Select>
            <label>Titre *</label>
            <Input
              type="text"
              value={savForm.title}
              onChange={(e) => setSavForm({ ...savForm, title: e.target.value })}
              placeholder="Ex: Batterie ne charge plus"
            />
            <label>Description</label>
            <Textarea
              value={savForm.description}
              onChange={(e) => setSavForm({ ...savForm, description: e.target.value })}
              rows={4}
              placeholder="Détails du problème..."
            />
            <Button
              variant="ghost"
              className="m-eq-qr-submit"
              onClick={handleSubmitSav}
              disabled={submitting}
            >
              {submitting ? <Loader size={16} className="spin" /> : <Wrench size={16} />}
              {canManageEquipmentMaintenance ? 'Créer le ticket SAV' : 'Créer la demande SAV'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ═══ INTERVENTION DIRECTE (maintenance matériel) ═══
  if (screen === 'intervention') {
    return (
      <div className="m-eq-qr">
        <div className="m-eq-qr-header">
          <Button variant="ghost" onClick={() => setScreen('menu')} aria-label="Retour">
            <ArrowLeft size={20} />
          </Button>
          <h2>⚙️ Intervention directe</h2>
        </div>
        {submitSuccess ? (
          <InlineAlert variant="success">{submitSuccess}</InlineAlert>
        ) : (
          <div className="m-eq-qr-form">
            <p className="m-eq-qr-eq-label">
              {equipment.categoryIcon || '📦'} {equipment.name} — <code>{equipment.uid}</code>
            </p>
            <label>Type</label>
            <Select
              value={interventionForm.type}
              onChange={(e) => setInterventionForm({ ...interventionForm, type: e.target.value })}
            >
              <option value="reparation">Réparation</option>
              <option value="entretien">Entretien</option>
              <option value="calibrage">Calibrage</option>
            </Select>
            <label>Titre de l'intervention *</label>
            <Input
              type="text"
              value={interventionForm.title}
              onChange={(e) => setInterventionForm({ ...interventionForm, title: e.target.value })}
              placeholder="Ex: Remplacement fusible HP"
            />
            <label>Description</label>
            <Textarea
              value={interventionForm.description}
              onChange={(e) =>
                setInterventionForm({ ...interventionForm, description: e.target.value })
              }
              rows={3}
              placeholder="Actions effectuées..."
            />
            <label>Résolution</label>
            <Textarea
              value={interventionForm.resolution}
              onChange={(e) =>
                setInterventionForm({ ...interventionForm, resolution: e.target.value })
              }
              rows={3}
              placeholder="Pièces changées, résultat..."
            />
            <Button
              variant="ghost"
              className="m-eq-qr-submit ok"
              onClick={handleSubmitIntervention}
              disabled={submitting}
            >
              {submitting ? <Loader size={16} className="spin" /> : <Settings size={16} />}
              Enregistrer l'intervention
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ═══ CONTRÔLES PÉRIODIQUES ═══
  if (screen === 'controles') {
    return (
      <MobileControlsScreen
        entityType="equipment"
        entityId={String(equipment.id)}
        entityLabel={`${equipment.name} — ${equipment.uid}`}
        onBack={() => setScreen('menu')}
      />
    );
  }

  // ═══ MENU PRINCIPAL ═══
  return (
    <div className="m-eq-qr">
      <div className="m-eq-qr-header">
        <Button variant="ghost" onClick={onBack || onNavigateHome} aria-label="Retour">
          <ArrowLeft size={20} />
        </Button>
        <h2>Équipement scanné</h2>
      </div>

      {/* Carte de l'équipement */}
      <div className="m-eq-qr-card">
        <div
          className="m-eq-qr-card-icon"
          style={{
            background: equipment.categoryColor || equipment.category_color || ACCENT_COLORS.indigo,
          }}
        >
          {equipment.categoryIcon || equipment.category_icon || '📦'}
        </div>
        <div className="m-eq-qr-card-info">
          <h3>{equipment.name}</h3>
          <span className="m-eq-qr-uid">
            <code>{equipment.uid}</code>
          </span>
          {equipment.reference && <span className="m-eq-qr-ref">Réf: {equipment.reference}</span>}
          <span className="m-eq-qr-status" style={{ background: st.color }}>
            {st.icon} {st.label}
          </span>
        </div>
      </div>

      {activeTickets.length > 0 && (
        <div className="m-eq-qr-alert">
          <AlertTriangle size={16} />
          <span>{activeTickets.length} intervention(s) en cours</span>
        </div>
      )}

      {/* Menu multi-choix */}
      <div className="m-eq-qr-menu">
        <Button variant="ghost" className="m-eq-qr-menu-btn home" onClick={onNavigateHome}>
          <Home size={24} />
          <div>
            <strong>eM@g Home</strong>
            <span>Retour à l'accueil mobile</span>
          </div>
        </Button>

        <Button
          variant="ghost"
          className="m-eq-qr-menu-btn fiche"
          onClick={() => setScreen('fiche')}
        >
          <FileText size={24} />
          <div>
            <strong>Fiche Équipement</strong>
            <span>Voir les détails, attributions, historique</span>
          </div>
        </Button>

        <Button
          variant="ghost"
          className="m-eq-qr-menu-btn defaut"
          onClick={() => setScreen('defaut')}
        >
          <AlertTriangle size={24} />
          <div>
            <strong>Signalisation Défaut</strong>
            <span>Signaler un problème sur cet équipement</span>
          </div>
        </Button>

        <Button variant="ghost" className="m-eq-qr-menu-btn sav" onClick={() => setScreen('sav')}>
          <Wrench size={24} />
          <div>
            <strong>{canManageEquipmentMaintenance ? 'Ticket SAV' : 'Demande de SAV'}</strong>
            <span>
              {canManageEquipmentMaintenance
                ? "Créer un ticket d'intervention"
                : "Créer une demande d'intervention"}
            </span>
          </div>
        </Button>

        {canManageEquipmentMaintenance && (
          <Button
            variant="ghost"
            className="m-eq-qr-menu-btn intervention"
            onClick={() => setScreen('intervention')}
          >
            <Settings size={24} />
            <div>
              <strong>Intervention directe</strong>
              <span>Enregistrer une intervention immédiate</span>
            </div>
          </Button>
        )}

        <Button
          variant="ghost"
          className="m-eq-qr-menu-btn controles"
          onClick={() => setScreen('controles')}
        >
          <ShieldCheck size={24} />
          <div>
            <strong>Contrôles périodiques</strong>
            <span>Voir et effectuer les contrôles planifiés</span>
          </div>
        </Button>
      </div>
    </div>
  );
}

export default MobileEquipmentQR;
