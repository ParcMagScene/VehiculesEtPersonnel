// ═══════════════════════════════════════════════════════════════
// MON ESPACE — Espace personnel accessible via l'avatar
// Congés : historique, export PDF, impression
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Calendar, Download, Printer, ChevronDown, ChevronRight,
  FileText, Clock, CheckCircle, AlertTriangle, RefreshCw,
  CalendarOff, User, Filter, Edit3, Plus,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../utils/api';
import { STATUS_CONFIG, LEAVE_TYPE_LABELS } from '../leaves/leaveConstants';
import LeaveRequestForm from '../leaves/LeaveRequestForm';
import './MonEspacePanel.css';

const MonEspacePanel = ({ currentUser, onClose }) => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(null);
  const [balance, setBalance] = useState(null);
  const [editingLeave, setEditingLeave] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getMyLeaves();
      setLeaves(data || []);
    } catch (err) {
      console.error('Erreur chargement congés:', err);
      setError('Impossible de charger vos demandes de congés');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBalance = useCallback(async () => {
    try {
      const data = await api.getLeaveBalances({ year: new Date().getFullYear() });
      if (Array.isArray(data) && data.length > 0) {
        setBalance(data[0]);
      }
    } catch {
      // Pas bloquant
    }
  }, []);

  useEffect(() => {
    loadLeaves();
    loadBalance();
  }, [loadLeaves, loadBalance]);

  const fmtDate = (d) => {
    if (!d) return '—';
    try {
      return format(parseISO(d), 'd MMM yyyy', { locale: fr });
    } catch { return d; }
  };

  const fmtPeriod = (p) => p === 'AM' ? 'matin' : 'après-midi';

  // ─── Export PDF (ouvre dans un nouvel onglet prêt pour impression/enregistrement)
  const handleExportPdf = async (id) => {
    setPdfLoading(id);
    try {
      const data = await api.getLeavePdf(id);
      if (data.html) {
        const win = window.open('', '_blank');
        if (!win) {
          setError('Popup bloquée — autorisez les popups pour ce site');
          return;
        }
        win.document.write(data.html);
        win.document.close();
      }
    } catch (err) {
      setError('Erreur lors de la génération du PDF');
    } finally {
      setPdfLoading(null);
    }
  };

  // ─── Impression directe
  const handlePrint = async (id) => {
    setPdfLoading(id);
    try {
      const data = await api.getLeavePdf(id);
      if (data.html) {
        const win = window.open('', '_blank');
        if (!win) {
          setError('Popup bloquée — autorisez les popups pour ce site');
          return;
        }
        win.document.write(data.html);
        win.document.close();
        // Attendre le chargement complet puis déclencher l'impression
        win.onload = () => win.print();
        // Fallback si onload ne se déclenche pas
        setTimeout(() => {
          try { win.print(); } catch {}
        }, 600);
      }
    } catch (err) {
      setError('Erreur lors de la préparation de l\'impression');
    } finally {
      setPdfLoading(null);
    }
  };

  // ─── Filtrage
  const filteredLeaves = filter === 'all'
    ? leaves
    : leaves.filter(r => r.status === filter);

  // ─── Stats rapides
  const stats = {
    total: leaves.length,
    pending: leaves.filter(r => r.status === 'pending').length,
    accepted: leaves.filter(r => r.status === 'accepted' || r.status === 'modified').length,
    refused: leaves.filter(r => r.status === 'refused').length,
  };

  return (
    <div className="mep-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mep-panel">
        {/* ─── Header ─── */}
        <div className="mep-header">
          <div className="mep-header-left">
            <User size={20} />
            <div>
              <h2 className="mep-title">Mon espace</h2>
              <span className="mep-subtitle">{currentUser?.name}</span>
            </div>
          </div>
          <button className="mep-close" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </div>

        {/* ─── Navigation espace ─── */}
        <div className="mep-nav">
          <button className="mep-nav-btn active">
            <CalendarOff size={16} />
            Mes congés
          </button>
          <button className="mep-nav-btn new-request" onClick={() => setShowNewForm(true)}>
            <Plus size={16} />
            Nouvelle demande
          </button>
        </div>

        {/* ─── Contenu ─── */}
        <div className="mep-body">
          {error && (
            <div className="mep-error">
              <AlertTriangle size={14} />
              {error}
              <button onClick={() => setError('')}>✕</button>
            </div>
          )}

          {/* ─── Solde congés ─── */}
          {balance && (
            <div className="mep-balance-card">
              <div className="mep-balance-title">
                <Calendar size={14} />
                Solde congés {new Date().getFullYear()}
              </div>
              <div className="mep-balance-grid">
                <div className="mep-balance-item">
                  <span className="mep-balance-value accent">{balance.daysEntitled ?? '—'}</span>
                  <span className="mep-balance-label">Acquis</span>
                </div>
                <div className="mep-balance-item">
                  <span className="mep-balance-value warn">{balance.daysTaken ?? '—'}</span>
                  <span className="mep-balance-label">Pris</span>
                </div>
                <div className="mep-balance-item">
                  <span className="mep-balance-value success">
                    {balance.daysEntitled != null && balance.daysTaken != null
                      ? (balance.daysEntitled - balance.daysTaken)
                      : '—'}
                  </span>
                  <span className="mep-balance-label">Restants</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── Stats + Filtres ─── */}
          <div className="mep-toolbar">
            <div className="mep-stats-row">
              <span className="mep-stat">{stats.total} demande{stats.total > 1 ? 's' : ''}</span>
              {stats.pending > 0 && <span className="mep-stat pending">⏳ {stats.pending} en attente</span>}
              {stats.accepted > 0 && <span className="mep-stat accepted">✓ {stats.accepted} acceptée{stats.accepted > 1 ? 's' : ''}</span>}
            </div>
            <div className="mep-filters">
              <Filter size={13} />
              {['all', 'pending', 'accepted', 'refused', 'cancelled'].map(f => (
                <button
                  key={f}
                  className={`mep-filter-btn ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'Toutes' : STATUS_CONFIG[f]?.label || f}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Liste ─── */}
          {loading ? (
            <div className="mep-loading">
              <RefreshCw size={20} className="mep-spin" />
              Chargement…
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="mep-empty">
              <CalendarOff size={32} />
              <p>{filter === 'all' ? 'Aucune demande de congé' : 'Aucune demande avec ce filtre'}</p>
            </div>
          ) : (
            <div className="mep-list">
              {filteredLeaves.map(leave => {
                const statusConf = STATUS_CONFIG[leave.status] || {};
                const typeConf = LEAVE_TYPE_LABELS[leave.leaveType] || LEAVE_TYPE_LABELS[leave.leave_type] || {};
                const isExpanded = expandedId === leave.id;
                const isPdfLoading = pdfLoading === leave.id;

                return (
                  <div key={leave.id} className={`mep-card ${leave.status}`}>
                    {/* ─── Ligne résumé ─── */}
                    <div
                      className="mep-card-header"
                      onClick={() => setExpandedId(isExpanded ? null : leave.id)}
                    >
                      <div className="mep-card-left">
                        <span className="mep-type-icon">{typeConf.icon || '📋'}</span>
                        <div>
                          <div className="mep-card-type">{typeConf.label || leave.leaveType || leave.leave_type}</div>
                          <div className="mep-card-dates">
                            {fmtDate(leave.startDate || leave.start_date)} → {fmtDate(leave.endDate || leave.end_date)}
                          </div>
                        </div>
                      </div>
                      <div className="mep-card-right">
                        <span className="mep-card-days">
                          {leave.workingDays || leave.working_days} j
                        </span>
                        <span
                          className="mep-status-badge"
                          style={{ background: statusConf.bg, color: statusConf.color }}
                        >
                          {statusConf.label}
                        </span>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </div>

                    {/* ─── Détails expansés ─── */}
                    {isExpanded && (
                      <div className="mep-card-details">
                        <div className="mep-detail-grid">
                          <div className="mep-detail-row">
                            <span className="mep-detail-label">Période :</span>
                            <span>
                              Du {fmtDate(leave.startDate || leave.start_date)} ({fmtPeriod(leave.startPeriod || leave.start_period)})
                              au {fmtDate(leave.endDate || leave.end_date)} ({fmtPeriod(leave.endPeriod || leave.end_period)})
                            </span>
                          </div>
                          <div className="mep-detail-row">
                            <span className="mep-detail-label">Jours ouvrables :</span>
                            <span><strong>{leave.workingDays || leave.working_days}</strong> jour{(leave.workingDays || leave.working_days) > 1 ? 's' : ''}</span>
                          </div>
                          {(leave.employeeComment || leave.employee_comment) && (
                            <div className="mep-detail-row">
                              <span className="mep-detail-label">Mon commentaire :</span>
                              <span>{leave.employeeComment || leave.employee_comment}</span>
                            </div>
                          )}
                          <div className="mep-detail-row">
                            <span className="mep-detail-label">Déposée le :</span>
                            <span>{fmtDate(leave.requestDate || leave.request_date)}</span>
                          </div>
                          {(leave.decisionDate || leave.decision_date) && (
                            <div className="mep-detail-row">
                              <span className="mep-detail-label">Décision :</span>
                              <span>
                                {fmtDate(leave.decisionDate || leave.decision_date)}
                                {(leave.decisionByName || leave.decision_by_name) && ` par ${leave.decisionByName || leave.decision_by_name}`}
                              </span>
                            </div>
                          )}
                          {(leave.adminComment || leave.admin_comment) && (
                            <div className="mep-detail-row">
                              <span className="mep-detail-label">Commentaire direction :</span>
                              <span>{leave.adminComment || leave.admin_comment}</span>
                            </div>
                          )}
                        </div>

                        {/* ─── Actions PDF / Impression / Modifier ─── */}
                        <div className="mep-card-actions">
                          {leave.status === 'pending' && (
                            <button
                              className="mep-action-btn edit"
                              onClick={(e) => { e.stopPropagation(); setEditingLeave(leave); }}
                              title="Modifier cette demande"
                            >
                              <Edit3 size={14} />
                              Modifier
                            </button>
                          )}
                          <button
                            className="mep-action-btn pdf"
                            onClick={(e) => { e.stopPropagation(); handleExportPdf(leave.id); }}
                            disabled={isPdfLoading}
                            title="Visualiser le document officiel (PDF)"
                          >
                            {isPdfLoading ? <RefreshCw size={14} className="mep-spin" /> : <FileText size={14} />}
                            Voir le document
                          </button>
                          <button
                            className="mep-action-btn print"
                            onClick={(e) => { e.stopPropagation(); handlePrint(leave.id); }}
                            disabled={isPdfLoading}
                            title="Imprimer la demande de congé"
                          >
                            <Printer size={14} />
                            Imprimer
                          </button>
                          <button
                            className="mep-action-btn download"
                            onClick={(e) => { e.stopPropagation(); handleExportPdf(leave.id); }}
                            disabled={isPdfLoading}
                            title="Télécharger le document (Ctrl+S dans le nouvel onglet)"
                          >
                            <Download size={14} />
                            Télécharger
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Formulaire de modification ─── */}
        {editingLeave && (
          <LeaveRequestForm
            person={{ id: editingLeave.person_id || editingLeave.personId }}
            currentUser={currentUser}
            editRequest={editingLeave}
            onClose={() => setEditingLeave(null)}
            onCreated={() => { setEditingLeave(null); loadLeaves(); loadBalance(); }}
          />
        )}

        {/* ─── Formulaire de nouvelle demande ─── */}
        {showNewForm && (
          <LeaveRequestForm
            currentUser={currentUser}
            onClose={() => setShowNewForm(false)}
            onCreated={() => { setShowNewForm(false); loadLeaves(); loadBalance(); }}
          />
        )}
      </div>
    </div>
  );
};

export default MonEspacePanel;
