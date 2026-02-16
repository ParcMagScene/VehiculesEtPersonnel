import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Clock, Check, XCircle, AlertTriangle, User, Plus, Trash2 } from 'lucide-react';
import api from '../utils/api';
import './LeaveRequestModal.css';

const LEAVE_TYPES = [
  { value: 'conge_paye', label: 'Congé payé', icon: '🏖️', color: '#60a5fa' },
  { value: 'rtt', label: 'RTT', icon: '🕐', color: '#a78bfa' },
  { value: 'maladie', label: 'Maladie', icon: '🏥', color: '#f87171' },
  { value: 'sans_solde', label: 'Sans solde', icon: '💤', color: '#fb923c' },
  { value: 'formation', label: 'Formation', icon: '🎓', color: '#8b5cf6' },
  { value: 'entreprise', label: 'Entreprise', icon: '🏢', color: '#3b82f6' },
  { value: 'workshop', label: 'Workshop', icon: '🔧', color: '#f59e0b' },
  { value: 'examen', label: 'Examen', icon: '📝', color: '#10b981' },
  { value: 'rdv', label: 'RDV', icon: '📅', color: '#06b6d4' },
  { value: 'repos', label: 'Jour de repos', icon: '😴', color: '#fbbf24' },
  { value: 'unavailable', label: 'Indisponible', icon: '🚫', color: '#94a3b8' },
  { value: 'autre', label: 'Autre', icon: '📋', color: '#9ca3af' },
];

const STATUS_INFO = {
  pending: { label: 'En attente', icon: Clock, color: '#f59e0b', bg: '#fef3c7' },
  approved: { label: 'Approuvé', icon: Check, color: '#10b981', bg: '#d1fae5' },
  rejected: { label: 'Refusé', icon: XCircle, color: '#ef4444', bg: '#fee2e2' },
};

const LeaveRequestModal = ({
  person,       // personne concernée
  persons = [], // liste des personnes (pour mode admin)
  isAdmin = false,
  onClose,
  onCreated,
  existingRequest = null, // pour édition
}) => {
  const [type, setType] = useState(existingRequest?.type || 'conge_paye');
  const [periods, setPeriods] = useState(
    existingRequest
      ? [{ id: 1, startDate: existingRequest.start_date, endDate: existingRequest.end_date, startPeriod: existingRequest.start_period || 'AM', endPeriod: existingRequest.end_period || 'PM' }]
      : [{ id: 1, startDate: '', endDate: '', startPeriod: 'AM', endPeriod: 'PM' }]
  );
  const [reason, setReason] = useState(existingRequest?.reason || '');
  const [selectedPersonId, setSelectedPersonId] = useState(person?.id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nextPeriodId, setNextPeriodId] = useState(2);

  const updatePeriod = (id, field, value) => {
    setPeriods(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addPeriod = () => {
    setPeriods(prev => [...prev, { id: nextPeriodId, startDate: '', endDate: '', startPeriod: 'AM', endPeriod: 'PM' }]);
    setNextPeriodId(n => n + 1);
  };

  const removePeriod = (id) => {
    if (periods.length <= 1) return;
    setPeriods(prev => prev.filter(p => p.id !== id));
  };

  // Calculer nombre de jours pour une période
  const calcDays = (startDate, endDate, startPeriod, endPeriod) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;
    let count = 0;
    const d = new Date(start);
    while (d <= end) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    if (startPeriod === 'PM' && count > 0) count -= 0.5;
    if (endPeriod === 'AM' && count > 0) count -= 0.5;
    return Math.max(0, count);
  };

  // Total de jours toutes périodes
  const totalDays = useMemo(() => {
    return periods.reduce((sum, p) => sum + calcDays(p.startDate, p.endDate, p.startPeriod, p.endPeriod), 0);
  }, [periods]);

  const handleSubmit = async () => {
    const validPeriods = periods.filter(p => p.startDate && p.endDate);
    if (!selectedPersonId || validPeriods.length === 0) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    for (const p of validPeriods) {
      if (new Date(p.endDate) < new Date(p.startDate)) {
        setError('La date de fin doit être après la date de début');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      if (existingRequest) {
        // Mode édition : une seule période
        const p = validPeriods[0];
        await api.updateAvailability(existingRequest.id, {
          person_id: selectedPersonId,
          start_date: p.startDate,
          end_date: p.endDate,
          start_period: p.startPeriod,
          end_period: p.endPeriod,
          type,
          reason: reason || null,
          source: isAdmin ? 'admin' : 'request',
        });
      } else {
        // Mode création : créer chaque période
        for (const p of validPeriods) {
          await api.createAvailability({
            person_id: selectedPersonId,
            start_date: p.startDate,
            end_date: p.endDate,
            start_period: p.startPeriod,
            end_period: p.endPeriod,
            type,
            reason: reason || null,
            source: isAdmin ? 'admin' : 'request',
          });
        }
      }
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const typeInfo = LEAVE_TYPES.find(t => t.value === type) || LEAVE_TYPES[0];

  return (
    <div className="leave-modal-overlay" onClick={onClose}>
      <div className="leave-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="leave-modal-header" style={{ borderBottomColor: typeInfo.color + '40' }}>
          <div className="leave-modal-title">
            <span className="leave-modal-icon">{typeInfo.icon}</span>
            <span>{existingRequest ? 'Modifier l\'absence' : isAdmin ? 'Ajouter une absence' : 'Demande de congé'}</span>
          </div>
          <button className="leave-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="leave-modal-body">
          {error && (
            <div className="leave-modal-error">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* Sélection de la personne (mode admin) */}
          {isAdmin && !person && (
            <div className="leave-field">
              <label><User size={13} /> Personnel</label>
              <select value={selectedPersonId} onChange={e => setSelectedPersonId(Number(e.target.value))}>
                <option value="">Sélectionner...</option>
                {persons.filter(p => p.isActive !== false).map(p => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Type de congé */}
          <div className="leave-field">
            <label>Type d'absence</label>
            <div className="leave-type-grid">
              {LEAVE_TYPES.map(lt => (
                <button
                  key={lt.value}
                  className={`leave-type-btn${type === lt.value ? ' active' : ''}`}
                  style={{ '--lt-color': lt.color }}
                  onClick={() => setType(lt.value)}
                >
                  <span className="leave-type-icon">{lt.icon}</span>
                  <span className="leave-type-label">{lt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Périodes (multi-sélection) */}
          <div className="leave-periods-section">
            <div className="leave-periods-header">
              <label><Calendar size={13} /> Période{periods.length > 1 ? 's' : ''}</label>
              {!existingRequest && (
                <button type="button" className="leave-add-period-btn" onClick={addPeriod}>
                  <Plus size={13} /> Ajouter une période
                </button>
              )}
            </div>
            {periods.map((p, idx) => {
              const days = calcDays(p.startDate, p.endDate, p.startPeriod, p.endPeriod);
              return (
                <div key={p.id} className="leave-period-card">
                  {periods.length > 1 && (
                    <div className="leave-period-card-header">
                      <span className="leave-period-num">Période {idx + 1}</span>
                      <button type="button" className="leave-period-remove" onClick={() => removePeriod(p.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                  <div className="leave-dates-row">
                    <div className="leave-field">
                      <label><Calendar size={13} /> Début</label>
                      <input type="date" value={p.startDate} onChange={e => updatePeriod(p.id, 'startDate', e.target.value)} />
                      <div className="leave-period-toggle">
                        <button className={p.startPeriod === 'AM' ? 'active' : ''} onClick={() => updatePeriod(p.id, 'startPeriod', 'AM')}>Matin</button>
                        <button className={p.startPeriod === 'PM' ? 'active' : ''} onClick={() => updatePeriod(p.id, 'startPeriod', 'PM')}>Après-midi</button>
                      </div>
                    </div>
                    <div className="leave-field">
                      <label><Calendar size={13} /> Fin</label>
                      <input type="date" value={p.endDate} onChange={e => updatePeriod(p.id, 'endDate', e.target.value)} min={p.startDate} />
                      <div className="leave-period-toggle">
                        <button className={p.endPeriod === 'AM' ? 'active' : ''} onClick={() => updatePeriod(p.id, 'endPeriod', 'AM')}>Matin</button>
                        <button className={p.endPeriod === 'PM' ? 'active' : ''} onClick={() => updatePeriod(p.id, 'endPeriod', 'PM')}>Après-midi</button>
                      </div>
                    </div>
                  </div>
                  {days > 0 && (
                    <div className="leave-day-count leave-day-count-inline" style={{ color: typeInfo.color }}>
                      <Clock size={13} />
                      <span>{days} jour{days > 1 ? 's' : ''} ouvré{days > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Total de jours (si multi-périodes) */}
          {periods.length > 1 && totalDays > 0 && (
            <div className="leave-day-count leave-total-days" style={{ color: typeInfo.color }}>
              <Clock size={14} />
              <span><strong>Total : {totalDays} jour{totalDays > 1 ? 's' : ''} ouvré{totalDays > 1 ? 's' : ''}</strong></span>
            </div>
          )}

          {/* Motif */}
          <div className="leave-field">
            <label>Motif {!isAdmin && <span className="leave-optional">(optionnel)</span>}</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Précisez le motif de l'absence..."
              rows={2}
            />
          </div>

          {!isAdmin && (
            <div className="leave-notice">
              <AlertTriangle size={13} />
              <span>La demande sera soumise à validation par un administrateur.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="leave-modal-footer">
          <button className="leave-btn-cancel" onClick={onClose}>Annuler</button>
          <button
            className="leave-btn-submit"
            onClick={handleSubmit}
            disabled={saving || periods.every(p => !p.startDate || !p.endDate) || (!person && !selectedPersonId)}
            style={{ backgroundColor: typeInfo.color }}
          >
            {saving ? 'Enregistrement...' : isAdmin
              ? (periods.filter(p => p.startDate && p.endDate).length > 1
                ? `Ajouter ${periods.filter(p => p.startDate && p.endDate).length} périodes`
                : 'Ajouter')
              : 'Envoyer la demande'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════
   Panneau d'approbation des congés (admin) — avec système de vote
   ═══════════════════════════════════════ */
const LeaveApprovalPanel = ({ onClose, onUpdated }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [votesData, setVotesData] = useState({}); // { [reqId]: { votes, approveCount, rejectCount, threshold, adminCount } }
  const [voteComment, setVoteComment] = useState('');

  const loadRequests = async () => {
    try {
      const data = await api.getAvailabilities({ status: 'pending' });
      setRequests(data);
      // Charger les votes pour chaque demande
      const votesMap = {};
      for (const req of data) {
        try {
          const vd = await api.get(`/api/leave-requests/${req.id}/votes`);
          votesMap[req.id] = vd.data || vd;
        } catch { /* ignore */ }
      }
      setVotesData(votesMap);
    } catch (err) {
      console.error('Erreur chargement demandes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRequests(); }, []);

  // Vote (approve/reject) au lieu d'approbation directe
  const handleVote = async (id, vote) => {
    try {
      const result = await api.post(`/api/leave-requests/${id}/vote`, {
        vote,
        comment: (vote === 'reject' && rejectId === id) ? rejectReason : (voteComment || undefined),
      });
      const voteResult = result.data || result;
      setVotesData(prev => ({ ...prev, [id]: voteResult }));

      // Si la demande a été automatiquement approuvée/rejetée par le vote
      if (voteResult.finalStatus === 'approved' || voteResult.finalStatus === 'rejected') {
        setRequests(prev => prev.filter(r => r.id !== id));
        onUpdated?.();
      }
      setRejectId(null);
      setRejectReason('');
      setVoteComment('');
    } catch (err) {
      console.error('Erreur vote:', err);
    }
  };

  // Garder les anciennes fonctions pour compatibilité (approbation directe admin)
  const handleApprove = async (id) => {
    try {
      await api.approveLeaveRequest(id);
      setRequests(prev => prev.filter(r => r.id !== id));
      onUpdated?.();
    } catch (err) {
      console.error('Erreur approbation:', err);
    }
  };

  const handleReject = async (id) => {
    try {
      await api.rejectLeaveRequest(id, rejectReason);
      setRequests(prev => prev.filter(r => r.id !== id));
      setRejectId(null);
      setRejectReason('');
      onUpdated?.();
    } catch (err) {
      console.error('Erreur refus:', err);
    }
  };

  const getTypeInfo = (type) => LEAVE_TYPES.find(t => t.value === type) || LEAVE_TYPES[LEAVE_TYPES.length - 1];

  // Types nécessitant un vote
  const APPROVAL_TYPES = ['conge_paye', 'rtt', 'maladie', 'sans_solde'];

  return (
    <div className="leave-approval-panel">
      <div className="leave-approval-header">
        <h3>📋 Demandes de congés</h3>
        <button className="leave-modal-close" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="leave-approval-body">
        {loading ? (
          <div className="leave-approval-empty">Chargement...</div>
        ) : requests.length === 0 ? (
          <div className="leave-approval-empty">
            <Check size={24} />
            <p>Aucune demande en attente</p>
          </div>
        ) : (
          requests.map(req => {
            const ti = getTypeInfo(req.type);
            const start = req.start_date || req.startDate;
            const end = req.end_date || req.endDate;
            const vd = votesData[req.id];
            const needsVoting = APPROVAL_TYPES.includes(req.type);

            return (
              <div key={req.id} className="leave-request-card" style={{ '--lr-color': ti.color }}>
                <div className="lr-header">
                  <span className="lr-person">
                    {req.first_name || req.firstName} {req.last_name || req.lastName}
                  </span>
                  <span className="lr-type-badge" style={{ backgroundColor: ti.color + '20', color: ti.color }}>
                    {ti.icon} {ti.label}
                  </span>
                </div>
                <div className="lr-dates">
                  <Calendar size={12} />
                  <span>{new Date(start).toLocaleDateString('fr-FR')} → {new Date(end).toLocaleDateString('fr-FR')}</span>
                  <span className="lr-period">({req.start_period || 'AM'} — {req.end_period || 'PM'})</span>
                </div>
                {req.reason && <div className="lr-reason">{req.reason}</div>}

                {/* Système de vote pour les congés */}
                {needsVoting && vd && (
                  <div className="lr-votes-section">
                    <div className="lr-votes-bar">
                      <div className="lr-votes-progress">
                        <div className="lr-votes-approve-bar" style={{
                          width: `${vd.adminCount > 0 ? (vd.approveCount / vd.adminCount * 100) : 0}%`
                        }} />
                        <div className="lr-votes-reject-bar" style={{
                          width: `${vd.adminCount > 0 ? (vd.rejectCount / vd.adminCount * 100) : 0}%`
                        }} />
                      </div>
                      <span className="lr-votes-count">
                        ✅ {vd.approveCount} / ❌ {vd.rejectCount} — Seuil : {vd.threshold}
                      </span>
                    </div>
                    {vd.votes && vd.votes.length > 0 && (
                      <div className="lr-votes-list">
                        {vd.votes.map(v => (
                          <div key={v.id} className={`lr-vote-chip ${v.vote}`}>
                            <span>{v.vote === 'approve' ? '✅' : '❌'}</span>
                            <span>{v.voterName || v.voter_name}</span>
                            {v.comment && <em>({v.comment})</em>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {rejectId === req.id ? (
                  <div className="lr-reject-form">
                    <input
                      type="text"
                      placeholder="Commentaire (optionnel)..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      autoFocus
                    />
                    <div className="lr-reject-actions">
                      <button className="lr-btn lr-btn-cancel" onClick={() => { setRejectId(null); setRejectReason(''); }}>Annuler</button>
                      {needsVoting ? (
                        <button className="lr-btn lr-btn-reject" onClick={() => handleVote(req.id, 'reject')}>Voter Contre</button>
                      ) : (
                        <button className="lr-btn lr-btn-reject" onClick={() => handleReject(req.id)}>Confirmer le refus</button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="lr-actions">
                    {needsVoting ? (
                      <>
                        <button className="lr-btn lr-btn-approve" onClick={() => handleVote(req.id, 'approve')}>
                          <Check size={14} /> Voter Pour
                        </button>
                        <button className="lr-btn lr-btn-reject" onClick={() => setRejectId(req.id)}>
                          <XCircle size={14} /> Voter Contre
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="lr-btn lr-btn-approve" onClick={() => handleApprove(req.id)}>
                          <Check size={14} /> Approuver
                        </button>
                        <button className="lr-btn lr-btn-reject" onClick={() => setRejectId(req.id)}>
                          <XCircle size={14} /> Refuser
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export { LeaveRequestModal, LeaveApprovalPanel, LEAVE_TYPES, STATUS_INFO };
export default LeaveRequestModal;
