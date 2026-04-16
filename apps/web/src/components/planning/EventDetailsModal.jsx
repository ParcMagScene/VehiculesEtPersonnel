import './EventDetailsModal.css';

import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Briefcase,
  Calendar,
  Check,
  Edit,
  ExternalLink,
  FileText,
  Folder,
  HardDrive,
  Link as LinkIcon,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import React, { lazy, Suspense, useEffect, useState } from 'react';

import { Button, Input, ModalLayout, SectionHeader, Tooltip } from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import AffaireBadge from '../AffaireBadge';

const BLImportModal = lazy(() => import('../affaires/BLImportModal'));
const DynamicDisplayDialog = lazy(() => import('../DynamicDisplayDialog'));

function EventDetailsModal({
  isOpen,
  onClose,
  event,
  reservations = [],
  onRequestEditReservation,
  onRequestCreateReservation,
  onRequestCreateAssignment,
  onEventCreated,
  _onEventUpdated,
  onRequestEditEvent,
  onRequestDeleteEvent,
  onReservationsRefresh,
  currentUser,
  activeModule,
}) {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [linkedReservations, setLinkedReservations] = useState([]);
  const [linkedAffaires, setLinkedAffaires] = useState([]);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [showFolderView, setShowFolderView] = useState(false);
  const [showBLImport, setShowBLImport] = useState(false);
  const [showDisplayDialog, setShowDisplayDialog] = useState(false);
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
    } catch {
      /* ignore */
    }
    return link.trim() ? [{ url: link.trim(), label: '' }] : [];
  };

  // Collecter tous les liens Drive de toutes les réservations liées
  const getAllDriveLinks = () => {
    const links = [];
    linkedReservations.forEach((r) => {
      parseDriveLinks(r).forEach((link, idx) => {
        links.push({ ...link, reservationId: r.id, index: idx });
      });
    });
    return links;
  };

  useEffect(() => {
    if (event && reservations) {
      // Trouver toutes les réservations liées à cet événement
      const linked = reservations.filter((r) => r.googleEventId === event.id);
      setLinkedReservations(linked);
    }
  }, [event, reservations]);

  // Charger les affaires liées à cet événement (par numéro d'affaire ou google_event_id)
  useEffect(() => {
    if (!event) {
      setLinkedAffaires([]);
      return;
    }
    const loadLinkedAffaires = async () => {
      try {
        const allAffaires = await api.getAffaires();
        const affaires = Array.isArray(allAffaires) ? allAffaires : [];
        const linked = affaires.filter((a) => {
          // Lien par google_event_id
          if (a.googleEventId && a.googleEventId === event.id) return true;
          // Lien par numéro d'affaire détecté dans le titre
          if (
            event.affaire &&
            a.numeroAffaire &&
            a.numeroAffaire.toUpperCase() === event.affaire.toUpperCase()
          )
            return true;
          return false;
        });
        setLinkedAffaires(linked);
      } catch (err) {
        console.error('Erreur chargement affaires liées:', err);
        setLinkedAffaires([]);
      }
    };
    loadLinkedAffaires();
  }, [event]);

  useEffect(() => {
    if (event && event.affaire) {
      // Scanner le dossier pour trouver les BL et pièces jointes
      scanAttachmentFolder(event.affaire);
    }
  }, [event]);

  const scanAttachmentFolder = async (affaire) => {
    try {
      const data = await api.getAttachments(affaire);
      setAttachmentFiles(data.files || []);
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
        await api.uploadAttachment(file, event.affaire);
      }

      // Recharger la liste des fichiers
      await scanAttachmentFolder(event.affaire);
      toast.info(`${files.length} fichier(s) uploadé(s) avec succès`);
    } catch (error) {
      console.error('Erreur upload:', error);
      toast.error("Erreur lors de l'upload des fichiers");
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleDeleteAttachment = (file) => {
    if (!event.affaire) return;
    confirm({
      title: 'Supprimer la pièce jointe',
      message: `Supprimer "${file.name}" ?`,
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try {
          await api.deleteAttachment(event.affaire, file.name);
          await scanAttachmentFolder(event.affaire);
        } catch (error) {
          console.error('Erreur suppression pièce jointe:', error);
          toast.error('Erreur lors de la suppression');
        }
      },
    });
  };

  const handleCreateReservation = () => {
    // Ouvrir le modal de création de réservation classique
    if (onRequestCreateReservation) {
      onRequestCreateReservation(event);
    }
    onClose();
  };

  const handleCreateAssignment = () => {
    // Ouvrir le dialog d'affectation personnel
    if (onRequestCreateAssignment) {
      onRequestCreateAssignment(event);
    }
    onClose();
  };

  // Bouton contextuel : label et handler selon le module actif
  const isPersonnelMode = activeModule === 'personnel';
  const actionLabel = isPersonnelMode ? 'Nouvelle affectation' : 'Nouvelle réservation';
  const actionHandler = isPersonnelMode ? handleCreateAssignment : handleCreateReservation;

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
      label: currentLink?.label || '',
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
      label: '',
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
      const reservation = linkedReservations.find((r) => r.id === reservationId);
      const currentLinks = reservation ? [...parseDriveLinks(reservation)] : [];

      if (index === -1) {
        // Ajout d'un nouveau lien
        currentLinks.push({ url: url.trim(), label: label.trim() });
      } else {
        // Modification d'un lien existant
        currentLinks[index] = { url: url.trim(), label: label.trim() };
      }

      const data = await api.patchReservation(reservationId, { google_drive_links: currentLinks });
      setLinkedReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? {
                ...r,
                googleDriveLinks: data.googleDriveLinks,
                googleDriveLink: data.googleDriveLink,
              }
            : r,
        ),
      );
      setEditingDriveLink(null);
      // Rafraîchir les réservations du parent pour que les liens soient à jour partout
      if (onReservationsRefresh) onReservationsRefresh();
    } catch (error) {
      console.error('Erreur sauvegarde lien Drive:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSavingDriveLink(false);
    }
  };

  const handleDeleteDriveLink = (reservationId, linkIndex) => {
    confirm({
      title: 'Supprimer le lien',
      message: 'Supprimer ce lien Google Drive ?',
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        setSavingDriveLink(true);
        try {
          const reservation = linkedReservations.find((r) => r.id === reservationId);
          const currentLinks = reservation ? [...parseDriveLinks(reservation)] : [];
          currentLinks.splice(linkIndex, 1);

          const data = await api.patchReservation(reservationId, {
            google_drive_links: currentLinks,
          });
          setLinkedReservations((prev) =>
            prev.map((r) =>
              r.id === reservationId
                ? {
                    ...r,
                    googleDriveLinks: data.googleDriveLinks,
                    googleDriveLink: data.googleDriveLink,
                  }
                : r,
            ),
          );
          // Rafraîchir les réservations du parent
          if (onReservationsRefresh) onReservationsRefresh();
        } catch (error) {
          console.error('Erreur suppression lien Drive:', error);
          toast.error('Erreur lors de la suppression');
        } finally {
          setSavingDriveLink(false);
        }
      },
    });
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
      return format(date, 'dd MMMM yyyy', { locale: fr });
    } catch {
      return dateString;
    }
  };

  if (!isOpen || !event) return null;

  const startDate = event.start?.dateTime
    ? formatDateTime(event.start.dateTime)
    : event.start?.date
      ? formatDate(event.start.date)
      : '';

  const endDate = event.end?.dateTime
    ? formatDateTime(event.end.dateTime)
    : event.end?.date
      ? formatDate(event.end.date)
      : '';

  return (
    <>
      <ModalLayout
        open
        onClose={onClose}
        title={
          <div className="event-title-section">
            <div>
              {event.summary || '(Sans titre)'}
              {event.affaire && <AffaireBadge numero={event.affaire} className="inverted" />}
            </div>
          </div>
        }
        icon={<Calendar size={24} />}
        size="lg"
        className="event-details-modal"
        footer={
          event.htmlLink ? (
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
          ) : null
        }
      >
        {/* Body */}
        <div className="event-details-body">
          {/* Informations de l'événement */}
          <section className="event-info-section">
            <h3>
              <FileText size={18} /> Informations
            </h3>
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
                  <label>
                    <MapPin size={14} /> Lieu
                  </label>
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

          {/* Affaires liées */}
          {linkedAffaires.length > 0 && (
            <section className="linked-affaires-section">
              <SectionHeader
                icon={<Briefcase size={18} />}
                title="Affaires liées"
                count={linkedAffaires.length}
              />
              <div className="affaires-list">
                {linkedAffaires.map((affaire) => (
                  <div key={affaire.id || affaire.numeroAffaire} className="affaire-card">
                    <div className="affaire-info">
                      <AffaireBadge
                        numero={affaire.numeroAffaire}
                        type={affaire.type}
                        size="md"
                        showIcon
                      />
                      <div className="affaire-details">
                        {affaire.client && <span className="affaire-client">{affaire.client}</span>}
                        {affaire.titre && <span className="affaire-titre">{affaire.titre}</span>}
                        {affaire.dateDebut && (
                          <span className="affaire-dates">
                            {affaire.dateDebut}
                            {affaire.dateFin ? ` → ${affaire.dateFin}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="affaire-stats">
                      {affaire.reservationCount > 0 && (
                        <Tooltip content="Réservations" position="bottom">
                          <span className="affaire-stat">🚛 {affaire.reservationCount}</span>
                        </Tooltip>
                      )}
                      {affaire.personnelCount > 0 && (
                        <Tooltip content="Personnel affecté" position="bottom">
                          <span className="affaire-stat">👷 {affaire.personnelCount}</span>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Réservations liées */}
          <section className="linked-reservations-section">
            <SectionHeader
              icon={<LinkIcon size={18} />}
              title="Réservations liées"
              count={linkedReservations.length}
              actions={
                currentUser?.isAdmin && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="btn-add-reservation"
                    onClick={actionHandler}
                    title={actionLabel}
                  >
                    <Plus size={16} />
                    {actionLabel}
                  </Button>
                )
              }
            />

            {linkedReservations.length === 0 ? (
              <div className="empty-state">
                <p>Aucune réservation liée à cet événement</p>
              </div>
            ) : (
              <div className="reservations-list">
                {linkedReservations.map((reservation) => (
                  <div key={reservation.id} className="reservation-card">
                    <div className="reservation-info">
                      <div className="reservation-vehicle">
                        {reservation.vehicleName ||
                          reservation.prestationName ||
                          reservation.clientName ||
                          reservation.vehicleId}
                      </div>
                      <div className="reservation-details">
                        <span>{reservation.clientName}</span>
                        {reservation.driverName && <span> • {reservation.driverName}</span>}
                        {reservation.locationName && <span> • {reservation.locationName}</span>}
                      </div>
                      <div className="reservation-dates">
                        {reservation.startDate} ({reservation.startPeriod}) → {reservation.endDate}{' '}
                        ({reservation.endPeriod})
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      className="btn-edit-reservation"
                      onClick={() => handleEditReservation(reservation)}
                      title={currentUser?.isAdmin ? 'Modifier' : 'Voir'}
                    >
                      <Edit size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Liens Google Drive */}
          {linkedReservations.length > 0 && (
            <section className="drive-links-section">
              <SectionHeader
                icon={<HardDrive size={18} />}
                title="Liens Google Drive"
                actions={
                  currentUser?.isAdmin &&
                  !editingDriveLink && (
                    <Tooltip content="Ajouter un lien Google Drive" position="bottom">
                      <Button
                        variant="primary"
                        size="sm"
                        className="btn-add-drive-link"
                        onClick={handleStartAddDriveLink}
                      >
                        <Plus size={16} />
                        Ajouter un lien
                      </Button>
                    </Tooltip>
                  )
                }
              />

              {/* Formulaire d'ajout / édition */}
              {editingDriveLink && (
                <div className="drive-link-edit-form" onClick={(e) => e.stopPropagation()}>
                  <div className="drive-link-edit-row">
                    <Input
                      type="url"
                      className="drive-link-input"
                      value={editingDriveLink.url}
                      onChange={(e) =>
                        setEditingDriveLink({ ...editingDriveLink, url: e.target.value })
                      }
                      placeholder="https://drive.google.com/..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveDriveLink();
                        if (e.key === 'Escape') handleCancelEditDriveLink();
                      }}
                    />
                  </div>
                  <div className="drive-link-edit-row">
                    <Input
                      type="text"
                      className="drive-link-input drive-link-label-input"
                      value={editingDriveLink.label}
                      onChange={(e) =>
                        setEditingDriveLink({ ...editingDriveLink, label: e.target.value })
                      }
                      placeholder="Libellé (optionnel, ex: Photos, Devis...)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveDriveLink();
                        if (e.key === 'Escape') handleCancelEditDriveLink();
                      }}
                    />
                    <div className="drive-link-edit-actions">
                      <Tooltip content="Enregistrer" position="bottom">
                        <Button
                          variant="ghost"
                          className="drive-link-btn drive-link-save"
                          onClick={handleSaveDriveLink}
                          disabled={savingDriveLink}
                        >
                          <Check size={14} />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Annuler" position="bottom">
                        <Button
                          variant="ghost"
                          className="drive-link-btn drive-link-cancel"
                          onClick={handleCancelEditDriveLink}
                        >
                          <X size={14} />
                        </Button>
                      </Tooltip>
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
                    {allLinks.map((link, _idx) => (
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
                            {link.label ||
                              link.url
                                .replace(/^https?:\/\/(drive\.google\.com\/)?/, '')
                                .substring(0, 50) + (link.url.length > 60 ? '...' : '')}
                          </span>
                        </a>
                        {currentUser?.isAdmin && (
                          <div className="drive-link-item-actions">
                            <Tooltip content="Modifier" position="bottom">
                              <Button
                                variant="ghost"
                                className="drive-link-item-btn drive-link-item-edit"
                                onClick={() =>
                                  handleStartEditDriveLink(link.reservationId, link.index, link)
                                }
                              >
                                <Edit size={13} />
                              </Button>
                            </Tooltip>
                            <Tooltip content="Supprimer" position="bottom">
                              <Button
                                variant="ghost"
                                className="drive-link-item-btn drive-link-item-delete"
                                onClick={() =>
                                  handleDeleteDriveLink(link.reservationId, link.index)
                                }
                                disabled={savingDriveLink}
                              >
                                <Trash2 size={13} />
                              </Button>
                            </Tooltip>
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
            <SectionHeader
              icon={<Folder size={18} />}
              title={<>Pièces jointes {event.affaire && `(${event.affaire})`}</>}
              actions={
                <div className="section-actions">
                  {currentUser?.isAdmin && (
                    <>
                      <Tooltip content="Importer un BL" position="bottom">
                        <Button
                          variant="ghost"
                          className="btn-import-bl"
                          onClick={handleImportBL}
                          disabled={!event.affaire}
                        >
                          <FileText size={16} />
                          Importer BL
                        </Button>
                      </Tooltip>
                      <Tooltip content="Joindre des fichiers" position="bottom">
                        <label
                          className={`btn-open-folder ${!event.affaire || uploading ? 'disabled' : ''}`}
                          style={{
                            cursor: !event.affaire || uploading ? 'not-allowed' : 'pointer',
                          }}
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
                      </Tooltip>
                    </>
                  )}
                  <Tooltip content="Ouvrir le dossier" position="bottom">
                    <Button
                      variant="ghost"
                      className="btn-open-folder"
                      onClick={handleOpenFolder}
                      disabled={!event.affaire}
                    >
                      <Folder size={16} />
                      Ouvrir dossier
                    </Button>
                  </Tooltip>
                </div>
              }
            />

            {attachmentFiles.length === 0 ? (
              <div className="empty-state">
                <p>Aucune pièce jointe trouvée</p>
                {event.affaire && (
                  <p className="hint">Cliquez sur "Joindre fichiers" pour ajouter des documents</p>
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
                      <Tooltip content="Supprimer cette pièce jointe" position="bottom">
                        <Button
                          variant="ghost"
                          className="btn-delete-attachment"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAttachment(file);
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer Actions */}
        <div className="event-details-footer">
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          <div className="footer-actions">
            <Tooltip content="Ajouter à l'affichage dynamique" position="bottom">
              <Button
                variant="ghost"
                className="btn-display-event"
                onClick={() => setShowDisplayDialog(true)}
              >
                📺 Affichage
              </Button>
            </Tooltip>
            <Tooltip content="Importer un BL pour cet événement" position="bottom">
              <Button
                variant="ghost"
                className="btn-bl-import"
                onClick={() => setShowBLImport(true)}
              >
                <FileText size={16} />
                Import BL
              </Button>
            </Tooltip>
            {currentUser?.isAdmin && onRequestDeleteEvent && (
              <Button
                variant="danger"
                onClick={() => {
                  confirm({
                    title: "Supprimer l'événement",
                    message: 'Supprimer cet événement du Google Calendar ?',
                    variant: 'danger',
                    confirmLabel: 'Supprimer',
                    onConfirm: () => {
                      onRequestDeleteEvent(event.id);
                    },
                  });
                }}
                title="Supprimer l'événement"
              >
                <Trash2 size={16} />
                Supprimer
              </Button>
            )}
            {currentUser?.isAdmin && onRequestEditEvent && (
              <Tooltip content="Modifier l'événement" position="bottom">
                <Button
                  variant="ghost"
                  className="btn-edit-event"
                  onClick={() => onRequestEditEvent(event)}
                >
                  <Pencil size={16} />
                  Modifier
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
      </ModalLayout>

      {/* BL Import Modal */}
      {showBLImport && (
        <Suspense fallback={null}>
          <BLImportModal
            onClose={() => setShowBLImport(false)}
            onImported={() => setShowBLImport(false)}
            defaultAffaireId={
              event?.summary
                ? (() => {
                    const m = event.summary.match(/\bAF\s*\d{4,}/i);
                    return m ? m[0].toUpperCase().replace(/\s+/g, '') : '';
                  })()
                : ''
            }
          />
        </Suspense>
      )}

      {/* Dynamic Display Dialog */}
      {showDisplayDialog && (
        <Suspense fallback={null}>
          <DynamicDisplayDialog
            defaultDate={event?.start?.date || event?.start?.dateTime?.slice(0, 10) || null}
            defaultAffaireId={
              event?.summary
                ? (() => {
                    const m = event.summary.match(/\bAF\s*\d{4,}/i);
                    return m ? m[0].toUpperCase().replace(/\s+/g, '') : '';
                  })()
                : ''
            }
            onSave={() => setShowDisplayDialog(false)}
            onClose={() => setShowDisplayDialog(false)}
          />
        </Suspense>
      )}

      {/* Modal d'aperçu de fichier */}
      {previewFile && (
        <ModalLayout
          open
          onClose={() => setPreviewFile(null)}
          title={previewFile.name}
          size="xl"
          className="preview-modal"
          footer={
            <>
              <span className="file-info">{previewFile.size}</span>
              <a href={previewFile.url} download className="btn-secondary">
                Télécharger
              </a>
            </>
          }
        >
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
                loading="lazy"
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
        </ModalLayout>
      )}

      {/* Modal de vue dossier virtuel */}
      {showFolderView && (
        <ModalLayout
          open
          onClose={() => setShowFolderView(false)}
          title={
            <>
              <Folder size={20} /> Dossier : {event.affaire}
            </>
          }
          size="lg"
          className="folder-view-modal"
          footer={
            <>
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
            </>
          }
        >
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
                    <Button
                      variant="ghost"
                      className="folder-file-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAttachment(file);
                      }}
                      title={`Supprimer ${file.name}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                    <div className="file-icon">
                      {file.name.toLowerCase().endsWith('.pdf') ? (
                        <FileText size={32} />
                      ) : file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img
                          src={file.url}
                          alt={file.name}
                          loading="lazy"
                          className="file-thumbnail"
                        />
                      ) : (
                        <FileText size={32} />
                      )}
                    </div>
                    <div className="file-info">
                      <p className="file-name" title={file.name}>
                        {file.name}
                      </p>
                      <p className="file-size">{file.size}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ModalLayout>
      )}

      {ConfirmDialogRenderer}
    </>
  );
}

export default React.memo(EventDetailsModal);
