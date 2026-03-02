import React, { useState, useEffect } from 'react';
import { Calendar, Check, X, Clock, User } from 'lucide-react';
import api from '../utils/api';
import './ReservationRequestsPanel.css';
import { useToast } from '../hooks/useToast';

const ReservationRequestsPanel = ({ onRequestProcessed }) => {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('pending'); // 'pending', 'approved', 'rejected', 'all'
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRequests();
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

  const handleApprove = async (requestId) => {
    if (!confirm('Approuver cette demande et créer la réservation ?')) {
      return;
    }

    setLoading(true);
    try {
      await api.approveReservationRequest(requestId);
      toast.success('Demande approuvée ! La réservation a été créée.');
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

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

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
        <button 
          className={filter === 'pending' ? 'active' : ''}
          onClick={() => setFilter('pending')}
        >
          En attente ({requests.filter(r => r.status === 'pending').length})
        </button>
        <button 
          className={filter === 'approved' ? 'active' : ''}
          onClick={() => setFilter('approved')}
        >
          Approuvées ({requests.filter(r => r.status === 'approved').length})
        </button>
        <button 
          className={filter === 'rejected' ? 'active' : ''}
          onClick={() => setFilter('rejected')}
        >
          Rejetées ({requests.filter(r => r.status === 'rejected').length})
        </button>
        <button 
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          Toutes ({requests.length})
        </button>
      </div>

      <div className="requests-list">
        {filteredRequests.length === 0 ? (
          <div className="empty-requests">
            {filter === 'pending' && 'Aucune demande en attente'}
            {filter === 'approved' && 'Aucune demande approuvée'}
            {filter === 'rejected' && 'Aucune demande rejetée'}
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
                <div className="request-detail-item">
                  <span className="request-detail-label">Début</span>
                  <span className="request-detail-value">
                    {formatDate(request.startDate)} - {formatPeriod(request.startPeriod)}
                  </span>
                </div>
                <div className="request-detail-item">
                  <span className="request-detail-label">Fin</span>
                  <span className="request-detail-value">
                    {formatDate(request.endDate)} - {formatPeriod(request.endPeriod)}
                  </span>
                </div>
                {request.clientName && (
                  <div className="request-detail-item">
                    <span className="request-detail-label">Client</span>
                    <span className="request-detail-value">{request.clientName}</span>
                  </div>
                )}
                {request.driverName && (
                  <div className="request-detail-item">
                    <span className="request-detail-label">Conducteur</span>
                    <span className="request-detail-value">{request.driverName}</span>
                  </div>
                )}
                {request.locationName && (
                  <div className="request-detail-item">
                    <span className="request-detail-label">Lieu</span>
                    <span className="request-detail-value">{request.locationName}</span>
                  </div>
                )}
                {request.prestationName && (
                  <div className="request-detail-item">
                    <span className="request-detail-label">Prestation</span>
                    <span className="request-detail-value">{request.prestationName}</span>
                  </div>
                )}
              </div>

              {request.notes && (
                <div className="request-notes">
                  <strong>Notes:</strong> {request.notes}
                </div>
              )}

              {request.status === 'rejected' && request.rejectionReason && (
                <div className="rejection-reason">
                  <strong>Motif du rejet:</strong>
                  {request.rejectionReason}
                </div>
              )}

              {request.status === 'pending' && (
                <div className="request-actions">
                  <button 
                    className="approve-button"
                    onClick={() => handleApprove(request.id)}
                    disabled={loading}
                  >
                    <Check size={18} />
                    Approuver
                  </button>
                  <button 
                    className="reject-button"
                    onClick={() => handleRejectClick(request)}
                    disabled={loading}
                  >
                    <X size={18} />
                    Rejeter
                  </button>
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
          <div className="reject-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Rejeter la demande</h3>
            <textarea
              placeholder="Indiquez le motif du rejet..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div className="reject-dialog-actions">
              <button 
                className="cancel"
                onClick={() => setRejectDialogOpen(false)}
              >
                Annuler
              </button>
              <button 
                className="confirm"
                onClick={handleRejectConfirm}
                disabled={loading}
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationRequestsPanel;
