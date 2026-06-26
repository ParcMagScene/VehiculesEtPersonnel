// ═══════════════════════════════════════════════════════════════
// PANNEAU HISTORIQUE DES DEMANDES DE CONGÉS — Salarié
// Conforme Code du travail, IDCC 3252
// ═══════════════════════════════════════════════════════════════

import './LeaveRequestsPanel.css';

import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  Download,
  RefreshCw,
  Send,
  Trash2,
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
  Tooltip,
} from '@/design-system';

import { STATUS } from '../../constants';
import { useRefreshSubscription } from '../../hooks/useRefreshSubscription';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import { sanitizePrintHtml } from '../../utils/safePrintWindow';
import { usePrintPreview } from '../ui/PrintPreviewProvider';
import { LEAVE_TYPE_LABELS, STATUS_CONFIG } from './leaveConstants';

const LeaveRequestsPanel = ({
  personId = null,
  isAdmin = false,
  onClose,
  onNewRequest,
  onRefresh,
}) => {
  const printPreview = usePrintPreview();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState('');
  const toast = useToast();

  const handleSafeClose = () => {
    if (isCancelling) {
      return;
    }
    onClose();
  };

  // Charger les demandes
  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      let data;
      if (isAdmin && personId) {
        data = await api.getAllLeaves({ personId });
      } else if (isAdmin) {
        data = await api.getAllLeaves();
      } else {
        data = await api.getMyLeaves();
      }
      setRequests(data || []);
    } catch (err) {
      console.error('Erreur chargement demandes:', err);
      setError('Impossible de charger les demandes');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, personId]);

  // Charger le solde
  const loadBalance = useCallback(async () => {
    if (!personId) return;
    try {
      const data = await api.getLeaveBalances({ personId, year: new Date().getFullYear() });
      setBalance(data);
    } catch (err) {
      console.error('Erreur chargement solde:', err);
      toast.error('Impossible de charger le solde de congés.');
    }
  }, [personId, toast]);

  useEffect(() => {
    loadRequests();
    loadBalance();
  }, [loadRequests, loadBalance]);

  // Auto-refresh quand des congés changent ailleurs
  useRefreshSubscription(
    'leaves',
    useCallback(() => {
      loadRequests();
      loadBalance();
    }, [loadRequests, loadBalance]),
  );

  // Annuler une demande
  const handleCancel = async (id) => {
    setIsCancelling(true);
    try {
      await api.cancelLeave(id);
      refreshBus.publish('leaves');
      setCancellingId(null);
      loadRequests();
      loadBalance();
      toast.success('Demande annulée avec succès.');
      if (onRefresh) onRefresh();
    } catch (err) {
      const message = err.error || err.message || "Impossible d'annuler la demande.";
      setError(message);
      toast.error(message);
    } finally {
      setIsCancelling(false);
    }
  };

  // Télécharger le PDF
  const handleDownloadPdf = async (id) => {
    try {
      const data = await api.getLeavePdf(id);
      if (data.html) {
        printPreview.showHtml(sanitizePrintHtml(data.html), {
          title: 'Demande de congés',
          filename: `conge-${id}.html`,
        });
      }
    } catch (err) {
      setError('Impossible de générer le PDF.');
      toast.error('Impossible de générer le PDF.');
    }
  };

  // Formatter date
  const fmtDate = (d) => {
    if (!d) return '—';
    try {
      return format(parseISO(d), 'd MMM yyyy', { locale: fr });
    } catch {
      return d;
    }
  };

  // Filtrer les demandes
  const filteredRequests =
    filter === 'all'
      ? requests
      : requests.filter((r) => r.status === filter || r.leave_type === filter);

  // Stats rapides
  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === STATUS.PENDING).length,
    accepted: requests.filter((r) => r.status === STATUS.ACCEPTED || r.status === 'modified')
      .length,
    refused: requests.filter((r) => r.status === STATUS.REFUSED).length,
  };

  return (
    <Modal open onClose={handleSafeClose} size="lg" className="lrp-panel">
      <ModalHeader icon={<Calendar size={20} />} onClose={handleSafeClose}>
        <span>Mes demandes de congés</span>
        <div className="lrp-header-actions">
          <Tooltip content="Rafraîchir">
            <Button variant="ghost" className="lrp-btn-refresh" onClick={loadRequests}>
              <RefreshCw size={16} />
            </Button>
          </Tooltip>
          {onNewRequest && (
            <Button variant="ghost" className="lrp-btn-new" onClick={onNewRequest}>
              <Send size={14} /> Nouvelle demande
            </Button>
          )}
        </div>
      </ModalHeader>
      <ModalBody>
        {/* Solde */}
        {balance && (
          <div className="lrp-balance-bar">
            <div className="lrp-balance-item">
              <span className="lrp-balance-num">
                {balance.daysEntitled ?? balance.days_entitled ?? 30}
              </span>
              <span>acquis</span>
            </div>
            <div className="lrp-balance-item">
              <span className="lrp-balance-num">
                {balance.daysTaken ?? balance.days_taken ?? 0}
              </span>
              <span>pris</span>
            </div>
            <div className="lrp-balance-item highlight">
              <span className="lrp-balance-num">
                {balance.remaining ??
                  (balance.daysEntitled || balance.days_entitled || 30) -
                    (balance.daysTaken || balance.days_taken || 0)}
              </span>
              <span>restant</span>
            </div>
            {(balance.carryOver ?? balance.carry_over) > 0 && (
              <div className="lrp-balance-item carry">
                <span className="lrp-balance-num">+{balance.carryOver ?? balance.carry_over}</span>
                <span>report</span>
              </div>
            )}
          </div>
        )}

        {/* Stats rapides */}
        <div className="lrp-stats">
          <span
            className="lrp-stat"
            data-active={filter === 'all'}
            role="tab"
            tabIndex={0}
            onClick={() => setFilter('all')}
          >
            Toutes ({stats.total})
          </span>
          <span
            className="lrp-stat pending"
            data-active={filter === STATUS.PENDING}
            role="tab"
            tabIndex={0}
            onClick={() => setFilter('pending')}
          >
            En attente ({stats.pending})
          </span>
          <span
            className="lrp-stat accepted"
            data-active={filter === STATUS.ACCEPTED}
            role="tab"
            tabIndex={0}
            onClick={() => setFilter('accepted')}
          >
            Acceptées ({stats.accepted})
          </span>
          <span
            className="lrp-stat refused"
            data-active={filter === STATUS.REFUSED}
            role="tab"
            tabIndex={0}
            onClick={() => setFilter('refused')}
          >
            Refusées ({stats.refused})
          </span>
        </div>

        {/* Erreur */}
        {error && (
          <InlineAlert dismissible onDismiss={() => setError('')}>
            {error}
          </InlineAlert>
        )}

        {/* Liste */}
        <div className="lrp-list">
          {loading ? (
            <div className="lrp-loading">
              <Clock size={20} /> Chargement...
            </div>
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              icon={<Calendar size={32} />}
              title="Aucune demande de congé"
              action={
                onNewRequest && (
                  <Button variant="ghost" className="lrp-btn-new-empty" onClick={onNewRequest}>
                    <Send size={14} /> Faire une demande
                  </Button>
                )
              }
            />
          ) : (
            filteredRequests.map((req) => {
              const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
              const StatusIcon = statusCfg.icon;
              const typeCfg =
                LEAVE_TYPE_LABELS[req.leave_type || req.leaveType] || LEAVE_TYPE_LABELS.conge_paye;
              const isExpanded = expandedId === req.id;

              return (
                <div
                  key={req.id}
                  className={`lrp-card ${req.status}`}
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                >
                  <div className="lrp-card-header">
                    <div className="lrp-card-type" style={{ color: typeCfg.color }}>
                      <span>{typeCfg.icon}</span>
                      <span>{typeCfg.label}</span>
                      {req.exceptional_type && (
                        <span className="lrp-card-exceptional">
                          — {req.exceptional_type.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <div
                      className="lrp-card-status"
                      style={{ background: statusCfg.bg, color: statusCfg.color }}
                    >
                      <StatusIcon size={12} />
                      {statusCfg.label}
                    </div>
                  </div>

                  <div className="lrp-card-dates">
                    <Calendar size={12} />
                    <span>
                      {fmtDate(req.start_date || req.startDate)} →{' '}
                      {fmtDate(req.end_date || req.endDate)}
                    </span>
                    <span className="lrp-card-days">
                      {req.working_days || req.workingDays} jour
                      {(req.working_days || req.workingDays) > 1 ? 's' : ''}
                    </span>
                  </div>

                  {isAdmin && (
                    <div className="lrp-card-person">
                      {req.first_name || req.firstName} {req.last_name || req.lastName}
                    </div>
                  )}

                  {/* Détails expansés */}
                  {isExpanded && (
                    <div className="lrp-card-details" onClick={(e) => e.stopPropagation()}>
                      {req.employee_comment && (
                        <DetailRow
                          className="lrp-detail-row"
                          label="Commentaire :"
                          value={req.employee_comment || req.employeeComment}
                        />
                      )}
                      {req.admin_comment && (
                        <DetailRow
                          className="lrp-detail-row"
                          label="Réponse :"
                          value={req.admin_comment || req.adminComment}
                        />
                      )}
                      {req.decision_date && (
                        <DetailRow
                          className="lrp-detail-row"
                          label="Décision le :"
                          value={fmtDate(req.decision_date || req.decisionDate)}
                        />
                      )}
                      {req.decision_by_name && (
                        <DetailRow
                          className="lrp-detail-row"
                          label="Par :"
                          value={req.decision_by_name || req.decisionByName}
                        />
                      )}
                      {(req.modified_start_date || req.modifiedStartDate) && (
                        <DetailRow className="lrp-detail-row modified" label="Période modifiée :">
                          {fmtDate(req.modified_start_date || req.modifiedStartDate)} →{' '}
                          {fmtDate(req.modified_end_date || req.modifiedEndDate)} (
                          {req.modified_working_days || req.modifiedWorkingDays} jours)
                        </DetailRow>
                      )}
                      {req.signature_employee && (
                        <DetailRow className="lrp-detail-row" label="Signature salarié :">
                          <span className="lrp-signature-ok">
                            <CheckCircle size={12} /> Signé
                          </span>
                        </DetailRow>
                      )}
                      {req.signature_admin && (
                        <DetailRow className="lrp-detail-row" label="Signature employeur :">
                          <span className="lrp-signature-ok">
                            <CheckCircle size={12} /> Signé
                          </span>
                        </DetailRow>
                      )}

                      <div className="lrp-card-actions">
                        <Button
                          variant="ghost"
                          className="lrp-action-btn pdf"
                          onClick={() => handleDownloadPdf(req.id)}
                          title="Télécharger le PDF"
                        >
                          <Download size={14} /> PDF
                        </Button>
                        {(req.status === STATUS.PENDING || req.status === STATUS.ACCEPTED) &&
                          (cancellingId === req.id ? (
                            <div className="lrp-cancel-confirm">
                              <span>Confirmer l'annulation ?</span>
                              <Button
                                variant="ghost"
                                className="lrp-action-btn cancel-yes"
                                onClick={() => handleCancel(req.id)}
                              >
                                Oui
                              </Button>
                              <Button
                                variant="ghost"
                                className="lrp-action-btn cancel-no"
                                onClick={() => setCancellingId(null)}
                              >
                                Non
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              className="lrp-action-btn cancel"
                              onClick={() => setCancellingId(req.id)}
                              title="Annuler"
                            >
                              <Trash2 size={14} /> Annuler
                            </Button>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="lrp-card-expand">
                    <ChevronDown
                      size={14}
                      style={{
                        transform: isExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ModalBody>
    </Modal>
  );
};

export default LeaveRequestsPanel;
