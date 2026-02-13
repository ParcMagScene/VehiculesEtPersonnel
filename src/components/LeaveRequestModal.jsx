import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Clock, Check, XCircle, AlertTriangle, User } from 'lucide-react';
import api from '../utils/api';
import './LeaveRequestModal.css';

const LEAVE_TYPES = [
  { value: 'conge_paye', label: 'Congé payé', icon: '🏖️', color: '#60a5fa' },
  { value: 'rtt', label: 'RTT', icon: '🕐', color: '#a78bfa' },
  { value: 'maladie', label: 'Maladie', icon: '🏥', color: '#f87171' },
  { value: 'sans_solde', label: 'Sans solde', icon: '💤', color: '#fb923c' },
  { value: 'formation', label: 'Formation', icon: '📚', color: '#34d399' },
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
  const [startDate, setStartDate] = useState(existingRequest?.start_date || '');
  const [endDate, setEndDate] = useState(existingRequest?.end_date || '');
  const [startPeriod, setStartPeriod] = useState(existingRequest?.start_period || 'AM');
  const [endPeriod, setEndPeriod] = useState(existingRequest?.end_period || 'PM');
  const [reason, setReason] = useState(existingRequest?.reason || '');
  const [selectedPersonId, setSelectedPersonId] = useState(person?.id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Calculer nombre de jours
  const dayCount = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;
    let count = 0;
    const d = new Date(start);
    while (d <= end) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) count++; // jours ouvrés
      d.setDate(d.getDate() + 1);
    }
    // Ajuster demi-journées
    if (startPeriod === 'PM' && count > 0) count -= 0.5;
    if (endPeriod === 'AM' && count > 0) count -= 0.5;
    return Math.max(0, count);
  }, [startDate, endDate, startPeriod, endPeriod]);

  const handleSubmit = async () => {
    if (!selectedPersonId || !startDate || !endDate) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('La date de fin doit être après la date de début');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const data = {
        person_id: selectedPersonId,
        start_date: startDate,
        end_date: endDate,
        start_period: startPeriod,
        end_period: endPeriod,
        type,
        reason: reason || null,
        source: isAdmin ? 'admin' : 'request',
      };

      if (existingRequest) {
        await api.updateAvailability(existingRequest.id, data);
      } else {
        await api.createAvailability(data);
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

          {/* Dates */}
          <div className="leave-dates-row">
            <div className="leave-field">
              <label><Calendar size={13} /> Début</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <div className="leave-period-toggle">
                <button className={startPeriod === 'AM' ? 'active' : ''} onClick={() => setStartPeriod('AM')}>Matin</button>
                <button className={startPeriod === 'PM' ? 'active' : ''} onClick={() => setStartPeriod('PM')}>Après-midi</button>
              </div>
            </div>
            <div className="leave-field">
              <label><Calendar size={13} /> Fin</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} />
              <div className="leave-period-toggle">
                <button className={endPeriod === 'AM' ? 'active' : ''} onClick={() => setEndPeriod('AM')}>Matin</button>
                <button className={endPeriod === 'PM' ? 'active' : ''} onClick={() => setEndPeriod('PM')}>Après-midi</button>
              </div>
            </div>
          </div>

          {/* Compteur de jours */}
          {dayCount > 0 && (
            <div className="leave-day-count" style={{ color: typeInfo.color }}>
              <Clock size={14} />
              <span>{dayCount} jour{dayCount > 1 ? 's' : ''} ouvré{dayCount > 1 ? 's' : ''}</span>
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
            disabled={saving || !startDate || !endDate || (!person && !selectedPersonId)}
            style={{ backgroundColor: typeInfo.color }}
          >
            {saving ? 'Enregistrement...' : isAdmin ? 'Ajouter' : 'Envoyer la demande'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════
   Panneau d'approbation des congés (admin)
   ═══════════════════════════════════════ */
const LeaveApprovalPanel = ({ onClose, onUpdated }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadRequests = async () => {
    try {
      const data = await api.getAvailabilities({ status: 'pending' });
      setRequests(data);
    } catch (err) {
      console.error('Erreur chargement demandes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRequests(); }, []);

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

  const getTypeInfo = (type) => LEAVE_TYPES.find(t => t.value === type) || LEAVE_TYPES[7];

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

                {rejectId === req.id ? (
                  <div className="lr-reject-form">
                    <input
                      type="text"
                      placeholder="Motif du refus (optionnel)..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      autoFocus
                    />
                    <div className="lr-reject-actions">
                      <button className="lr-btn lr-btn-cancel" onClick={() => { setRejectId(null); setRejectReason(''); }}>Annuler</button>
                      <button className="lr-btn lr-btn-reject" onClick={() => handleReject(req.id)}>Confirmer le refus</button>
                    </div>
                  </div>
                ) : (
                  <div className="lr-actions">
                    <button className="lr-btn lr-btn-approve" onClick={() => handleApprove(req.id)}>
                      <Check size={14} /> Approuver
                    </button>
                    <button className="lr-btn lr-btn-reject" onClick={() => setRejectId(req.id)}>
                      <XCircle size={14} /> Refuser
                    </button>
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
