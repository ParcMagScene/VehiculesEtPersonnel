import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, MapPin, Users, FileText, Folder, ExternalLink, Edit, Trash2, Plus, Link as LinkIcon, X, Check, HardDrive, Pencil } from 'lucide-react';
import { getApiUrl } from '../utils/api';
import './EventDetailsModal.css';
import { useToast } from '../hooks/useToast';

const API_BASE_URL = getApiUrl();

function EventDetailsModal({ 
  isOpen, 
  onClose, 
  event, 
  reservations = [], 
  onRequestEditReservation,
  onRequestCreateReservation,
  onEventCreated,
  onEventUpdated,
  onRequestEditEvent,
  onRequestDeleteEvent,
  onReservationsRefresh,
  currentUser
}) {
  const toast = useToast();
  const [linkedReservations, setLinkedReservations] = useState([]);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [showActions, setShowActions] = useState(true);
  const [previewFile, setPreviewFile] = useState(null);
  const [showFolderView, setShowFolderView] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingDriveLink, setEditingDriveLink] = useState(null); // { reservationId, index, url, label } (index = -1 pour nouveau)
  const [savingDriveLink, setSavingDriveLink] = useState(false);

  // Parser les liens Drive (rétrocompatible avec ancien format string simple)
  const parseDriveLinks = (reservation) => {
    const raw = reservation.googleDriveLinks;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    // Fallback sur ancien champ string
    const link = reservation.googleDriveLink;
    if (!link) return [];
    try {
      const parsed = JSON.parse(link);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
    return link.trim() ? [{ url: link.trim(), label: '' }] : [];
  };

  // Collecter tous les liens Drive de toutes les réservations liées
  const getAllDriveLinks = () => {
    const links = [];
    linkedReservations.forEach(r => {
      parseDriveLinks(r).forEach((link, idx) => {
        links.push({ ...link, reservationId: r.id, index: idx });
      });
    });
    return links;
  };

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

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const scanAttachmentFolder = async (affaire) => {
    try {
      const response = await fetch(`${API_BASE_URL}/attachments/${affaire}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setAttachmentFiles(data.files || []);
      } else {
        setAttachmentFiles([]);
      }
    } catch (error) {
      console.error('Erreur chargement fichiers:', error);
      setAttachmentFiles([]);
    }
  };

  const handleOpenFolder = () => {
    if (!event || !event.affaire) return;
    setShowFolderView(true);
  };

  const handleFileClick = (file) => {
    setPreviewFile(file);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !event.affaire) return;

    setUploading(true);
    
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('affaireId', event.affaire);

        const response = await fetch(`${API_BASE_URL}/upload-attachment`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Échec de l'upload de ${file.name}`);
        }
      }
      
      // Recharger la liste des fichiers
      await scanAttachmentFolder(event.affaire);
      toast.info(`${files.length} fichier(s) uploadé(s) avec succès`);
    } catch (error) {
      console.error('Erreur upload:', error);
      toast.error('Erreur lors de l\'upload des fichiers');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleDeleteAttachment = async (file) => {
    if (!event.affaire) return;
    if (!confirm(`Supprimer "${file.name}" ?`)) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/attachments/${encodeURIComponent(event.affaire)}/${encodeURIComponent(file.name)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        await scanAttachmentFolder(event.affaire);
      } else {
        toast.error('Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Erreur suppression pièce jointe:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleCreateReservation = () => {
    // Ouvrir le modal de création de réservation classique
    if (onRequestCreateReservation) {
      onRequestCreateReservation(event);
    }
    onClose();
  };

  const handleImportBL = () => {
    // Ouvrir le modal d'import de BL (AffaireImportModal)
    if (onEventCreated) {
      onEventCreated(event);
    }
    onClose();
  };

  const handleEditReservation = (reservation) => {
    if (onRequestEditReservation) {
      onRequestEditReservation(reservation.id);
    }
  };

  const handleStartEditDriveLink = (reservationId, index, currentLink) => {
    setEditingDriveLink({
      reservationId,
      index, // -1 = nouveau lien
      url: currentLink?.url || '',
      label: currentLink?.label || ''
    });
  };

  const handleStartAddDriveLink = () => {
    // Ajouter un lien sur la première réservation liée
    const targetReservation = linkedReservations[0];
    if (!targetReservation) return;
    setEditingDriveLink({
      reservationId: targetReservation.id,
      index: -1,
      url: '',
      label: ''
    });
  };

  const handleCancelEditDriveLink = () => {
    setEditingDriveLink(null);
  };

  const handleSaveDriveLink = async () => {
    if (!editingDriveLink) return;
    const { reservationId, index, url, label } = editingDriveLink;
    if (!url.trim()) {
      toast.warning('Veuillez saisir une URL');
      return;
    }
    setSavingDriveLink(true);
    try {
      // Récupérer les liens actuels de cette réservation
      const reservation = linkedReservations.find(r => r.id === reservationId);
      const currentLinks = reservation ? [...parseDriveLinks(reservation)] : [];
      
      if (index === -1) {
        // Ajout d'un nouveau lien
        currentLinks.push({ url: url.trim(), label: label.trim() });
      } else {
        // Modification d'un lien existant
        currentLinks[index] = { url: url.trim(), label: label.trim() };
      }
      
      const response = await fetch(`${API_BASE_URL}/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ google_drive_links: currentLinks })
      });
      if (response.ok) {
        const data = await response.json();
        setLinkedReservations(prev => prev.map(r => 
          r.id === reservationId ? { ...r, googleDriveLinks: data.googleDriveLinks, googleDriveLink: data.googleDriveLink } : r
        ));
        setEditingDriveLink(null);
        // Rafraîchir les réservations du parent pour que les liens soient à jour partout
        if (onReservationsRefresh) onReservationsRefresh();
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(`Erreur lors de la sauvegarde: ${errorData.error || response.statusText || 'Erreur inconnue'}`);
      }
    } catch (error) {
      console.error('Erreur sauvegarde lien Drive:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSavingDriveLink(false);
    }
  };

  const handleDeleteDriveLink = async (reservationId, linkIndex) => {
    if (!confirm('Supprimer ce lien Google Drive ?')) return;
    setSavingDriveLink(true);
    try {
      const reservation = linkedReservations.find(r => r.id === reservationId);
      const currentLinks = reservation ? [...parseDriveLinks(reservation)] : [];
      currentLinks.splice(linkIndex, 1);
      
      const response = await fetch(`${API_BASE_URL}/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ google_drive_links: currentLinks })
      });
      if (response.ok) {
        const data = await response.json();
        setLinkedReservations(prev => prev.map(r => 
          r.id === reservationId ? { ...r, googleDriveLinks: data.googleDriveLinks, googleDriveLink: data.googleDriveLink } : r
        ));
        // Rafraîchir les réservations du parent
        if (onReservationsRefresh) onReservationsRefresh();
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(`Erreur: ${errorData.error || response.statusText || 'Erreur inconnue'}`);
      }
    } catch (error) {
      console.error('Erreur suppression lien Drive:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setSavingDriveLink(false);
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
              {currentUser?.isAdmin && (
                <button 
                  className="btn-add-reservation" 
                  onClick={handleCreateReservation}
                  title="Créer une réservation"
                >
                  <Plus size={16} />
                  Nouvelle réservation
                </button>
              )}
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
                      <div className="reservation-vehicle">{reservation.vehicleName || reservation.prestationName || reservation.clientName || reservation.vehicleId}</div>
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
                      title={currentUser?.isAdmin ? "Modifier" : "Voir"}
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Liens Google Drive */}
          {linkedReservations.length > 0 && (
            <section className="drive-links-section">
              <div className="section-header">
                <h3>
                  <HardDrive size={18} />
                  Liens Google Drive
                </h3>
                {currentUser?.isAdmin && !editingDriveLink && (
                  <button
                    className="btn-add-drive-link"
                    onClick={handleStartAddDriveLink}
                    title="Ajouter un lien Google Drive"
                  >
                    <Plus size={16} />
                    Ajouter un lien
                  </button>
                )}
              </div>

              {/* Formulaire d'ajout / édition */}
              {editingDriveLink && (
                <div className="drive-link-edit-form" onClick={(e) => e.stopPropagation()}>
                  <div className="drive-link-edit-row">
                    <input
                      type="url"
                      className="drive-link-input"
                      value={editingDriveLink.url}
                      onChange={(e) => setEditingDriveLink({ ...editingDriveLink, url: e.target.value })}
                      placeholder="https://drive.google.com/..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveDriveLink();
                        if (e.key === 'Escape') handleCancelEditDriveLink();
                      }}
                    />
                  </div>
                  <div className="drive-link-edit-row">
                    <input
                      type="text"
                      className="drive-link-input drive-link-label-input"
                      value={editingDriveLink.label}
                      onChange={(e) => setEditingDriveLink({ ...editingDriveLink, label: e.target.value })}
                      placeholder="Libellé (optionnel, ex: Photos, Devis...)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveDriveLink();
                        if (e.key === 'Escape') handleCancelEditDriveLink();
                      }}
                    />
                    <div className="drive-link-edit-actions">
                      <button
                        className="drive-link-btn drive-link-save"
                        onClick={handleSaveDriveLink}
                        disabled={savingDriveLink}
                        title="Enregistrer"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        className="drive-link-btn drive-link-cancel"
                        onClick={handleCancelEditDriveLink}
                        title="Annuler"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Liste des liens */}
              {(() => {
                const allLinks = getAllDriveLinks();
                if (allLinks.length === 0 && !editingDriveLink) {
                  return (
                    <div className="empty-state">
                      <p>Aucun lien Google Drive</p>
                    </div>
                  );
                }
                return (
                  <div className="drive-links-list">
                    {allLinks.map((link, idx) => (
                      <div key={`${link.reservationId}-${link.index}`} className="drive-link-item">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="drive-link-url"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={14} />
                          <span className="drive-link-text">
                            {link.label || link.url.replace(/^https?:\/\/(drive\.google\.com\/)?/, '').substring(0, 50) + (link.url.length > 60 ? '...' : '')}
                          </span>
                        </a>
                        {currentUser?.isAdmin && (
                          <div className="drive-link-item-actions">
                            <button
                              className="drive-link-item-btn drive-link-item-edit"
                              onClick={() => handleStartEditDriveLink(link.reservationId, link.index, link)}
                              title="Modifier"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              className="drive-link-item-btn drive-link-item-delete"
                              onClick={() => handleDeleteDriveLink(link.reservationId, link.index)}
                              title="Supprimer"
                              disabled={savingDriveLink}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>
          )}

          {/* BL et pièces jointes */}
          <section className="attachments-section">
            <div className="section-header">
              <h3>
                <Folder size={18} />
                Pièces jointes {event.affaire && `(${event.affaire})`}
              </h3>
              <div className="section-actions">
                {currentUser?.isAdmin && (
                  <>
                    <button 
                      className="btn-import-bl" 
                      onClick={handleImportBL}
                      title="Importer un BL"
                      disabled={!event.affaire}
                    >
                      <FileText size={16} />
                      Importer BL
                    </button>
                    <label 
                      className={`btn-open-folder ${!event.affaire || uploading ? 'disabled' : ''}`}
                      title="Joindre des fichiers"
                      style={{ cursor: !event.affaire || uploading ? 'not-allowed' : 'pointer' }}
                    >
                      <Plus size={16} />
                      {uploading ? 'Upload...' : 'Joindre fichiers'}
                      <input 
                        type="file" 
                        multiple 
                        onChange={handleFileUpload}
                        disabled={!event.affaire || uploading}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </>
                )}
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
            </div>
            
            {attachmentFiles.length === 0 ? (
              <div className="empty-state">
                <p>Aucune pièce jointe trouvée</p>
                {event.affaire && (
                  <p className="hint">
                    Cliquez sur "Joindre fichiers" pour ajouter des documents
                  </p>
                )}
              </div>
            ) : (
              <div className="attachments-list">
                {attachmentFiles.map((file, index) => (
                  <div 
                    key={index} 
                    className="attachment-item clickable"
                    onClick={() => handleFileClick(file)}
                    title="Cliquer pour prévisualiser"
                  >
                    <FileText size={16} />
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{file.size}</span>
                    {currentUser?.isAdmin && (
                      <button
                        className="btn-delete-attachment"
                        onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(file); }}
                        title="Supprimer cette pièce jointe"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
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
            {currentUser?.isAdmin && onRequestDeleteEvent && (
              <button
                className="btn-danger"
                onClick={() => {
                  if (confirm('Supprimer cet événement du Google Calendar ?')) {
                    onRequestDeleteEvent(event.id);
                  }
                }}
                title="Supprimer l'événement"
              >
                <Trash2 size={16} />
                Supprimer
              </button>
            )}
            {currentUser?.isAdmin && onRequestEditEvent && (
              <button
                className="btn-edit-event"
                onClick={() => onRequestEditEvent(event)}
                title="Modifier l'événement"
              >
                <Pencil size={16} />
                Modifier
              </button>
            )}
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

      {/* Modal d'aperçu de fichier */}
      {previewFile && (
        <div className="modal-overlay" onClick={() => setPreviewFile(null)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <h3>{previewFile.name}</h3>
              <button onClick={() => setPreviewFile(null)} className="btn-close">×</button>
            </div>
            <div className="preview-body">
              {previewFile.name.toLowerCase().endsWith('.pdf') ? (
                <iframe 
                  src={previewFile.url} 
                  title={previewFile.name}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : previewFile.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img 
                  src={previewFile.url} 
                  alt={previewFile.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div className="unsupported-preview">
                  <FileText size={48} />
                  <p>Aperçu non disponible pour ce type de fichier</p>
                  <a href={previewFile.url} download className="btn-primary">
                    Télécharger
                  </a>
                </div>
              )}
            </div>
            <div className="preview-footer">
              <span className="file-info">{previewFile.size}</span>
              <a href={previewFile.url} download className="btn-secondary">
                Télécharger
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal de vue dossier virtuel */}
      {showFolderView && (
        <div className="modal-overlay" onClick={() => setShowFolderView(false)}>
          <div className="folder-view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="folder-header">
              <h3>
                <Folder size={20} />
                Dossier : {event.affaire}
              </h3>
              <button onClick={() => setShowFolderView(false)} className="btn-close">×</button>
            </div>
            <div className="folder-body">
              {attachmentFiles.length === 0 ? (
                <div className="empty-folder">
                  <Folder size={48} />
                  <p>Aucun fichier dans ce dossier</p>
                </div>
              ) : (
                <div className="folder-files-grid">
                  {attachmentFiles.map((file, index) => (
                    <div 
                      key={index} 
                      className="folder-file-card"
                      onClick={() => {
                        setShowFolderView(false);
                        handleFileClick(file);
                      }}
                    >
                      <button
                        className="folder-file-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAttachment(file);
                        }}
                        title={`Supprimer ${file.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                      <div className="file-icon">
                        {file.name.toLowerCase().endsWith('.pdf') ? (
                          <FileText size={32} />
                        ) : file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img src={file.url} alt={file.name} className="file-thumbnail" />
                        ) : (
                          <FileText size={32} />
                        )}
                      </div>
                      <div className="file-info">
                        <p className="file-name" title={file.name}>{file.name}</p>
                        <p className="file-size">{file.size}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="folder-footer">
              <span>{attachmentFiles.length} fichier(s)</span>
              <label className="btn-primary">
                <Plus size={16} />
                Ajouter fichiers
                <input 
                  type="file" 
                  multiple 
                  onChange={handleFileUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventDetailsModal;
