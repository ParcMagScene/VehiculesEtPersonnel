import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  Download,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';

import { Button, DetailRow, EmptyState } from '@/design-system';

import { STATUS } from '../../constants';
import { LEAVE_TYPE_LABELS, STATUS_CONFIG } from './leaveConstants';

// ═══════════════════════════════════════
// Requests List View
// Displays: filtered list of leave requests with expandable details
// Props: filteredRequests, adminView, expandedId, setExpandedId, cancellingId, setCancellingId, onDownloadPdf, onCancel, onNewRequest
// ═══════════════════════════════════════

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return format(parseISO(d), 'd MMM yyyy', { locale: fr });
  } catch {
    return d;
  }
};

const _fmtShortDate = (d) => {
  if (!d) return '—';
  try {
    return format(parseISO(d), 'd MMM', { locale: fr });
  } catch {
    return d;
  }
};

export const LeaveRequestsList = ({
  filteredRequests = [],
  adminView = 'mine',
  requestFilter = 'all',
  onFilterChange,
  expandedId = null,
  setExpandedId,
  cancellingId = null,
  setCancellingId,
  onDownloadPdf,
  onCancel,
  onNewRequest,
}) => {
  return (
    <div className="lt-requests">
      {/* Filtres */}
      <div className="lt-filters">
        <Button
          variant="ghost"
          className={`lt-filter-btn ${requestFilter === 'all' ? 'active' : ''}`}
          onClick={() => onFilterChange('all')}
        >
          Toutes ({filteredRequests.length})
        </Button>
        <Button
          variant="ghost"
          className={`lt-filter-btn pending ${requestFilter === STATUS.PENDING ? 'active' : ''}`}
          onClick={() => onFilterChange(STATUS.PENDING)}
        >
          <Clock size={12} /> En attente
        </Button>
        <Button
          variant="ghost"
          className={`lt-filter-btn accepted ${requestFilter === STATUS.ACCEPTED ? 'active' : ''}`}
          onClick={() => onFilterChange(STATUS.ACCEPTED)}
        >
          <CheckCircle size={12} /> Acceptées
        </Button>
        <Button
          variant="ghost"
          className={`lt-filter-btn refused ${requestFilter === STATUS.REFUSED ? 'active' : ''}`}
          onClick={() => onFilterChange(STATUS.REFUSED)}
        >
          <XCircle size={12} /> Refusées
        </Button>
      </div>

      {/* Liste */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          icon={<Calendar size={32} />}
          title={adminView === 'mine' ? 'Aucune demande de congé' : 'Aucune demande'}
          action={
            <Button variant="primary" onClick={onNewRequest}>
              <Plus size={16} /> Faire une demande
            </Button>
          }
        />
      ) : (
        <div className="lt-request-list">
          {filteredRequests.map((req) => {
            const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            const typeCfg =
              LEAVE_TYPE_LABELS[req.leave_type || req.leaveType] || LEAVE_TYPE_LABELS.conge_paye;
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
                    <span>
                      {fmtDate(req.start_date || req.startDate)} →{' '}
                      {fmtDate(req.end_date || req.endDate)}
                    </span>
                    <span className="lt-card-days">{req.working_days || req.workingDays} j</span>
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
                      style={{
                        transform: isExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    />
                  </div>
                </div>

                {/* Détails */}
                {isExpanded && (
                  <div className="lt-card-details" onClick={(e) => e.stopPropagation()}>
                    {req.employee_comment && (
                      <DetailRow
                        className="lt-detail-row"
                        label="Commentaire :"
                        value={req.employee_comment}
                      />
                    )}
                    {req.admin_comment && (
                      <DetailRow
                        className="lt-detail-row"
                        label="Réponse admin :"
                        value={req.admin_comment}
                      />
                    )}
                    {req.decision_date && (
                      <DetailRow
                        className="lt-detail-row"
                        label="Décidé le :"
                        value={fmtDate(req.decision_date)}
                      />
                    )}
                    {(req.modified_start_date || req.modifiedStartDate) && (
                      <DetailRow className="lt-detail-row modified" label="Période modifiée :">
                        {fmtDate(req.modified_start_date || req.modifiedStartDate)} →{' '}
                        {fmtDate(req.modified_end_date || req.modifiedEndDate)} (
                        {req.modified_working_days || req.modifiedWorkingDays}j)
                      </DetailRow>
                    )}
                    {req.signature_employee && (
                      <DetailRow className="lt-detail-row" label="Signature salarié :">
                        <span className="lt-sig-ok">
                          <CheckCircle size={12} /> Signé
                        </span>
                      </DetailRow>
                    )}
                    {req.signature_admin && (
                      <DetailRow className="lt-detail-row" label="Signature employeur :">
                        <span className="lt-sig-ok">
                          <CheckCircle size={12} /> Signé
                        </span>
                      </DetailRow>
                    )}
                    <div className="lt-card-actions">
                      <Button
                        variant="ghost"
                        className="lt-action-btn pdf"
                        onClick={() => onDownloadPdf(req.id)}
                      >
                        <Download size={14} /> PDF
                      </Button>
                      {(req.status === STATUS.PENDING || req.status === STATUS.ACCEPTED) &&
                        (cancellingId === req.id ? (
                          <div className="lt-cancel-confirm">
                            <span>Confirmer ?</span>
                            <Button
                              variant="ghost"
                              className="lt-action-btn yes"
                              onClick={() => onCancel(req.id)}
                            >
                              Oui
                            </Button>
                            <Button
                              variant="ghost"
                              className="lt-action-btn no"
                              onClick={() => setCancellingId(null)}
                            >
                              Non
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            className="lt-action-btn cancel"
                            onClick={() => setCancellingId(req.id)}
                          >
                            <Trash2 size={14} /> Annuler
                          </Button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LeaveRequestsList;
