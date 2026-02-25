// ═══════════════════════════════════════════════════════════════
// ONGLET CONGÉS & ABSENCES — Module complet
// Vue salarié: solde + historique + nouvelle demande
// Vue admin: validations en attente + team overview + stats + soldes
// Conforme Code du travail, IDCC 3252, Politique Mag Scène
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar, Clock, CheckCircle, XCircle, AlertTriangle,
  Plus, Download, RefreshCw, Users, BarChart3,
  ChevronDown, Trash2, Send, FileText, Shield,
  CalendarOff, Filter, Eye, TrendingUp,
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWeekend } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../utils/api';
import { STATUS_CONFIG, LEAVE_TYPE_LABELS } from './leaveConstants';
import LeaveRequestForm from './LeaveRequestForm';
import LeaveRequestsPanel from './LeaveRequestsPanel';
import LeaveValidationPanel from './LeaveValidationPanel';
import './LeavesTab.css';

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

const fmtDate = (d) => {
  if (!d) return '—';
  try { return format(parseISO(d), 'd MMM yyyy', { locale: fr }); }
  catch { return d; }
};

const fmtShortDate = (d) => {
  if (!d) return '—';
  try { return format(parseISO(d), 'd MMM', { locale: fr }); }
  catch { return d; }
};

// ═══════════════════════════════════════
// Composant principal
// ═══════════════════════════════════════

const LeavesTab = ({ persons = [], currentUser }) => {
  const isAdmin = !!currentUser?.isAdmin;

  // Data state
  const [myRequests, setMyRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [myBalance, setMyBalance] = useState(null);
  const [stats, setStats] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI state
  const [adminView, setAdminView] = useState(isAdmin ? 'overview' : 'mine');
  const [requestFilter, setRequestFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  // Modal state
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(null); // { personId }

  // ═══════════════════════════════════════
  // Chargement des données
  // ═══════════════════════════════════════

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const promises = [
        api.getMyLeaves().catch(() => []),
        api.getPublicHolidays(new Date().getFullYear()).catch(() => []),
      ];

      if (isAdmin) {
        promises.push(
          api.getPendingLeaves().catch(() => []),
          api.getAllLeaves().catch(() => []),
          api.getLeaveBalances({ year: new Date().getFullYear() }).catch(() => []),
          api.getLeaveStats(new Date().getFullYear()).catch(() => null),
        );
      }

      const results = await Promise.all(promises);
      setMyRequests(results[0] || []);
      setHolidays(results[1] || []);

      if (isAdmin) {
        setPendingRequests(results[2] || []);
        setAllRequests(results[3] || []);
        const balancesData = results[4];
        setBalances(Array.isArray(balancesData) ? balancesData : []);
        setStats(results[5]);
      }

      // Charger le solde perso
      if (currentUser?.personId) {
        try {
          const bal = await api.getLeaveBalances({
            personId: currentUser.personId,
            year: new Date().getFullYear(),
          });
          setMyBalance(Array.isArray(bal) ? bal[0] : bal);
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error('[LeavesTab] Erreur chargement:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ═══════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════

  const myStats = useMemo(() => ({
    total: myRequests.length,
    pending: myRequests.filter(r => r.status === 'pending').length,
    accepted: myRequests.filter(r => r.status === 'accepted' || r.status === 'modified').length,
    refused: myRequests.filter(r => r.status === 'refused').length,
  }), [myRequests]);

  const filteredRequests = useMemo(() => {
    const source = adminView === 'all' ? allRequests : myRequests;
    if (requestFilter === 'all') return source;
    return source.filter(r => r.status === requestFilter);
  }, [adminView, allRequests, myRequests, requestFilter]);

  // Qui est en congé ce mois-ci ? (admin)
  const teamCalendar = useMemo(() => {
    if (!isAdmin || !allRequests.length) return [];
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    return allRequests
      .filter(r => {
        if (r.status !== 'accepted' && r.status !== 'modified') return false;
        const start = parseISO(r.start_date || r.startDate);
        const end = parseISO(r.end_date || r.endDate);
        return start <= monthEnd && end >= monthStart;
      })
      .sort((a, b) => (a.start_date || a.startDate).localeCompare(b.start_date || b.startDate));
  }, [isAdmin, allRequests]);

  // ═══════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════

  const handleCancel = async (id) => {
    try {
      await api.cancelLeave(id);
      setCancellingId(null);
      loadData();
    } catch (err) {
      setError(err.error || err.message || 'Erreur lors de l\'annulation');
    }
  };

  const handleDownloadPdf = async (id) => {
    try {
      const data = await api.getLeavePdf(id);
      if (data.html) {
        const win = window.open('', '_blank');
        win.document.write(data.html);
        win.document.close();
        setTimeout(() => win.print(), 500);
      }
    } catch {
      setError('Erreur génération PDF');
    }
  };

  // ═══════════════════════════════════════
  // Render
  // ═══════════════════════════════════════

  if (loading) {
    return (
      <div className="lt-loading">
        <Clock size={24} />
        <span>Chargement du module congés…</span>
      </div>
    );
  }

  return (
    <div className="lt-container">
      {/* En-tête */}
      <div className="lt-header">
        <div className="lt-header-left">
          <CalendarOff size={20} />
          <h2>Congés & Absences</h2>
          {isAdmin && pendingRequests.length > 0 && (
            <span className="lt-pending-badge">{pendingRequests.length}</span>
          )}
        </div>
        <div className="lt-header-actions">
          <button className="lt-btn lt-btn-refresh" onClick={loadData} title="Rafraîchir">
            <RefreshCw size={16} />
          </button>
          <button className="lt-btn lt-btn-primary" onClick={() => setShowRequestForm(true)}>
            <Plus size={16} /> Nouvelle demande
          </button>
        </div>
      </div>

      {error && (
        <div className="lt-error">
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="lt-kpi-row">
        {/* Solde personnel */}
        <div className="lt-kpi-card balance">
          <div className="lt-kpi-icon">🏖️</div>
          <div className="lt-kpi-data">
            <span className="lt-kpi-value">
              {myBalance
                ? ((myBalance.daysEntitled || myBalance.days_entitled || 25) - (myBalance.daysTaken || myBalance.days_taken || 0))
                : '—'}
            </span>
            <span className="lt-kpi-label">jours restants</span>
          </div>
          {myBalance && (
            <div className="lt-kpi-detail">
              {myBalance.daysEntitled || myBalance.days_entitled || 25} acquis · {myBalance.daysTaken || myBalance.days_taken || 0} pris
            </div>
          )}
        </div>

        {/* En attente */}
        <div className="lt-kpi-card pending">
          <div className="lt-kpi-icon"><Clock size={20} /></div>
          <div className="lt-kpi-data">
            <span className="lt-kpi-value">{myStats.pending}</span>
            <span className="lt-kpi-label">en attente</span>
          </div>
        </div>

        {/* Acceptées */}
        <div className="lt-kpi-card accepted">
          <div className="lt-kpi-icon"><CheckCircle size={20} /></div>
          <div className="lt-kpi-data">
            <span className="lt-kpi-value">{myStats.accepted}</span>
            <span className="lt-kpi-label">acceptées</span>
          </div>
        </div>

        {/* Admin : En attente de validation */}
        {isAdmin && (
          <div
            className="lt-kpi-card admin-pending clickable"
            onClick={() => setShowValidationPanel(true)}
          >
            <div className="lt-kpi-icon"><Shield size={20} /></div>
            <div className="lt-kpi-data">
              <span className="lt-kpi-value">{pendingRequests.length}</span>
              <span className="lt-kpi-label">à valider</span>
            </div>
            <div className="lt-kpi-action">
              <Eye size={14} /> Traiter
            </div>
          </div>
        )}
      </div>

      {/* Navigation admin */}
      {isAdmin && (
        <div className="lt-admin-nav">
          <button
            className={`lt-nav-btn ${adminView === 'overview' ? 'active' : ''}`}
            onClick={() => setAdminView('overview')}
          >
            <BarChart3 size={14} /> Vue d'ensemble
          </button>
          <button
            className={`lt-nav-btn ${adminView === 'mine' ? 'active' : ''}`}
            onClick={() => setAdminView('mine')}
          >
            <Calendar size={14} /> Mes congés
          </button>
          <button
            className={`lt-nav-btn ${adminView === 'all' ? 'active' : ''}`}
            onClick={() => setAdminView('all')}
          >
            <Users size={14} /> Toutes les demandes
          </button>
        </div>
      )}

      {/* ═══ Vue Admin: Overview ═══ */}
      {isAdmin && adminView === 'overview' && (
        <div className="lt-overview">
          {/* Demandes en attente de validation */}
          {pendingRequests.length > 0 && (
            <div className="lt-section">
              <div className="lt-section-header">
                <h3><Clock size={16} /> Demandes en attente ({pendingRequests.length})</h3>
                <button className="lt-btn lt-btn-sm" onClick={() => setShowValidationPanel(true)}>
                  Ouvrir panneau complet
                </button>
              </div>
              <div className="lt-pending-list">
                {pendingRequests.slice(0, 5).map(req => {
                  const typeCfg = LEAVE_TYPE_LABELS[req.leave_type || req.leaveType] || LEAVE_TYPE_LABELS.conge_paye;
                  return (
                    <div key={req.id} className="lt-pending-card">
                      <div className="lt-pending-person">
                        {req.first_name || req.firstName} {req.last_name || req.lastName}
                      </div>
                      <div className="lt-pending-info">
                        <span className="lt-pending-type" style={{ color: typeCfg.color }}>
                          {typeCfg.icon} {typeCfg.label}
                        </span>
                        <span className="lt-pending-dates">
                          {fmtShortDate(req.start_date || req.startDate)} → {fmtShortDate(req.end_date || req.endDate)}
                        </span>
                        <span className="lt-pending-days">
                          {req.working_days || req.workingDays}j
                        </span>
                      </div>
                      {req.priority_score > 0 && (
                        <span className="lt-priority-badge" title="Priorité">P{req.priority_score}</span>
                      )}
                    </div>
                  );
                })}
                {pendingRequests.length > 5 && (
                  <button className="lt-btn lt-btn-link" onClick={() => setShowValidationPanel(true)}>
                    Voir les {pendingRequests.length - 5} autres…
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Absences du mois */}
          <div className="lt-section">
            <div className="lt-section-header">
              <h3><Calendar size={16} /> Absences du mois — {format(new Date(), 'MMMM yyyy', { locale: fr })}</h3>
            </div>
            {teamCalendar.length === 0 ? (
              <div className="lt-empty-section">
                <CheckCircle size={16} />
                <span>Aucune absence prévue ce mois-ci</span>
              </div>
            ) : (
              <div className="lt-team-calendar">
                {teamCalendar.map(req => {
                  const typeCfg = LEAVE_TYPE_LABELS[req.leave_type || req.leaveType] || LEAVE_TYPE_LABELS.conge_paye;
                  return (
                    <div key={req.id} className="lt-team-row">
                      <div className="lt-team-person">
                        {req.first_name || req.firstName} {req.last_name || req.lastName}
                      </div>
                      <div className="lt-team-type" style={{ color: typeCfg.color }}>
                        {typeCfg.icon} {typeCfg.label}
                      </div>
                      <div className="lt-team-dates">
                        {fmtShortDate(req.start_date || req.startDate)} → {fmtShortDate(req.end_date || req.endDate)}
                      </div>
                      <div className="lt-team-days">
                        {req.working_days || req.workingDays} jour{(req.working_days || req.workingDays) > 1 ? 's' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Statistiques */}
          {stats && (
            <div className="lt-section">
              <div className="lt-section-header">
                <h3><TrendingUp size={16} /> Statistiques {new Date().getFullYear()}</h3>
              </div>
              <div className="lt-stats-grid">
                {stats.byType && Object.entries(stats.byType).map(([type, count]) => {
                  const cfg = LEAVE_TYPE_LABELS[type] || { label: type, icon: '📋', color: '#6b7280' };
                  return (
                    <div key={type} className="lt-stat-card">
                      <span className="lt-stat-icon">{cfg.icon}</span>
                      <span className="lt-stat-count">{count}</span>
                      <span className="lt-stat-label">{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
              {stats.byMonth && (
                <div className="lt-stats-months">
                  <div className="lt-month-chart">
                    {Object.entries(stats.byMonth).map(([month, count]) => {
                      const maxCount = Math.max(...Object.values(stats.byMonth), 1);
                      const height = (count / maxCount * 100);
                      return (
                        <div key={month} className="lt-month-bar" title={`${month}: ${count} demande${count > 1 ? 's' : ''}`}>
                          <div className="lt-month-bar-fill" style={{ height: `${height}%` }} />
                          <span className="lt-month-label">{month.slice(0, 3)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Soldes de l'équipe */}
          {balances.length > 0 && (
            <div className="lt-section">
              <div className="lt-section-header">
                <h3><Users size={16} /> Soldes de l'équipe</h3>
              </div>
              <div className="lt-balances-table">
                <div className="lt-balances-header">
                  <span>Collaborateur</span>
                  <span>Acquis</span>
                  <span>Pris</span>
                  <span>Restant</span>
                </div>
                {balances.map((b, i) => {
                  const entitled = b.daysEntitled || b.days_entitled || 25;
                  const taken = b.daysTaken || b.days_taken || 0;
                  const remaining = entitled - taken;
                  const person = persons.find(p => p.id === (b.personId || b.person_id));
                  return (
                    <div key={i} className={`lt-balances-row ${remaining <= 5 ? 'low' : ''}`}>
                      <span className="lt-balance-name">
                        {person ? `${person.firstName} ${person.lastName}` : `#${b.personId || b.person_id}`}
                      </span>
                      <span className="lt-balance-num">{entitled}</span>
                      <span className="lt-balance-num">{taken}</span>
                      <span className={`lt-balance-num remaining ${remaining <= 5 ? 'warning' : ''}`}>
                        {remaining}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Vue Mes congés / Toutes les demandes ═══ */}
      {(adminView === 'mine' || adminView === 'all' || !isAdmin) && (
        <div className="lt-requests">
          {/* Filtres */}
          <div className="lt-filters">
            <button
              className={`lt-filter-btn ${requestFilter === 'all' ? 'active' : ''}`}
              onClick={() => setRequestFilter('all')}
            >
              Toutes ({adminView === 'all' ? allRequests.length : myRequests.length})
            </button>
            <button
              className={`lt-filter-btn pending ${requestFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setRequestFilter('pending')}
            >
              <Clock size={12} /> En attente
            </button>
            <button
              className={`lt-filter-btn accepted ${requestFilter === 'accepted' ? 'active' : ''}`}
              onClick={() => setRequestFilter('accepted')}
            >
              <CheckCircle size={12} /> Acceptées
            </button>
            <button
              className={`lt-filter-btn refused ${requestFilter === 'refused' ? 'active' : ''}`}
              onClick={() => setRequestFilter('refused')}
            >
              <XCircle size={12} /> Refusées
            </button>
          </div>

          {/* Liste */}
          {filteredRequests.length === 0 ? (
            <div className="lt-empty">
              <CalendarOff size={32} />
              <p>{adminView === 'mine' ? 'Aucune demande de congé' : 'Aucune demande'}</p>
              <button className="lt-btn lt-btn-primary" onClick={() => setShowRequestForm(true)}>
                <Plus size={16} /> Faire une demande
              </button>
            </div>
          ) : (
            <div className="lt-request-list">
              {filteredRequests.map(req => {
                const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                const typeCfg = LEAVE_TYPE_LABELS[req.leave_type || req.leaveType] || LEAVE_TYPE_LABELS.conge_paye;
                const isExpanded = expandedId === req.id;

                return (
                  <div
                    key={req.id}
                    className={`lt-request-card ${req.status}`}
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  >
                    <div className="lt-card-main">
                      <div className="lt-card-left">
                        <span className="lt-card-type" style={{ color: typeCfg.color }}>
                          {typeCfg.icon} {typeCfg.label}
                        </span>
                        {adminView === 'all' && (
                          <span className="lt-card-person">
                            {req.first_name || req.firstName} {req.last_name || req.lastName}
                          </span>
                        )}
                      </div>
                      <div className="lt-card-center">
                        <Calendar size={12} />
                        <span>{fmtDate(req.start_date || req.startDate)} → {fmtDate(req.end_date || req.endDate)}</span>
                        <span className="lt-card-days">
                          {req.working_days || req.workingDays} j
                        </span>
                      </div>
                      <div className="lt-card-right">
                        <span
                          className="lt-card-status"
                          style={{ background: statusCfg.bg, color: statusCfg.color }}
                        >
                          <StatusIcon size={12} />
                          {statusCfg.label}
                        </span>
                        <ChevronDown
                          size={14}
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                        />
                      </div>
                    </div>

                    {/* Détails */}
                    {isExpanded && (
                      <div className="lt-card-details" onClick={e => e.stopPropagation()}>
                        {req.employee_comment && (
                          <div className="lt-detail-row">
                            <span className="lt-detail-label">Commentaire :</span>
                            <span>{req.employee_comment}</span>
                          </div>
                        )}
                        {req.admin_comment && (
                          <div className="lt-detail-row">
                            <span className="lt-detail-label">Réponse admin :</span>
                            <span>{req.admin_comment}</span>
                          </div>
                        )}
                        {req.decision_date && (
                          <div className="lt-detail-row">
                            <span className="lt-detail-label">Décidé le :</span>
                            <span>{fmtDate(req.decision_date)}</span>
                          </div>
                        )}
                        {(req.modified_start_date || req.modifiedStartDate) && (
                          <div className="lt-detail-row modified">
                            <span className="lt-detail-label">Période modifiée :</span>
                            <span>
                              {fmtDate(req.modified_start_date || req.modifiedStartDate)} → {fmtDate(req.modified_end_date || req.modifiedEndDate)}
                              {' '}({req.modified_working_days || req.modifiedWorkingDays}j)
                            </span>
                          </div>
                        )}
                        {req.signature_employee && (
                          <div className="lt-detail-row">
                            <span className="lt-detail-label">Signature salarié :</span>
                            <span className="lt-sig-ok"><CheckCircle size={12} /> Signé</span>
                          </div>
                        )}
                        {req.signature_admin && (
                          <div className="lt-detail-row">
                            <span className="lt-detail-label">Signature employeur :</span>
                            <span className="lt-sig-ok"><CheckCircle size={12} /> Signé</span>
                          </div>
                        )}
                        <div className="lt-card-actions">
                          <button className="lt-action-btn pdf" onClick={() => handleDownloadPdf(req.id)}>
                            <Download size={14} /> PDF
                          </button>
                          {(req.status === 'pending' || req.status === 'accepted') && (
                            cancellingId === req.id ? (
                              <div className="lt-cancel-confirm">
                                <span>Confirmer ?</span>
                                <button className="lt-action-btn yes" onClick={() => handleCancel(req.id)}>Oui</button>
                                <button className="lt-action-btn no" onClick={() => setCancellingId(null)}>Non</button>
                              </div>
                            ) : (
                              <button
                                className="lt-action-btn cancel"
                                onClick={() => setCancellingId(req.id)}
                              >
                                <Trash2 size={14} /> Annuler
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Jours fériés */}
      {holidays.length > 0 && (adminView === 'mine' || !isAdmin) && (
        <div className="lt-section lt-holidays">
          <div className="lt-section-header">
            <h3><Calendar size={16} /> Jours fériés {new Date().getFullYear()}</h3>
          </div>
          <div className="lt-holidays-list">
            {holidays.map((h, i) => (
              <span key={i} className="lt-holiday-chip">
                {fmtShortDate(h.date)} — {h.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Modales existantes ═══ */}

      {showRequestForm && (
        <LeaveRequestForm
          person={null}
          persons={persons.filter(p => p.status === 'active')}
          isAdmin={isAdmin}
          currentUser={currentUser}
          onClose={() => setShowRequestForm(false)}
          onCreated={() => { setShowRequestForm(false); loadData(); }}
        />
      )}

      {showValidationPanel && (
        <LeaveValidationPanel
          onClose={() => setShowValidationPanel(false)}
          onUpdated={() => loadData()}
        />
      )}

      {showHistoryPanel && (
        <LeaveRequestsPanel
          personId={showHistoryPanel.personId}
          isAdmin={isAdmin}
          onClose={() => setShowHistoryPanel(null)}
          onNewRequest={() => {
            setShowHistoryPanel(null);
            setShowRequestForm(true);
          }}
          onRefresh={() => loadData()}
        />
      )}
    </div>
  );
};

export default LeavesTab;
