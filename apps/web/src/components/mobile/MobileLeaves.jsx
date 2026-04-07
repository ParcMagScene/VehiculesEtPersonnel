import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ChevronLeft, Plus, Clock, CheckCircle, XCircle, AlertTriangle, 
  Calendar, ChevronDown, FileText, Send, Trash2, Filter, RefreshCw, X
} from 'lucide-react';
import api from '../../utils/api';
import { Button, DetailRow, Textarea, InlineAlert} from '@/design-system';
import { STATUS_CONFIG, LEAVE_TYPE_LABELS } from '../leaves/leaveConstants';
import { ROLES, STATUS } from '../../constants';

import './MobileLeaves.css';

// ─── Composant principal ────────────────────────────────
function MobileLeaves({ currentUser, onBack }) {
  const [view, setView] = useState('list'); // list | form | detail | admin
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | pending | accepted | refused
  const isAdmin = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.MANAGER;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [myLeaves, bal] = await Promise.all([
        api.getMyLeaves().catch(() => []),
        api.getLeaveBalances({ personId: currentUser?.id }).catch(() => []),
      ]);
      setLeaves(Array.isArray(myLeaves) ? myLeaves : []);
      setBalances(Array.isArray(bal) ? bal : []);
      
      if (isAdmin) {
        const [pending, count] = await Promise.all([
          api.getPendingLeaves().catch(() => []),
          api.getPendingLeavesCount().catch(() => ({ count: 0 })),
        ]);
        setPendingLeaves(Array.isArray(pending) ? pending : []);
        setPendingCount(count?.count || 0);
      }
    } catch (e) { console.error('Erreur chargement congés:', e); }
    setLoading(false);
  }, [currentUser, isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLeaveCreated = () => {
    setView('list');
    loadData();
  };

  const handleDecision = async (leaveId, decision, reason = '') => {
    try {
      await api.makeLeaveDecision(leaveId, { decision, reason });
      loadData();
      if (view === 'detail') setView(isAdmin ? 'admin' : 'list');
    } catch (e) { alert('Erreur: ' + (e.message || 'Décision impossible')); }
  };

  const filteredLeaves = leaves.filter(l => {
    if (filter === 'all') return true;
    return l.status === filter;
  }).sort((a, b) => new Date(b.created_at || b.start_date) - new Date(a.created_at || a.start_date));

  if (loading && view === 'list') {
    return (
      <div className="mobile-leaves">
        <div className="mobile-module-header">
          <button className="mobile-back-btn" onClick={onBack}><ChevronLeft size={20} /></button>
          <h2>🏖️ Congés</h2>
        </div>
        <div className="mobile-module-loading">Chargement...</div>
      </div>
    );
  }

  // ─── Vue détail ───
  if (view === 'detail' && selectedLeave) {
    return (
      <div className="mobile-leaves">
        <div className="mobile-module-header">
          <button className="mobile-back-btn" onClick={() => setView('list')}><ChevronLeft size={20} /></button>
          <h2>Détail demande</h2>
        </div>
        <LeaveDetail 
          leave={selectedLeave} 
          isAdmin={isAdmin} 
          onDecision={handleDecision}
          onCancel={async () => {
            try { await api.cancelLeave(selectedLeave.id); loadData(); setView('list'); }
            catch (e) { alert('Erreur annulation'); }
          }}
        />
      </div>
    );
  }

  // ─── Vue formulaire ───
  if (view === 'form') {
    return (
      <div className="mobile-leaves">
        <div className="mobile-module-header">
          <button className="mobile-back-btn" onClick={() => setView('list')}><ChevronLeft size={20} /></button>
          <h2>Nouvelle demande</h2>
        </div>
        <LeaveForm 
          currentUser={currentUser} 
          onCreated={handleLeaveCreated} 
          onCancel={() => setView('list')} 
        />
      </div>
    );
  }

  // ─── Vue admin (validation) ───
  if (view === ROLES.ADMIN && isAdmin) {
    return (
      <div className="mobile-leaves">
        <div className="mobile-module-header">
          <button className="mobile-back-btn" onClick={() => setView('list')}><ChevronLeft size={20} /></button>
          <h2>Validations ({pendingCount})</h2>
        </div>
        <LeaveAdminList 
          pendingLeaves={pendingLeaves} 
          onDecision={handleDecision}
          onSelect={(l) => { setSelectedLeave(l); setView('detail'); }}
          onRefresh={loadData}
        />
      </div>
    );
  }

  // ─── Vue liste principale ───
  return (
    <div className="mobile-leaves">
      <div className="mobile-module-header">
        <button className="mobile-back-btn" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>🏖️ Congés</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {isAdmin && pendingCount > 0 && (
            <button className="ml-admin-btn" onClick={() => setView('admin')}>
              <Clock size={16} />
              <span className="ml-admin-badge">{pendingCount}</span>
            </button>
          )}
          <button className="ml-refresh-btn" onClick={loadData}><RefreshCw size={16} /></button>
        </div>
      </div>

      <div className="ml-content">
        {/* Soldes */}
        <div className="ml-balances">
          <h3>Soldes</h3>
          <div className="ml-balances-grid">
            {balances.length > 0 ? balances.map((b, i) => {
              const typeInfo = LEAVE_TYPE_LABELS[b.leave_type || b.leaveType] || { label: b.leave_type || b.leaveType, icon: '📋', color: '#6b7280' };
              return (
                <div key={i} className="ml-balance-chip" style={{ borderLeftColor: typeInfo.color }}>
                  <span className="ml-balance-icon">{typeInfo.icon}</span>
                  <div className="ml-balance-info">
                    <span className="ml-balance-label">{typeInfo.label}</span>
                    <span className="ml-balance-value">{b.remaining ?? b.balance ?? '—'} j</span>
                  </div>
                </div>
              );
            }) : (
              <p className="ml-empty-text">Aucun solde configuré</p>
            )}
          </div>
        </div>

        {/* Filtres */}
        <div className="ml-filters">
          {['all', 'pending', 'accepted', 'refused'].map(f => (
            <button 
              key={f} 
              className={`ml-filter-btn ${filter === f ? 'active' : ''}`} 
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Toutes' : STATUS_CONFIG[f]?.label || f}
              {f !== 'all' && (
                <span className="ml-filter-count">
                  {leaves.filter(l => l.status === f).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Liste des demandes */}
        <div className="ml-leaves-list">
          {filteredLeaves.length === 0 ? (
            <div className="ml-empty">
              <Calendar size={40} />
              <p>Aucune demande de congé</p>
            </div>
          ) : filteredLeaves.map(leave => (
            <LeaveCard 
              key={leave.id} 
              leave={leave} 
              onClick={() => { setSelectedLeave(leave); setView('detail'); }}
            />
          ))}
        </div>
      </div>

      {/* FAB pour nouvelle demande */}
      <button className="ml-fab" onClick={() => setView('form')}>
        <Plus size={24} />
      </button>
    </div>
  );
}

// ─── Carte de congé ────────────────────────────────
function LeaveCard({ leave, onClick }) {
  const typeInfo = LEAVE_TYPE_LABELS[leave.leave_type || leave.leaveType] || { label: leave.leave_type || 'Congé', icon: '📋', color: '#6b7280' };
  const statusInfo = STATUS_CONFIG[leave.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusInfo.icon;
  
  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const days = leave.working_days || leave.workingDays || '?';

  return (
    <div className="ml-leave-card" onClick={onClick}>
      <div className="ml-leave-type" style={{ background: typeInfo.color + '20', color: typeInfo.color }}>
        <span>{typeInfo.icon}</span>
      </div>
      <div className="ml-leave-info">
        <div className="ml-leave-title">{typeInfo.label}</div>
        <div className="ml-leave-dates">
          {formatDate(leave.start_date || leave.startDate)} → {formatDate(leave.end_date || leave.endDate)}
          <span className="ml-leave-days">{days}j</span>
        </div>
      </div>
      <div className="ml-leave-status" style={{ background: statusInfo.bg, color: statusInfo.color }}>
        <StatusIcon size={14} />
        <span>{statusInfo.label}</span>
      </div>
    </div>
  );
}

// ─── Formulaire de demande ────────────────────────────────
function LeaveForm({ currentUser, onCreated, onCancel }) {
  const [leaveType, setLeaveType] = useState('conge_paye');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startHalf, setStartHalf] = useState('full'); // full | morning | afternoon
  const [endHalf, setEndHalf] = useState('full');
  const [reason, setReason] = useState('');
  const [workingDays, setWorkingDays] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Calculer les jours ouvrés
  useEffect(() => {
    if (!startDate || !endDate) { setWorkingDays(null); return; }
    if (new Date(endDate) < new Date(startDate)) { setWorkingDays(null); return; }
    
    const timer = setTimeout(async () => {
      setCalculating(true);
      try {
        const result = await api.calculateLeaveWorkingDays({
          startDate, endDate, startHalf, endHalf
        });
        setWorkingDays(result.workingDays ?? result.working_days ?? null);
      } catch (e) { setWorkingDays(null); }
      setCalculating(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [startDate, endDate, startHalf, endHalf]);

  const handleSubmit = async () => {
    if (!startDate || !endDate) { setError('Dates obligatoires'); return; }
    if (new Date(endDate) < new Date(startDate)) { setError('Date de fin invalide'); return; }
    
    setSubmitting(true);
    setError('');
    try {
      await api.createLeaveRequest({
        personId: currentUser?.id,
        leaveType,
        startDate,
        endDate,
        startHalf,
        endHalf,
        reason,
        workingDays,
      });
      onCreated();
    } catch (e) {
      setError(e.message || 'Erreur lors de la création');
    }
    setSubmitting(false);
  };

  return (
    <div className="ml-form">
      {error && <InlineAlert>{error}</InlineAlert>}
      
      {/* Type de congé */}
      <div className="ml-form-group">
        <label>Type de congé</label>
        <div className="ml-type-grid">
          {Object.entries(LEAVE_TYPE_LABELS).map(([key, info]) => (
            <button
              key={key}
              className={`ml-type-btn ${leaveType === key ? 'active' : ''}`}
              style={leaveType === key ? { borderColor: info.color, background: info.color + '15' } : {}}
              onClick={() => setLeaveType(key)}
            >
              <span>{info.icon}</span>
              <span>{info.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div className="ml-form-group">
        <label>Date de début</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="ml-input" />
        <div className="ml-half-day">
          {['full', 'morning', 'afternoon'].map(h => (
            <button key={h} className={`ml-half-btn ${startHalf === h ? 'active' : ''}`} onClick={() => setStartHalf(h)}>
              {h === 'full' ? 'Journée' : h === 'morning' ? 'Matin' : 'Après-midi'}
            </button>
          ))}
        </div>
      </div>

      <div className="ml-form-group">
        <label>Date de fin</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="ml-input" />
        <div className="ml-half-day">
          {['full', 'morning', 'afternoon'].map(h => (
            <button key={h} className={`ml-half-btn ${endHalf === h ? 'active' : ''}`} onClick={() => setEndHalf(h)}>
              {h === 'full' ? 'Journée' : h === 'morning' ? 'Matin' : 'Après-midi'}
            </button>
          ))}
        </div>
      </div>

      {/* Jours ouvrés calculés */}
      {(workingDays !== null || calculating) && (
        <div className="ml-working-days">
          <Calendar size={16} />
          {calculating ? 'Calcul...' : `${workingDays} jour${workingDays > 1 ? 's' : ''} ouvré${workingDays > 1 ? 's' : ''}`}
        </div>
      )}

      {/* Motif */}
      <div className="ml-form-group">
        <label>Motif (optionnel)</label>
        <Textarea 
          value={reason} 
          onChange={e => setReason(e.target.value)} 
          placeholder="Précisez le motif de votre demande..."
          className="ml-textarea"
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="ml-form-actions">
        <Button variant="ghost" onClick={onCancel}>Annuler</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={submitting || !startDate || !endDate}>
          {submitting ? 'Envoi...' : <><Send size={16} /> Envoyer</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Détail d'une demande ────────────────────────────────
function LeaveDetail({ leave, isAdmin, onDecision, onCancel }) {
  const typeInfo = LEAVE_TYPE_LABELS[leave.leave_type || leave.leaveType] || { label: 'Congé', icon: '📋', color: '#6b7280' };
  const statusInfo = STATUS_CONFIG[leave.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusInfo.icon;
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="ml-detail">
      <div className="ml-detail-header" style={{ background: typeInfo.color + '15', borderLeftColor: typeInfo.color }}>
        <span className="ml-detail-icon">{typeInfo.icon}</span>
        <div>
          <div className="ml-detail-type">{typeInfo.label}</div>
          <div className="ml-detail-status" style={{ background: statusInfo.bg, color: statusInfo.color }}>
            <StatusIcon size={14} /> {statusInfo.label}
          </div>
        </div>
      </div>

      <div className="ml-detail-body">
        <DetailRow className="ml-detail-row" label="Demandeur" value={leave.person_name || leave.personName || '—'} />
        <DetailRow className="ml-detail-row" label="Du" value={formatDate(leave.start_date || leave.startDate)} />
        <DetailRow className="ml-detail-row" label="Au" value={formatDate(leave.end_date || leave.endDate)} />
        <DetailRow className="ml-detail-row" label="Jours ouvrés">
          {leave.working_days || leave.workingDays || '—'} jour(s)
        </DetailRow>
        {(leave.reason || leave.comment) && (
          <DetailRow className="ml-detail-row" label="Motif" value={leave.reason || leave.comment} />
        )}
        {leave.decision_comment && (
          <DetailRow className="ml-detail-row" label="Commentaire décision" value={leave.decision_comment} />
        )}
      </div>

      {/* Actions admin */}
      {isAdmin && leave.status === STATUS.PENDING && (
        <div className="ml-detail-actions">
          <Button variant="success" onClick={() => onDecision(leave.id, 'accepted')}>
            <CheckCircle size={16} /> Accepter
          </Button>
          <Button variant="danger" onClick={() => setShowReject(!showReject)}>
            <XCircle size={16} /> Refuser
          </Button>
        </div>
      )}

      {showReject && (
        <div className="ml-reject-form">
          <Textarea 
            value={rejectReason} 
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Motif du refus..."
            className="ml-textarea"
            rows={2}
          />
          <Button variant="danger" onClick={() => onDecision(leave.id, 'refused', rejectReason)}>
            Confirmer le refus
          </Button>
        </div>
      )}

      {/* Annulation */}
      {leave.status === STATUS.PENDING && !isAdmin && (
        <div className="ml-detail-actions">
          <Button variant="danger" onClick={onCancel}>
            <Trash2 size={16} /> Annuler ma demande
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Liste admin de validation ────────────────────────────────
function LeaveAdminList({ pendingLeaves, onDecision, onSelect, onRefresh }) {
  if (pendingLeaves.length === 0) {
    return (
      <div className="ml-content">
        <div className="ml-empty">
          <CheckCircle size={40} />
          <p>Aucune demande en attente</p>
          <Button variant="secondary" onClick={onRefresh}><RefreshCw size={16} /> Actualiser</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-content">
      <div className="ml-leaves-list">
        {pendingLeaves.map(leave => {
          const typeInfo = LEAVE_TYPE_LABELS[leave.leave_type || leave.leaveType] || { label: 'Congé', icon: '📋', color: '#6b7280' };
          const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—';
          
          return (
            <div key={leave.id} className="ml-leave-card ml-admin-card">
              <div className="ml-leave-card-top" onClick={() => onSelect(leave)}>
                <div className="ml-leave-type" style={{ background: typeInfo.color + '20', color: typeInfo.color }}>
                  <span>{typeInfo.icon}</span>
                </div>
                <div className="ml-leave-info">
                  <div className="ml-leave-title">{leave.person_name || leave.personName}</div>
                  <div className="ml-leave-subtitle">{typeInfo.label}</div>
                  <div className="ml-leave-dates">
                    {formatDate(leave.start_date || leave.startDate)} → {formatDate(leave.end_date || leave.endDate)}
                    <span className="ml-leave-days">{leave.working_days || leave.workingDays || '?'}j</span>
                  </div>
                </div>
              </div>
              <div className="ml-admin-actions">
                <button className="ml-quick-accept" onClick={() => onDecision(leave.id, 'accepted')}>
                  <CheckCircle size={18} /> Accepter
                </button>
                <button className="ml-quick-reject" onClick={() => onDecision(leave.id, 'refused')}>
                  <XCircle size={18} /> Refuser
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MobileLeaves;
