// ═══════════════════════════════════════════════════════════════
// MON ESPACE — Espace personnel accessible via l'avatar
// Congés : historique, export PDF, impression
// ═══════════════════════════════════════════════════════════════

import './MonEspacePanel.css';

import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar,
  CalendarOff,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  FileText,
  Filter,
  Hash,
  Plus,
  Printer,
  RefreshCw,
  Shield,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  DetailRow,
  EmptyState,
  InlineAlert,
  Modal,
  ModalBody,
  ModalHeader,
} from '@/design-system';

import { STATUS } from '../../constants';
import { useRefreshSubscription } from '../../hooks/useRefreshSubscription';
import api from '../../utils/api';
import { openSanitizedPrintWindow } from '../../utils/safePrintWindow';
import { LEAVE_TYPE_LABELS, STATUS_CONFIG } from '../leaves/leaveConstants';
import LeaveRequestForm from '../leaves/LeaveRequestForm';

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
  const [activeSection, setActiveSection] = useState('leaves'); // 'leaves' | 'pin'
  // PIN states
  const [hasPin, setHasPin] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinCurrentPassword, setPinCurrentPassword] = useState('');
  const [pinCurrentPin, setPinCurrentPin] = useState('');

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
    api
      .getPinStatus()
      .then((d) => setHasPin(!!d.hasPin))
      .catch(() => {});
  }, [loadLeaves, loadBalance]);

  // Auto-refresh quand des congés changent ailleurs
  useRefreshSubscription(
    'leaves',
    useCallback(() => {
      loadLeaves();
      loadBalance();
    }, [loadLeaves, loadBalance]),
  );

  const handleSetPin = async (e) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess('');
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinError('Le PIN doit contenir exactement 4 chiffres');
      return;
    }
    if (newPin !== newPinConfirm) {
      setPinError('Les codes PIN ne correspondent pas');
      return;
    }
    setPinLoading(true);
    try {
      await api.setPin(
        newPin,
        hasPin ? undefined : pinCurrentPassword,
        hasPin ? pinCurrentPin : undefined,
      );
      setHasPin(true);
      setPinSuccess('Code PIN enregistré avec succès');
      setNewPin('');
      setNewPinConfirm('');
      setPinCurrentPassword('');
      setPinCurrentPin('');
    } catch (err) {
      setPinError(err.message || 'Erreur lors de la mise à jour du PIN');
    } finally {
      setPinLoading(false);
    }
  };

  const handleDeletePin = async () => {
    if (!confirm('Supprimer votre code PIN ?')) return;
    setPinLoading(true);
    setPinError('');
    try {
      await api.deletePin();
      setHasPin(false);
      setPinSuccess('Code PIN supprimé');
    } catch (err) {
      setPinError(err.message || 'Erreur lors de la suppression');
    } finally {
      setPinLoading(false);
    }
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    try {
      return format(parseISO(d), 'd MMM yyyy', { locale: fr });
    } catch {
      return d;
    }
  };

  const fmtPeriod = (p) => (p === 'AM' ? 'matin' : 'après-midi');

  // ─── Export PDF (ouvre dans un nouvel onglet prêt pour impression/enregistrement)
  const handleExportPdf = async (id) => {
    setPdfLoading(id);
    try {
      const data = await api.getLeavePdf(id);
      if (data.html) {
        const win = openSanitizedPrintWindow(data.html);
        if (!win) {
          setError('Popup bloquée — autorisez les popups pour ce site');
          return;
        }
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
        const win = openSanitizedPrintWindow(data.html);
        if (!win) {
          setError('Popup bloquée — autorisez les popups pour ce site');
          return;
        }
        // Attendre le chargement complet puis déclencher l'impression
        win.onload = () => win.print();
        // Fallback si onload ne se déclenche pas
        setTimeout(() => {
          try {
            win.print();
          } catch {}
        }, 600);
      }
    } catch (err) {
      setError("Erreur lors de la préparation de l'impression");
    } finally {
      setPdfLoading(null);
    }
  };

  // ─── Filtrage
  const filteredLeaves = filter === 'all' ? leaves : leaves.filter((r) => r.status === filter);

  // ─── Stats rapides
  const stats = {
    total: leaves.length,
    pending: leaves.filter((r) => r.status === STATUS.PENDING).length,
    accepted: leaves.filter((r) => r.status === STATUS.ACCEPTED || r.status === 'modified').length,
    refused: leaves.filter((r) => r.status === STATUS.REFUSED).length,
  };

  return (
    <Modal open onClose={onClose} size="lg" className="mep-panel">
      <ModalHeader icon={<User size={20} />} onClose={onClose}>
        <div>
          <span>Mon espace</span>
          <span className="mep-subtitle">{currentUser?.name}</span>
        </div>
      </ModalHeader>

      <ModalBody>
        {/* ─── Navigation espace ─── */}
        <div className="mep-nav">
          <Button
            variant="ghost"
            className={`mep-nav-btn ${activeSection === 'leaves' ? 'active' : ''}`}
            onClick={() => setActiveSection('leaves')}
          >
            <CalendarOff size={16} />
            Mes congés
          </Button>
          <Button
            variant="ghost"
            className={`mep-nav-btn ${activeSection === 'pin' ? 'active' : ''}`}
            onClick={() => setActiveSection('pin')}
          >
            <Hash size={16} />
            Code PIN
          </Button>
          {activeSection === 'leaves' && (
            <Button
              variant="ghost"
              className="mep-nav-btn new-request"
              onClick={() => setShowNewForm(true)}
            >
              <Plus size={16} />
              Nouvelle demande
            </Button>
          )}
        </div>

        {/* ─── Contenu ─── */}
        <div className="mep-body">
          {/* ─── Section PIN ─── */}
          {activeSection === 'pin' && (
            <div className="mep-pin-section">
              <div className="mep-pin-header">
                <Shield size={18} />
                <div>
                  <strong>Code PIN de connexion</strong>
                  <p className="mep-pin-desc">
                    Votre code PIN (4 chiffres) vous permet de vous connecter rapidement sans saisir
                    votre mot de passe.
                  </p>
                </div>
              </div>
              {pinError && (
                <InlineAlert dismissible onDismiss={() => setPinError('')}>
                  {pinError}
                </InlineAlert>
              )}
              {pinSuccess && (
                <InlineAlert variant="success" dismissible onDismiss={() => setPinSuccess('')}>
                  {pinSuccess}
                </InlineAlert>
              )}
              <form onSubmit={handleSetPin} className="mep-pin-form">
                {!hasPin && (
                  <div className="mep-pin-field">
                    <label>Mot de passe actuel</label>
                    <input
                      type="password"
                      value={pinCurrentPassword}
                      onChange={(e) => setPinCurrentPassword(e.target.value)}
                      placeholder="Pour confirmer votre identité"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                )}
                {hasPin && (
                  <div className="mep-pin-field">
                    <label>PIN actuel (pour modifier)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={pinCurrentPin}
                      onChange={(e) =>
                        setPinCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                      }
                      placeholder="0000"
                      required
                      autoComplete="off"
                    />
                  </div>
                )}
                <div className="mep-pin-field">
                  <label>{hasPin ? 'Nouveau PIN' : 'Code PIN (4 chiffres)'}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0000"
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="mep-pin-field">
                  <label>Confirmer le PIN</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPinConfirm}
                    onChange={(e) =>
                      setNewPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder="0000"
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="mep-pin-actions">
                  <Button type="submit" variant="primary" disabled={pinLoading}>
                    {pinLoading ? <RefreshCw size={14} className="mep-spin" /> : <Hash size={14} />}
                    {hasPin ? 'Modifier le PIN' : 'Définir le PIN'}
                  </Button>
                  {hasPin && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="mep-pin-delete"
                      onClick={handleDeletePin}
                      disabled={pinLoading}
                    >
                      Supprimer le PIN
                    </Button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* ─── Section Congés ─── */}
          {activeSection === 'leaves' && (
            <>
              {error && (
                <InlineAlert dismissible onDismiss={() => setError('')}>
                  {error}
                </InlineAlert>
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
                      <span className="mep-balance-value accent">
                        {balance.daysEntitled ?? '—'}
                      </span>
                      <span className="mep-balance-label">Acquis</span>
                    </div>
                    <div className="mep-balance-item">
                      <span className="mep-balance-value warn">{balance.daysTaken ?? '—'}</span>
                      <span className="mep-balance-label">Pris</span>
                    </div>
                    <div className="mep-balance-item">
                      <span className="mep-balance-value success">
                        {balance.daysEntitled != null && balance.daysTaken != null
                          ? balance.daysEntitled - balance.daysTaken
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
                  <span className="mep-stat">
                    {stats.total} demande{stats.total > 1 ? 's' : ''}
                  </span>
                  {stats.pending > 0 && (
                    <span className="mep-stat pending">⏳ {stats.pending} en attente</span>
                  )}
                  {stats.accepted > 0 && (
                    <span className="mep-stat accepted">
                      ✓ {stats.accepted} acceptée{stats.accepted > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="mep-filters">
                  <Filter size={13} />
                  {['all', 'pending', 'accepted', 'refused', 'cancelled'].map((f) => (
                    <Button
                      variant="ghost"
                      key={f}
                      className={`mep-filter-btn ${filter === f ? 'active' : ''}`}
                      onClick={() => setFilter(f)}
                    >
                      {f === 'all' ? 'Toutes' : STATUS_CONFIG[f]?.label || f}
                    </Button>
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
                <EmptyState
                  icon={<CalendarOff size={32} />}
                  title={
                    filter === 'all' ? 'Aucune demande de congé' : 'Aucune demande avec ce filtre'
                  }
                />
              ) : (
                <div className="mep-list">
                  {filteredLeaves.map((leave) => {
                    const statusConf = STATUS_CONFIG[leave.status] || {};
                    const typeConf =
                      LEAVE_TYPE_LABELS[leave.leaveType] ||
                      LEAVE_TYPE_LABELS[leave.leave_type] ||
                      {};
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
                              <div className="mep-card-type">
                                {typeConf.label || leave.leaveType || leave.leave_type}
                              </div>
                              <div className="mep-card-dates">
                                {fmtDate(leave.startDate || leave.start_date)} →{' '}
                                {fmtDate(leave.endDate || leave.end_date)}
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
                              <DetailRow className="mep-detail-row" label="Période :">
                                Du {fmtDate(leave.startDate || leave.start_date)} (
                                {fmtPeriod(leave.startPeriod || leave.start_period)}) au{' '}
                                {fmtDate(leave.endDate || leave.end_date)} (
                                {fmtPeriod(leave.endPeriod || leave.end_period)})
                              </DetailRow>
                              <DetailRow className="mep-detail-row" label="Jours ouvrables :">
                                <strong>{leave.workingDays || leave.working_days}</strong> jour
                                {(leave.workingDays || leave.working_days) > 1 ? 's' : ''}
                              </DetailRow>
                              {(leave.employeeComment || leave.employee_comment) && (
                                <DetailRow
                                  className="mep-detail-row"
                                  label="Mon commentaire :"
                                  value={leave.employeeComment || leave.employee_comment}
                                />
                              )}
                              <DetailRow
                                className="mep-detail-row"
                                label="Déposée le :"
                                value={fmtDate(leave.requestDate || leave.request_date)}
                              />
                              {(leave.decisionDate || leave.decision_date) && (
                                <DetailRow className="mep-detail-row" label="Décision :">
                                  {fmtDate(leave.decisionDate || leave.decision_date)}
                                  {(leave.decisionByName || leave.decision_by_name) &&
                                    ` par ${leave.decisionByName || leave.decision_by_name}`}
                                </DetailRow>
                              )}
                              {(leave.adminComment || leave.admin_comment) && (
                                <DetailRow
                                  className="mep-detail-row"
                                  label="Commentaire direction :"
                                  value={leave.adminComment || leave.admin_comment}
                                />
                              )}
                            </div>

                            {/* ─── Actions PDF / Impression / Modifier ─── */}
                            <div className="mep-card-actions">
                              {leave.status === STATUS.PENDING && (
                                <Button
                                  variant="ghost"
                                  className="mep-action-btn edit"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingLeave(leave);
                                  }}
                                  title="Modifier cette demande"
                                >
                                  <Edit3 size={14} />
                                  Modifier
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                className="mep-action-btn pdf"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExportPdf(leave.id);
                                }}
                                disabled={isPdfLoading}
                                title="Visualiser le document officiel (PDF)"
                              >
                                {isPdfLoading ? (
                                  <RefreshCw size={14} className="mep-spin" />
                                ) : (
                                  <FileText size={14} />
                                )}
                                Voir le document
                              </Button>
                              <Button
                                variant="ghost"
                                className="mep-action-btn print"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrint(leave.id);
                                }}
                                disabled={isPdfLoading}
                                title="Imprimer la demande de congé"
                              >
                                <Printer size={14} />
                                Imprimer
                              </Button>
                              <Button
                                variant="ghost"
                                className="mep-action-btn download"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExportPdf(leave.id);
                                }}
                                disabled={isPdfLoading}
                                title="Télécharger le document (Ctrl+S dans le nouvel onglet)"
                              >
                                <Download size={14} />
                                Télécharger
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Formulaire de modification ─── */}
        {editingLeave && (
          <LeaveRequestForm
            person={{ id: editingLeave.person_id || editingLeave.personId }}
            currentUser={currentUser}
            editRequest={editingLeave}
            onClose={() => setEditingLeave(null)}
            onCreated={() => {
              setEditingLeave(null);
              loadLeaves();
              loadBalance();
            }}
          />
        )}

        {/* ─── Formulaire de nouvelle demande ─── */}
        {showNewForm && (
          <LeaveRequestForm
            currentUser={currentUser}
            onClose={() => setShowNewForm(false)}
            onCreated={() => {
              setShowNewForm(false);
              loadLeaves();
              loadBalance();
            }}
          />
        )}
      </ModalBody>
    </Modal>
  );
};

export default MonEspacePanel;
