import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, MapPin, Users, FileText, Folder, ExternalLink, Edit, Trash2, Plus, Link as LinkIcon } from 'lucide-react';
import './EventDetailsModal.css';

function EventDetailsModal({ 
  isOpen, 
  onClose, 
  event, 
  reservations = [], 
  onRequestEditReservation,
  onEventCreated,
  onEventUpdated
}) {
  const [linkedReservations, setLinkedReservations] = useState([]);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [showActions, setShowActions] = useState(true);

  useEffect(() => {
    if (event && reservations) {
      // Trouver toutes les réservations liées à cet événement
      const linked = reservations.filter(r => r.googleEventId === event.id);
      setLinkedReservations(linked);
    }
  }, [event, reservations]);

  useEffect(() => {
    if (event && event.affaire) {
      // Scanner le dossier pour trouver les BL et pièces jointes
      scanAttachmentFolder(event.affaire);
    }
  }, [event]);

  const scanAttachmentFolder = async (affaire) => {
    try {
      // Implémenter la recherche de fichiers dans le dossier public/attachments/{affaire}
      // Pour l'instant, simuler avec des exemples
      setAttachmentFiles([
        // { name: 'BL_001.pdf', type: 'pdf', size: '2.3 MB' },
        // { name: 'Facture.pdf', type: 'pdf', size: '1.1 MB' }
      ]);
    } catch (error) {
      console.error('Erreur scan dossier:', error);
    }
  };

  const handleOpenFolder = () => {
    if (!event || !event.affaire) return;
    
    // Ouvrir le dossier dans le Finder (macOS) ou Explorer (Windows)
    const folderPath = `/Users/reunion/Resevation Véhicules/public/attachments/${event.affaire}`;
    
    // Utiliser l'API Electron ou shell si disponible, sinon afficher un message
    if (window.electron && window.electron.shell) {
      window.electron.shell.openPath(folderPath);
    } else {
      alert(`Dossier: ${folderPath}\n\nVeuillez ouvrir ce dossier manuellement.`);
    }
  };

  const handleCreateReservation = () => {
    // Ouvrir le modal AffaireImportModal ou créer une réservation
    if (onEventCreated) {
      onEventCreated(event);
    }
  };

  const handleEditReservation = (reservation) => {
    if (onRequestEditReservation) {
      onRequestEditReservation(reservation.id);
    }
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return '';
    try {
      const date = parseISO(dateTimeString);
      return format(date, "dd MMMM yyyy 'à' HH:mm", { locale: fr });
    } catch {
      return dateTimeString;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = parseISO(dateString);
      return format(date, "dd MMMM yyyy", { locale: fr });
    } catch {
      return dateString;
    }
  };

  if (!isOpen || !event) return null;

  const startDate = event.start?.dateTime 
    ? formatDateTime(event.start.dateTime) 
    : event.start?.date ? formatDate(event.start.date) : '';
  
  const endDate = event.end?.dateTime 
    ? formatDateTime(event.end.dateTime) 
    : event.end?.date ? formatDate(event.end.date) : '';

  return (
    <div className="event-details-overlay" onClick={onClose}>
      <div className="event-details-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="event-details-header">
          <div className="event-title-section">
            <Calendar size={24} />
            <div>
              <h2>{event.summary || '(Sans titre)'}</h2>
              {event.affaire && <span className="event-affaire-badge">{event.affaire}</span>}
            </div>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="event-details-body">
          {/* Informations de l'événement */}
          <section className="event-info-section">
            <h3><FileText size={18} /> Informations</h3>
            <div className="event-info-grid">
              <div className="info-item">
                <label>Début</label>
                <span>{startDate}</span>
              </div>
              <div className="info-item">
                <label>Fin</label>
                <span>{endDate}</span>
              </div>
              {event.location && (
                <div className="info-item full-width">
                  <label><MapPin size={14} /> Lieu</label>
                  <span>{event.location}</span>
                </div>
              )}
              {event.description && (
                <div className="info-item full-width">
                  <label>Description</label>
                  <p className="event-description">{event.description}</p>
                </div>
              )}
            </div>
          </section>

          {/* Réservations liées */}
          <section className="linked-reservations-section">
            <div className="section-header">
              <h3>
                <LinkIcon size={18} />
                Réservations liées ({linkedReservations.length})
              </h3>
              <button 
                className="btn-add-reservation" 
                onClick={handleCreateReservation}
                title="Créer une réservation"
              >
                <Plus size={16} />
                Nouvelle réservation
              </button>
            </div>
            
            {linkedReservations.length === 0 ? (
              <div className="empty-state">
                <p>Aucune réservation liée à cet événement</p>
              </div>
            ) : (
              <div className="reservations-list">
                {linkedReservations.map((reservation) => (
                  <div key={reservation.id} className="reservation-card">
                    <div className="reservation-info">
                      <div className="reservation-vehicle">{reservation.vehicleName || reservation.vehicleId}</div>
                      <div className="reservation-details">
                        <span>{reservation.clientName}</span>
                        {reservation.driverName && <span> • {reservation.driverName}</span>}
                        {reservation.locationName && <span> • {reservation.locationName}</span>}
                      </div>
                      <div className="reservation-dates">
                        {reservation.startDate} ({reservation.startPeriod}) → {reservation.endDate} ({reservation.endPeriod})
                      </div>
                    </div>
                    <button 
                      className="btn-edit-reservation" 
                      onClick={() => handleEditReservation(reservation)}
                      title="Modifier"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* BL et pièces jointes */}
          <section className="attachments-section">
            <div className="section-header">
              <h3>
                <Folder size={18} />
                Pièces jointes {event.affaire && `(${event.affaire})`}
              </h3>
              <button 
                className="btn-open-folder" 
                onClick={handleOpenFolder}
                title="Ouvrir le dossier"
                disabled={!event.affaire}
              >
                <Folder size={16} />
                Ouvrir dossier
              </button>
            </div>
            
            {attachmentFiles.length === 0 ? (
              <div className="empty-state">
                <p>Aucune pièce jointe trouvée</p>
                {event.affaire && (
                  <p className="hint">
                    Les fichiers doivent être placés dans : 
                    <code>public/attachments/{event.affaire}/</code>
                  </p>
                )}
              </div>
            ) : (
              <div className="attachments-list">
                {attachmentFiles.map((file, index) => (
                  <div key={index} className="attachment-item">
                    <FileText size={16} />
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{file.size}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer Actions */}
        <div className="event-details-footer">
          <button className="btn-secondary" onClick={onClose}>
            Fermer
          </button>
          <div className="footer-actions">
            {event.htmlLink && (
              <a 
                href={event.htmlLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-link"
                title="Ouvrir dans Google Calendar"
              >
                <ExternalLink size={16} />
                Voir dans Google Calendar
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventDetailsModal;
