import { useState, useEffect } from 'react';
import { Mail, UserPlus, Trash2, RefreshCw, Shield, User, Check, Clock, UserCheck, UserX, Bell, Pencil, ExternalLink, Users, Ban } from 'lucide-react';
import api from '../../utils/api';
import ProfileEditModal from '../auth/ProfileEditModal';
import './UserManagement.css';
import { useToast } from '../../hooks/useToast';
import { Button, ModalLayout, Input, Table, Checkbox, Tag, Card, Avatar , Tooltip} from '@/design-system';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { formatDateSimple } from '../../utils/formatUtils';

import { STATUS } from '../../constants';

const UserManagement = ({ onAccessRequestChange, onNavigateToPersonnel }) => {
  const toast = useToast();
  const [authorizedEmails, setAuthorizedEmails] = useState([]);
  const [users, setUsers] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [approveModal, setApproveModal] = useState(null); // { id, email, name }
  const [personModal, setPersonModal] = useState(null); // { user } pour création de fiche personnel
  const [personsMap, setPersonsMap] = useState({}); // user_id -> person
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();

  useEffect(() => {
    loadData();
    
    // Rafraîchir les données toutes les 30 secondes
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [emailsData, usersData, requestsData, personsData] = await Promise.all([
        api.getAuthorizedEmails(),
        api.getUsers(),
        api.getAccessRequests(),
        api.getPersons().catch(() => []),
      ]);
      setAuthorizedEmails(emailsData);
      setUsers(usersData);
      setAccessRequests(requestsData);
      // Construire la map user_id -> person
      const pMap = {};
      if (Array.isArray(personsData)) {
        for (const p of personsData) {
          if (p.userId) pMap[p.userId] = p;
        }
      }
      setPersonsMap(pMap);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEmail = async (e) => {
    e.preventDefault();
    if (!newEmail) return;

    try {
      await api.addAuthorizedEmail(newEmail);
      setNewEmail('');
      loadData();
    } catch (error) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const handleRemoveEmail = (id) => {
    confirm({
      title: 'Supprimer cet email',
      message: 'Supprimer cet email autorisé ?',
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try {
          await api.removeAuthorizedEmail(id);
          loadData();
        } catch (error) {
          toast.error(`Erreur: ${error.message}`);
        }
      },
    });
  };

  const handleToggleAdmin = (userId, currentIsAdmin) => {
    const action = currentIsAdmin ? 'retirer les droits admin' : 'donner les droits admin';
    confirm({
      title: 'Modifier les droits',
      message: `Voulez-vous vraiment ${action} à cet utilisateur ?`,
      variant: 'warning',
      confirmLabel: 'Confirmer',
      onConfirm: async () => {
        try {
          await api.updateUser(userId, { isAdmin: !currentIsAdmin });
          toast.success('Droits modifiés avec succès');
          loadData();
        } catch (error) {
          toast.error(`Erreur: ${error.message}`);
        }
      },
    });
  };

  const handleTogglePermission = async (userId, permissionKey, currentPermissions) => {
    const perms = currentPermissions || {};
    const newValue = !perms[permissionKey];
    const updatedPerms = { ...perms, [permissionKey]: newValue };
    
    try {
      await api.updateUser(userId, { permissions: updatedPerms });
      loadData();
    } catch (error) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const handleDeleteUser = (userId) => {
    confirm({
      title: 'Supprimer cet utilisateur',
      message: 'Voulez-vous vraiment supprimer cet utilisateur ? Cette action est irréversible.',
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try {
          await api.deleteUser(userId);
          toast.success('Utilisateur supprimé avec succès');
          loadData();
        } catch (error) {
          toast.error(`Erreur: ${error.message}`);
        }
      },
    });
  };

  const handleResetPassword = (userId) => {
    confirm({
      title: 'Réinitialiser le mot de passe',
      message: 'Marquer ce compte pour réinitialisation ? L\'utilisateur devra définir un nouveau mot de passe lors de sa prochaine connexion.',
      variant: 'confirm',
      confirmLabel: 'Réinitialiser',
      onConfirm: async () => {
        try {
          const response = await api.request(`/users/${userId}/reset-password`, {
            method: 'POST',
          });

          const data = response;
          toast.success(`Réinitialisation demandée L'utilisateur ${data.email} devra définir un nouveau mot de passe lors de sa prochaine connexion.`);
          loadData();
        } catch (error) {
          toast.error(`Erreur: ${error.message}`);
        }
      },
    });
  };

  const handleApproveRequest = async (requestId, requestEmail, requestName) => {
    // Ouvrir le modal d'approbation au lieu d'un confirm
    setApproveModal({ id: requestId, email: requestEmail, name: requestName });
  };

  const handleToggleBlock = (userId, currentlyBlocked) => {
    const action = currentlyBlocked ? 'Débloquer' : 'Bloquer';
    const message = currentlyBlocked
      ? 'Voulez-vous débloquer cet utilisateur ? Il pourra se reconnecter.'
      : 'Voulez-vous bloquer cet utilisateur ? Il sera immédiatement déconnecté et ne pourra plus se connecter.';
    confirm({
      title: `${action} cet utilisateur`,
      message,
      variant: currentlyBlocked ? 'confirm' : 'danger',
      confirmLabel: action,
      onConfirm: async () => {
        try {
          await api.updateUser(userId, { isBlocked: !currentlyBlocked });
          toast.success(`Utilisateur ${currentlyBlocked ? 'débloqué' : 'bloqué'} avec succès`);
          loadData();
        } catch (error) {
          toast.error(`Erreur: ${error.message}`);
        }
      },
    });
  };

  const handleConfirmApprove = async (giveAdmin, sendEmail) => {
    if (!approveModal) return;
    const { id, email: reqEmail, name: reqName } = approveModal;

    try {
      const _result = await api.updateAccessRequest(id, 'approved', giveAdmin);
      
      if (sendEmail) {
        // Construire l'URL de création de compte
        const appUrl = window.location.origin;
        const setupLink = `${appUrl}?setup=${encodeURIComponent(reqEmail)}`;
        
        // Construire le mail type
        const subject = encodeURIComponent('Votre accès eM@g - Réservation Véhicules');
        const body = encodeURIComponent(
          `Bonjour ${reqName},\n\n` +
          `Votre demande d'accès à l'application de réservation de véhicules a été approuvée !\n\n` +
          `Pour finaliser votre inscription, cliquez sur le lien ci-dessous et créez votre mot de passe :\n\n` +
          `${setupLink}\n\n` +
          `Ce lien vous amènera directement à la page de création de votre compte.\n\n` +
          `Cordialement,\n` +
          `L'équipe eM@g`
        );
        
        // Ouvrir Gmail compose dans un nouvel onglet
        const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(reqEmail)}&su=${subject}&body=${body}`;
        window.open(gmailUrl, '_blank');
      }
      
      setApproveModal(null);
      loadData();
      onAccessRequestChange?.();
    } catch (error) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const handleRejectRequest = (requestId) => {
    confirm({
      title: 'Rejeter la demande',
      message: 'Rejeter cette demande d\'accès ?',
      variant: 'warning',
      confirmLabel: 'Rejeter',
      onConfirm: async () => {
        try {
          await api.updateAccessRequest(requestId, 'rejected');
          toast.success('Demande rejetée');
          loadData();
          onAccessRequestChange?.();
        } catch (error) {
          toast.error(`Erreur: ${error.message}`);
        }
      },
    });
  };

  if (isLoading) {
    return <div className="user-management-loading">Chargement...</div>;
  }

  return (
    <div className="user-management">
      {/* Utilisateurs enregistrés */}
      <div className="user-management-section">
        <h3><User size={20} /> Utilisateurs</h3>

        <div className="users-list">
          {users.length === 0 ? (
            <p className="no-data">Aucun utilisateur</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Droits</th>
                  <th>Permissions</th>
                  <th style={{ width: '80px' }}>Actions</th>
                  <th style={{ width: '100px' }}>Personnel</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-name-cell">
                        <Avatar name={user.name} avatar={user.avatar} size={22} />
                        <span>{user.name}</span>
                        {user.isBlocked && <Tag variant="danger" size="sm">Bloqué</Tag>}
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <label className="admin-checkbox">
                        <Checkbox
                          checked={user.isAdmin || false}
                          onChange={() => handleToggleAdmin(user.id, user.isAdmin)}
                        />
                        <span className="checkbox-label">
                          {user.isAdmin ? (
                            <><Shield size={14} /> Admin</>
                          ) : (
                            <><User size={14} /> Utilisateur</>
                          )}
                        </span>
                      </label>
                    </td>
                    <td>
                      {!user.isAdmin && (
                        <div className="permissions-group">
 <Tooltip content="Autoriser la gestion des maintenances véhicules" position="bottom">
   <label className="permission-checkbox">
                            <Checkbox
                              checked={user.permissions?.can_manage_vehicle_maintenance || user.permissions?.can_manage_maintenance || false}
                              onChange={() => handleTogglePermission(user.id, 'can_manage_vehicle_maintenance', user.permissions)}
                            />
                            <span className="checkbox-label">
                              🚗 Maint. Véhicules
                            </span>
                          </label>
 </Tooltip>
 <Tooltip content="Autoriser la gestion des maintenances matériel (SAV)" position="bottom">
   <label className="permission-checkbox">
                            <Checkbox
                              checked={user.permissions?.can_manage_equipment_maintenance || false}
                              onChange={() => handleTogglePermission(user.id, 'can_manage_equipment_maintenance', user.permissions)}
                            />
                            <span className="checkbox-label">
                              🔧 Maint. Matériel
                            </span>
                          </label>
 </Tooltip>
 <Tooltip content="Autoriser la gestion du catalogue d'équipements et flight-cases" position="bottom">
   <label className="permission-checkbox">
                            <Checkbox
                              checked={user.permissions?.can_manage_catalog || false}
                              onChange={() => handleTogglePermission(user.id, 'can_manage_catalog', user.permissions)}
                            />
                            <span className="checkbox-label">
                              📦 Catalogue
                            </span>
                          </label>
 </Tooltip>
 <Tooltip content="Autoriser la gestion des modèles de camions" position="bottom">
   <label className="permission-checkbox">
                            <Checkbox
                              checked={user.permissions?.can_manage_trucks || false}
                              onChange={() => handleTogglePermission(user.id, 'can_manage_trucks', user.permissions)}
                            />
                            <span className="checkbox-label">
                              🚛 Camions
                            </span>
                          </label>
 </Tooltip>
                        </div>
                      )}
                      {user.isAdmin && (
                        <span className="all-permissions-label">Tous les droits</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <Tooltip content="Modifier le profil" position="bottom">
                          <Button
                          variant="primary" size="sm" iconOnly
                          onClick={() => setEditingUser(user)}
 
                          aria-label="Modifier le profil"
                        >
                          <Pencil size={14} />
                        </Button>
                        </Tooltip>
                        <Tooltip content="Réinitialiser - l'utilisateur devra définir un nouveau mot de passe" position="bottom">
                          <Button variant="ghost"                           onClick={() => handleResetPassword(user.id)}
                          className="btn-icon btn-warning"
 
                        >
                          <RefreshCw size={14} />
                        </Button>
                        </Tooltip>
                        <Tooltip content={user.isBlocked ? "Débloquer l'utilisateur" : "Bloquer l'utilisateur"} position="bottom">
                          <Button
                          variant={user.isBlocked ? "ghost" : "ghost"} size="sm" iconOnly
                          onClick={() => handleToggleBlock(user.id, user.isBlocked)}
                          className={user.isBlocked ? "btn-icon btn-success" : "btn-icon btn-warning"}
                          aria-label={user.isBlocked ? "Débloquer" : "Bloquer"}
                        >
                          <Ban size={14} />
                        </Button>
                        </Tooltip>
                        <Tooltip content="Supprimer l'utilisateur" position="bottom">
                          <Button
                          variant="danger" size="sm" iconOnly
                          onClick={() => handleDeleteUser(user.id)}
 
                          aria-label="Supprimer l'utilisateur"
                        >
                          <Trash2 size={14} />
                        </Button>
                        </Tooltip>
                      </div>
                    </td>
                    <td>
                      {personsMap[user.id] ? (
                        <Button variant="ghost"                           className="personnel-linked-badge clickable"
                          title={`Voir la fiche de ${personsMap[user.id].firstName} ${personsMap[user.id].lastName}`}
                          onClick={() => onNavigateToPersonnel && onNavigateToPersonnel(personsMap[user.id])}
                        >
                          <UserCheck size={13} />
                          <span>{personsMap[user.id].type === 'contractuel' ? 'Contractuel' : 'Permanent'}</span>
                          <ExternalLink size={11} />
                        </Button>
                      ) : (
                        <Tooltip content="Créer une fiche personnel pour cet utilisateur" position="bottom">
                          <Button variant="ghost"                           onClick={() => setPersonModal({ user })}
                          className="btn-create-personnel"
 
                        >
                          <Users size={13} /> Créer
                        </Button>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      {/* Emails autorisés */}
      <div className="user-management-section">
        <h3><Mail size={20} /> Emails autorisés</h3>
        
        <form onSubmit={handleAddEmail} className="add-email-form">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            required
          />
          <Button variant="ghost" type="submit">
            <UserPlus size={18} /> Autoriser
          </Button>
        </form>

        <div className="emails-list">
          {authorizedEmails.length === 0 ? (
            <p className="no-data">Aucun email autorisé</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Statut</th>
                  <th>Utilisateur</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {authorizedEmails.map((email) => (
                  <tr key={email.id}>
                    <td>{email.email}</td>
                    <td>
                      <Tag color={email.status === 'activated' ? 'success' : 'warning'} size="sm">
                        {email.status === 'activated' ? (
                          <><Check size={14} /> Activé</>
                        ) : (
                          <><Clock size={14} /> En attente</>
                        )}
                      </Tag>
                    </td>
                    <td>{email.userName || '-'}</td>
                    <td>
                      <Tooltip content="Supprimer" position="bottom">
                        <Button
                        variant="danger" size="sm" iconOnly
                        onClick={() => handleRemoveEmail(email.id)}
 
                        aria-label="Supprimer"
                      >
                        <Trash2 size={16} />
                      </Button>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      {/* Historique des demandes traitées */}
      {accessRequests.filter(r => r.status !== STATUS.PENDING).length > 0 && (
        <div className="user-management-section">
          <h3>Historique des demandes</h3>
          <div className="requests-history">
            <Table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Date demande</th>
                  <th>Statut</th>
                  <th>Traité par</th>
                  <th>Date traitement</th>
                </tr>
              </thead>
              <tbody>
                {accessRequests.filter(r => r.status !== STATUS.PENDING).map((request) => (
                  <tr key={request.id}>
                    <td>{request.name}</td>
                    <td>{request.email}</td>
                    <td>
                      {formatDateSimple(request.createdAt)}
                    </td>
                    <td>
                      <Tag color={request.status === STATUS.APPROVED ? 'success' : 'danger'} size="sm">
                        {request.status === STATUS.APPROVED ? '✓ Approuvée' : '✗ Rejetée'}
                      </Tag>
                    </td>
                    <td>{request.reviewedByName || '-'}</td>
                    <td>
                      {request.reviewedAt 
                        ? formatDateSimple(request.reviewedAt)
                        : '-'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}

      {/* Demandes d'accès en attente */}
      {accessRequests.filter(r => r.status === STATUS.PENDING).length > 0 && (
        <div className="user-management-section access-requests-section">
          <h3>
            <Bell size={20} className="notification-icon" />
            Demandes d'accès en attente ({accessRequests.filter(r => r.status === STATUS.PENDING).length})
          </h3>
          
          <div className="requests-list">
            {accessRequests.filter(r => r.status === STATUS.PENDING).map((request) => (
              <Card key={request.id} className="request-card">
                <div className="request-info">
                  <div className="request-name">{request.name}</div>
                  <div className="request-email">{request.email}</div>
                  <div className="request-date">
                    Demande le {new Date(request.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <div className="request-actions">
                  <Tooltip content="Approuver" position="bottom">
                    <Button 
                    variant="success"
                    onClick={() => handleApproveRequest(request.id, request.email, request.name)}
 
                  >
                    <UserCheck size={18} /> Approuver
                  </Button>
                  </Tooltip>
                  <Tooltip content="Rejeter" position="bottom">
                    <Button 
                    variant="danger"
                    onClick={() => handleRejectRequest(request.id)}
 
                  >
                    <UserX size={18} /> Rejeter
                  </Button>
                  </Tooltip>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modal d'édition utilisateur */}
      {editingUser && (
        <ProfileEditModal
          currentUser={editingUser}
          targetUser={editingUser}
          onClose={() => setEditingUser(null)}
          onUserUpdate={() => {
            setEditingUser(null);
            loadData();
          }}
        />
      )}

      {/* Modal d'approbation de demande */}
      {approveModal && (
        <ApproveRequestModal
          request={approveModal}
          onConfirm={handleConfirmApprove}
          onCancel={() => setApproveModal(null)}
        />
      )}

      {/* Modal de création de fiche personnel */}
      {personModal && (
        <CreatePersonnelModal
          user={personModal.user}
          onConfirm={async (personData) => {
            try {
              await api.createPerson(personData);
              setPersonModal(null);
              loadData();
            } catch (err) {
              toast.error('Erreur lors de la création : ' + (err.message || err));
            }
          }}
          onCancel={() => setPersonModal(null)}
        />
      )}

      {ConfirmDialogRenderer}
    </div>
  );
};

// Composant modal d'approbation
function ApproveRequestModal({ request, onConfirm, onCancel }) {
  const [giveAdmin, setGiveAdmin] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(giveAdmin, sendEmail);
    setLoading(false);
  };

  return (
    <ModalLayout
      open
      onClose={onCancel}
      title="Approuver la demande"
      icon={<UserCheck size={24} />}
      size="md"
      className="approve-modal"
      footer={
        <>
          <Button 
            variant="ghost" 
            onClick={onCancel} 
            disabled={loading}
          >
            Annuler
          </Button>
          <Button 
            variant="success" 
            onClick={handleConfirm}
            disabled={loading}
          >
            <UserCheck size={18} />
            {loading ? 'Approbation...' : 'Approuver'}
          </Button>
        </>
      }
    >
        <div className="approve-modal-body">
          <div className="approve-modal-info">
            <div className="approve-modal-user">
              <strong>{request.name}</strong>
              <span>{request.email}</span>
            </div>
          </div>

          <div className="approve-modal-options">
            <label className="approve-checkbox-label">
              <Checkbox
                checked={giveAdmin}
                onChange={(e) => setGiveAdmin(e.target.checked)}
              />
              <Shield size={16} />
              <span>Donner les droits administrateur</span>
            </label>

            <label className="approve-checkbox-label">
              <Checkbox
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
              <Mail size={16} />
              <span>Envoyer le mail de confirmation au demandeur</span>
              {sendEmail && (
                <small className="approve-email-hint">
                  <ExternalLink size={12} />
                  Ouvrira Gmail avec un mail pré-rempli contenant le lien de création de compte
                </small>
              )}
            </label>
          </div>
        </div>
    </ModalLayout>
  );
}

export default UserManagement;

// Types de personnel
const PERSON_TYPES = [
  { value: 'permanent', label: 'Permanent', icon: '🏢' },
  { value: 'contractuel', label: 'Contractuel', icon: '📋' },
  { value: 'stagiaire', label: 'Stagiaire', icon: '🎓' },
];

const CONTRACT_TYPES = [
  { value: 'intermittent', label: 'Intermittent du spectacle' },
  { value: 'CDD', label: 'CDD' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'prestataire', label: 'Prestataire' },
  { value: 'auto-entrepreneur', label: 'Auto-entrepreneur' },
  { value: 'entreprise', label: 'Entreprise / Prestataire' },
];

function CreatePersonnelModal({ user, onConfirm, onCancel }) {
  const toast = useToast();
  const [personType, setPersonType] = useState('permanent');
  const [contractType, setContractType] = useState('intermittent');
  const [loading, setLoading] = useState(false);

  // Séparer le nom en prénom / nom
  const nameParts = (user.name || '').trim().split(/\s+/);
  const defaultFirstName = nameParts[0] || '';
  const defaultLastName = nameParts.slice(1).join(' ') || '';

  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState(defaultLastName);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.warning('Le prénom et le nom sont obligatoires.');
      return;
    }
    setLoading(true);
    try {
      const personData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: user.email || '',
        type: personType,
        status: STATUS.ACTIVE,
        user_id: user.id,
      };
      if (personType === 'contractuel') {
        personData.contract_type = contractType;
      }
      await onConfirm(personData);
    } catch (err) {
      // handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalLayout
      open
      onClose={onCancel}
      title="Créer une fiche personnel"
      icon={<Users size={22} />}
      size="md"
      className="create-personnel-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
          <Button variant="success" onClick={handleSubmit} disabled={loading || !firstName.trim() || !lastName.trim()}>
            <UserPlus size={16} />
            {loading ? 'Création...' : 'Créer la fiche'}
          </Button>
        </>
      }
    >
        <div className="create-personnel-modal-body">
          <p className="create-personnel-subtitle">
            Créer une fiche personnel liée au compte de <strong>{user.name || user.email}</strong>
          </p>

          <div className="create-personnel-fields">
            <div className="create-personnel-field">
              <label>Prénom</label>
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prénom"
              />
            </div>
            <div className="create-personnel-field">
              <label>Nom</label>
              <Input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom"
              />
            </div>
          </div>

          <div className="create-personnel-type-section">
            <label className="create-personnel-section-label">Type de personnel</label>
            <div className="create-personnel-type-cards">
              {PERSON_TYPES.map((t) => (
                <Button variant="ghost"                   key={t.value}
                  className={`personnel-type-card ${personType === t.value ? 'active' : ''}`}
                  onClick={() => setPersonType(t.value)}
                >
                  <span className="personnel-type-icon">{t.icon}</span>
                  <span className="personnel-type-label">{t.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {personType === 'contractuel' && (
            <div className="create-personnel-type-section">
              <label className="create-personnel-section-label">Type de contrat</label>
              <div className="create-personnel-contract-options">
                {CONTRACT_TYPES.map((ct) => (
                  <label key={ct.value} className="contract-type-option">
                    <input
                      type="radio"
                      name="contractType"
                      value={ct.value}
                      checked={contractType === ct.value}
                      onChange={(e) => setContractType(e.target.value)}
                    />
                    <span>{ct.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
    </ModalLayout>
  );
}
