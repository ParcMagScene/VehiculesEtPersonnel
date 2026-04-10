import { useState, useEffect } from 'react';
import { Calendar, Check, X, Clock, User } from 'lucide-react';
import api from '../../utils/api';
import './ReservationRequestsPanel.css';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { Button, DetailRow, Textarea } from '@/design-system';

import { STATUS } from '../../constants';
import { formatDateFr } from '../../utils/formatUtils';

const ReservationRequestsPanel = ({ onRequestProcessed }) => {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('pending'); // 'pending', 'approved', 'rejected', 'all'
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRequests = async () => {
    try {
      const data = await api.getReservationRequests();
      setRequests(data);
    } catch (error) {
      console.error('Erreur lors du chargement des demandes:', error);
      toast.error('Erreur lors du chargement des demandes de réservation');
    }
  };

  const handleApprove = (requestId) => {
    confirm({
      title: 'Approuver',
      message: 'Approuver cette demande et cr\xE9er la r\xE9servation ?',
      variant: 'confirm',
      confirmLabel: 'Approuver',
      onConfirm: async () => {
        setLoading(true);
        try {
          await api.approveReservationRequest(requestId);
          toast.success('Demande approuv\xE9e ! La r\xE9servation a \xE9t\xE9 cr\xE9\xE9e.');
          await loadRequests();
          if (onRequestProcessed) {
            onRequestProcessed();
          }
        } catch (error) {
          console.error('Erreur lors de l\'approbation:', error);
          toast.error('Erreur lors de l\'approbation de la demande: ' + (error.message || 'Erreur inconnue'));
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleRejectClick = (request) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectionReason.trim()) {
      toast.warning('Veuillez indiquer un motif de rejet');
      return;
    }

    setLoading(true);
    try {
      await api.rejectReservationRequest(selectedRequest.id, rejectionReason);
      toast.success('Demande rejetée');
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason('');
      await loadRequests();
      if (onRequestProcessed) {
        onRequestProcessed();
      }
    } catch (error) {
      console.error('Erreur lors du rejet:', error);
      toast.error('Erreur lors du rejet de la demande: ' + (error.message || 'Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  const formatPeriod = (period) => {
    const periods = {
      morning: 'Matin',
      afternoon: 'Après-midi',
      fullday: 'Journée complète'
    };
    return periods[period] || period;
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'En attente',
      approved: 'Approuvée',
      rejected: 'Rejetée'
    };
    return labels[status] || status;
  };

  return (
    <div className="reservation-requests-panel">
      <h2>
        <Calendar size={24} />
        Demandes de réservation
      </h2>

      <div className="requests-filters">
        <Button variant="ghost" 
          className={filter === STATUS.PENDING ? 'active' : ''}
          onClick={() => setFilter('pending')}
        >
          En attente ({requests.filter(r => r.status === STATUS.PENDING).length})
        </Button>
        <Button variant="ghost" 
          className={filter === STATUS.APPROVED ? 'active' : ''}
          onClick={() => setFilter('approved')}
        >
          Approuvées ({requests.filter(r => r.status === STATUS.APPROVED).length})
        </Button>
        <Button variant="ghost" 
          className={filter === STATUS.REJECTED ? 'active' : ''}
          onClick={() => setFilter('rejected')}
        >
          Rejetées ({requests.filter(r => r.status === STATUS.REJECTED).length})
        </Button>
        <Button variant="ghost" 
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          Toutes ({requests.length})
        </Button>
      </div>

      <div className="requests-list">
        {filteredRequests.length === 0 ? (
          <div className="empty-requests">
            {filter === STATUS.PENDING && 'Aucune demande en attente'}
            {filter === STATUS.APPROVED && 'Aucune demande approuvée'}
            {filter === STATUS.REJECTED && 'Aucune demande rejetée'}
            {filter === 'all' && 'Aucune demande'}
          </div>
        ) : (
          filteredRequests.map(request => (
            <div key={request.id} className={`request-card ${request.status}`}>
              <div className="request-header">
                <div className="request-title">
                  <Calendar size={18} />
                  Véhicule #{request.vehicleId}
                </div>
                <span className={`request-status ${request.status}`}>
                  {getStatusLabel(request.status)}
                </span>
              </div>

              <div className="request-details">
                <DetailRow className="request-detail-item" label="Début">
                  {formatDateFr(request.startDate, 'N/A')} - {formatPeriod(request.startPeriod)}
                </DetailRow>
                <DetailRow className="request-detail-item" label="Fin">
                  {formatDateFr(request.endDate, 'N/A')} - {formatPeriod(request.endPeriod)}
                </DetailRow>
                {request.clientName && (
                  <DetailRow className="request-detail-item" label="Client" value={request.clientName} />
                )}
                {request.driverName && (
                  <DetailRow className="request-detail-item" label="Conducteur" value={request.driverName} />
                )}
                {request.locationName && (
                  <DetailRow className="request-detail-item" label="Lieu" value={request.locationName} />
                )}
                {request.prestationName && (
                  <DetailRow className="request-detail-item" label="Prestation" value={request.prestationName} />
                )}
              </div>

              {request.notes && (
                <div className="request-notes">
                  <strong>Notes:</strong> {request.notes}
                </div>
              )}

              {request.status === STATUS.REJECTED && request.rejectionReason && (
                <div className="rejection-reason">
                  <strong>Motif du rejet:</strong>
                  {request.rejectionReason}
                </div>
              )}

              {request.status === STATUS.PENDING && (
                <div className="request-actions">
                  <Button variant="ghost" 
                    className="approve-button"
                    onClick={() => handleApprove(request.id)}
                    disabled={loading}
                  >
                    <Check size={18} />
                    Approuver
                  </Button>
                  <Button variant="ghost" 
                    className="reject-button"
                    onClick={() => handleRejectClick(request)}
                    disabled={loading}
                  >
                    <X size={18} />
                    Rejeter
                  </Button>
                </div>
              )}

              <div className="request-meta">
                <span>
                  <User size={12} style={{display: 'inline', marginRight: '4px'}} />
                  Demandé par: {request.requesterName || `Utilisateur #${request.requestedBy}`}
                </span>
                <span>
                  <Clock size={12} style={{display: 'inline', marginRight: '4px'}} />
                  {new Date(request.requestedAt).toLocaleString('fr-FR')}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {rejectDialogOpen && (
        <div className="reject-dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && setRejectDialogOpen(false)}>
          <div className="reject-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>Rejeter la demande</h3>
            <Textarea
              placeholder="Indiquez le motif du rejet..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div className="reject-dialog-actions">
              <Button variant="ghost" 
                className="cancel"
                onClick={() => setRejectDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button variant="ghost" 
                className="confirm"
                onClick={handleRejectConfirm}
                disabled={loading}
              >
                Confirmer le rejet
              </Button>
            </div>
          </div>
        </div>
      )}
      {ConfirmDialogRenderer}
    </div>
  );
};

export default ReservationRequestsPanel;
