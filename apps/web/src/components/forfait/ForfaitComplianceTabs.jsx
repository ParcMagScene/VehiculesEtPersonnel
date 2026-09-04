// Onglets couches 4 & 5 du module forfait-jours :
// PosesTab (pointages 1/2j + validation pose), EntretiensTab, AlertesTab.
// Réf. art. 5.7.3, 5.7.4, 5.7.5 (avenant n° 3 du 22-4-2025).
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  MessageSquareWarning,
  Plus,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button, FormField, InlineAlert, Input, SectionHeader, Select } from '@/design-system';

import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

const ISO_TODAY = () => new Date().toISOString().slice(0, 10);
const ISO_IN_DAYS = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// ═════════════════════════════════════════════════════════════════
// Onglet POSES
// ═════════════════════════════════════════════════════════════════
export function PosesTab({ personId, year }) {
  const toast = useToast();
  const [poses, setPoses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [poseDate, setPoseDate] = useState(ISO_IN_DAYS(15));
  const [period, setPeriod] = useState('FULL');
  const [poseType, setPoseType] = useState('repos_conv');
  const [hoursWorked, setHoursWorked] = useState('');
  const [validation, setValidation] = useState(null);

  const load = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    try {
      const r = await api.listForfaitPoses(personId, {
        from: `${year}-01-01`,
        to: `${year}-12-31`,
      });
      setPoses(r.poses || []);
    } catch (e) {
      toast.error(`Poses : ${e.message || e.error}`);
    } finally {
      setLoading(false);
    }
  }, [personId, year, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const validate = async () => {
    setValidation(null);
    try {
      const r = await api.validateForfaitPose({
        personId,
        scheduledDate: poseDate,
        requestDate: ISO_TODAY(),
        period,
      });
      setValidation(r);
    } catch (e) {
      toast.error(e.message || e.error || 'Erreur validation');
    }
  };

  const create = async () => {
    try {
      await api.createForfaitPose({
        personId,
        poseDate,
        period,
        poseType,
        hoursWorked: hoursWorked === '' ? undefined : Number(hoursWorked),
      });
      toast.success('Pose enregistrée');
      setValidation(null);
      await load();
    } catch (e) {
      toast.error(e.error || e.message || 'Erreur création');
    }
  };

  return (
    <div className="forfait-tab">
      <SectionHeader
        title="Pose de repos"
        subtitle="Prévenance ≥ 14 j · max 5 j consécutifs travaillés · avant le 31/12 (Art. 5.7.3)"
      />
      <div className="forfait-pose-form">
        <FormField label="Date de la pose">
          <Input type="date" value={poseDate} onChange={(e) => setPoseDate(e.target.value)} />
        </FormField>
        <FormField label="Période">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="FULL">Journée complète</option>
            <option value="AM">Matin</option>
            <option value="PM">Après-midi</option>
          </Select>
        </FormField>
        <FormField label="Type">
          <Select value={poseType} onChange={(e) => setPoseType(e.target.value)}>
            <option value="repos_conv">Repos conventionnel</option>
            <option value="rachat">Jour racheté</option>
            <option value="conge">Congé</option>
            <option value="work">Travaillé (pointage)</option>
          </Select>
        </FormField>
        {poseType === 'work' && (
          <FormField label="Heures travaillées (≤ 4h = 1/2j)">
            <Input
              type="number"
              step="0.25"
              min="0"
              max="24"
              value={hoursWorked}
              onChange={(e) => setHoursWorked(e.target.value)}
            />
          </FormField>
        )}
        <div className="forfait-pose-actions">
          <Button variant="secondary" onClick={validate}>
            <CheckCircle2 size={14} /> Vérifier
          </Button>
          <Button variant="primary" onClick={create}>
            <Plus size={14} /> Enregistrer
          </Button>
        </div>
      </div>

      {validation && (
        <div className="forfait-validation-result">
          {validation.ok ? (
            <InlineAlert variant="success">
              <CheckCircle2 size={14} /> Pose conforme aux règles conventionnelles.
            </InlineAlert>
          ) : (
            <InlineAlert variant="warning">
              <AlertTriangle size={14} /> Non conforme :
              <ul className="forfait-validation-errors">
                {validation.failures.map((f) => (
                  <li key={f.code}>
                    {f.code === 'NOTICE_TOO_SHORT' &&
                      `Prévenance ${f.detail.delayDays} j (min ${f.detail.minDays} j)`}
                    {f.code === 'MAX_CONSECUTIVE_EXCEEDED' &&
                      `${f.detail.maxRun} j consécutifs travaillés (max ${f.detail.limit})`}
                    {f.code === 'POSE_AFTER_YEAR_END' && `Date au-delà du ${f.detail.deadline}`}
                  </li>
                ))}
              </ul>
            </InlineAlert>
          )}
        </div>
      )}

      <SectionHeader title={`Poses ${year}`} />
      {loading ? (
        <div className="forfait-empty">Chargement…</div>
      ) : poses.length === 0 ? (
        <div className="forfait-empty">Aucune pose enregistrée.</div>
      ) : (
        <table className="forfait-poses-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Période</th>
              <th>Type</th>
              <th>Équivalent</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {poses.map((p) => (
              <tr key={p.id}>
                <td>{p.pose_date}</td>
                <td>{p.period}</td>
                <td>{p.pose_type}</td>
                <td>{p.worked_days_equiv ?? (p.period === 'FULL' ? 1 : 0.5)} j</td>
                <td>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Onglet ENTRETIENS
// ═════════════════════════════════════════════════════════════════
export function EntretiensTab({ personId, year, isAdmin }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newType, setNewType] = useState('annuel');
  const [newDate, setNewDate] = useState(ISO_TODAY());
  const [comments, setComments] = useState('');

  const load = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    try {
      const r = await api.listForfaitEntretiens(personId, year);
      setItems(r.entretiens || []);
      setCompliance(r.compliance);
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [personId, year, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    try {
      await api.createForfaitEntretien({
        personId,
        year,
        type: newType,
        heldDate: newDate,
        comments,
        status: 'held',
      });
      toast.success('Entretien enregistré');
      setComments('');
      await load();
    } catch (e) {
      toast.error(e.error || e.message);
    }
  };

  return (
    <div className="forfait-tab">
      <SectionHeader
        title="Entretiens obligatoires"
        subtitle="Art. 5.7.4 : 1 entretien annuel + 2 entretiens semestriels sur la charge de travail"
      />
      {compliance && (
        <InlineAlert variant={compliance.compliant ? 'success' : 'warning'}>
          {compliance.compliant ? (
            <>
              <CheckCircle2 size={14} /> Conformité {year} : 1 annuel + 2 semestriels tenus.
            </>
          ) : (
            <>
              <AlertTriangle size={14} /> Non conforme : manque {compliance.missing.join(', ')}.
            </>
          )}
        </InlineAlert>
      )}

      {isAdmin && (
        <div className="forfait-pose-form">
          <FormField label="Type">
            <Select value={newType} onChange={(e) => setNewType(e.target.value)}>
              <option value="annuel">Annuel</option>
              <option value="semestriel">Semestriel</option>
            </Select>
          </FormField>
          <FormField label="Date tenue">
            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </FormField>
          <FormField label="Commentaires">
            <Input value={comments} onChange={(e) => setComments(e.target.value)} />
          </FormField>
          <div className="forfait-pose-actions">
            <Button variant="primary" onClick={create}>
              <CalendarCheck size={14} /> Enregistrer
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="forfait-empty">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="forfait-empty">Aucun entretien.</div>
      ) : (
        <table className="forfait-poses-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Prévu</th>
              <th>Tenu</th>
              <th>Charge OK</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id}>
                <td>{e.type}</td>
                <td>{e.scheduled_date || '—'}</td>
                <td>{e.held_date || '—'}</td>
                <td>{e.workload_ok === 1 ? '✅' : e.workload_ok === 0 ? '❌' : '—'}</td>
                <td>{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Onglet ALERTES
// ═════════════════════════════════════════════════════════════════
export function AlertesTab({ personId, year, isAdmin }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('charge_travail');

  const load = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    try {
      const r = await api.listForfaitAlerts(personId, { year });
      setItems(r.alerts || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [personId, year, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const declare = async () => {
    if (reason.trim().length < 3) {
      toast.error('Motif trop court');
      return;
    }
    try {
      await api.createForfaitAlert({ personId, category, reason });
      toast.success('Alerte transmise');
      setReason('');
      await load();
    } catch (e) {
      toast.error(e.error || e.message);
    }
  };

  const resolve = async (id) => {
    const response = window.prompt("Réponse / plan d'action :");
    if (response == null) return;
    try {
      await api.resolveForfaitAlert(id, { response });
      toast.success('Alerte clôturée');
      await load();
    } catch (e) {
      toast.error(e.error || e.message);
    }
  };

  return (
    <div className="forfait-tab">
      <SectionHeader
        title="Droit d'alerte / dispositif de veille"
        subtitle="Art. 5.7.5 : le salarié peut signaler une charge excessive ou une atteinte au droit à la déconnexion"
      />

      <div className="forfait-pose-form">
        <FormField label="Catégorie">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="charge_travail">Charge de travail</option>
            <option value="amplitude">Amplitude / repos quotidien</option>
            <option value="repos">Repos hebdomadaire</option>
            <option value="deconnexion">Droit à la déconnexion</option>
            <option value="autre">Autre</option>
          </Select>
        </FormField>
        <FormField label="Motif" style={{ gridColumn: '1 / -1' }}>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Décrivez la situation (min. 3 caractères)"
          />
        </FormField>
        <div className="forfait-pose-actions">
          <Button variant="primary" onClick={declare}>
            <MessageSquareWarning size={14} /> Déclencher l'alerte
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="forfait-empty">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="forfait-empty">Aucune alerte pour {year}.</div>
      ) : (
        <table className="forfait-poses-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Source</th>
              <th>Catégorie</th>
              <th>Motif</th>
              <th>Statut</th>
              {isAdmin && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{a.alert_date}</td>
                <td>{a.source}</td>
                <td>{a.category}</td>
                <td>{a.reason}</td>
                <td>
                  {a.status === 'open' && (
                    <span className="badge-open">
                      <Clock size={12} /> Ouverte
                    </span>
                  )}
                  {a.status === 'resolved' && <span className="badge-ok">Résolue</span>}
                  {a.status === 'closed' && <span className="badge-ok">Clôturée</span>}
                </td>
                {isAdmin && (
                  <td>
                    {a.status === 'open' && (
                      <Button size="sm" variant="secondary" onClick={() => resolve(a.id)}>
                        Traiter
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
