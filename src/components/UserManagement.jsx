import React, { useState, useEffect } from 'react';
import { Mail, UserPlus, Trash2, RefreshCw, Shield, User, Check, Clock, UserCheck, UserX, Bell, Pencil, ExternalLink, Users, Briefcase } from 'lucide-react';
import api from '../utils/api';
import UserAvatar from './UserAvatar';
import ProfileEditModal from './ProfileEditModal';
import './UserManagement.css';

const UserManagement = ({ onAccessRequestChange, onNavigateToPersonnel }) => {
  const [authorizedEmails, setAuthorizedEmails] = useState([]);
  const [users, setUsers] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [approveModal, setApproveModal] = useState(null); // { id, email, name }
  const [personModal, setPersonModal] = useState(null); // { user } pour création de fiche personnel
  const [personsMap, setPersonsMap] = useState({}); // user_id -> person

  useEffect(() => {
    loadData();
    
    // Rafraîchir les données toutes les 30 secondes
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    
    return () => clearInterval(interval);
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
      alert('Erreur lors du chargement des données');
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
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleRemoveEmail = async (id) => {
    if (!confirm('Supprimer cet email autorisé ?')) return;

    try {
      await api.removeAuthorizedEmail(id);
      loadData();
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleToggleAdmin = async (userId, currentIsAdmin) => {
    const action = currentIsAdmin ? 'retirer les droits admin' : 'donner les droits admin';
    if (!confirm(`Voulez-vous vraiment ${action} à cet utilisateur ?`)) return;

    try {
      await api.updateUser(userId, { isAdmin: !currentIsAdmin });
      alert('Droits modifiés avec succès');
      loadData();
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Voulez-vous vraiment supprimer cet utilisateur ? Cette action est irréversible.')) return;

    try {
      await api.deleteUser(userId);
      alert('Utilisateur supprimé avec succès');
      loadData();
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleResetPassword = async (userId) => {
    if (!confirm('Marquer ce compte pour réinitialisation ? L\'utilisateur devra définir un nouveau mot de passe lors de sa prochaine connexion.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3002/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la réinitialisation');
      }

      const data = await response.json();
      alert(`✅ Réinitialisation demandée\n\nL'utilisateur ${data.email} devra définir un nouveau mot de passe lors de sa prochaine connexion.`);
      loadData();
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleApproveRequest = async (requestId, requestEmail, requestName) => {
    // Ouvrir le modal d'approbation au lieu d'un confirm
    setApproveModal({ id: requestId, email: requestEmail, name: requestName });
  };

  const handleConfirmApprove = async (giveAdmin, sendEmail) => {
    if (!approveModal) return;
    const { id, email: reqEmail, name: reqName } = approveModal;

    try {
      const result = await api.updateAccessRequest(id, 'approved', giveAdmin);
      
      if (sendEmail) {
        // Construire l'URL de création de compte
        const appUrl = window.location.origin;
        const setupLink = `${appUrl}?setup=${encodeURIComponent(reqEmail)}`;
        
        // Construire le mail type
        const subject = encodeURIComponent('Votre accès à MagSav - Réservation Véhicules');
        const body = encodeURIComponent(
          `Bonjour ${reqName},\n\n` +
          `Votre demande d'accès à l'application de réservation de véhicules a été approuvée !\n\n` +
          `Pour finaliser votre inscription, cliquez sur le lien ci-dessous et créez votre mot de passe :\n\n` +
          `${setupLink}\n\n` +
          `Ce lien vous amènera directement à la page de création de votre compte.\n\n` +
          `Cordialement,\n` +
          `L'équipe Mag Scène`
        );
        
        // Ouvrir Gmail compose dans un nouvel onglet
        const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(reqEmail)}&su=${subject}&body=${body}`;
        window.open(gmailUrl, '_blank');
      }
      
      setApproveModal(null);
      loadData();
      onAccessRequestChange?.();
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (!confirm('Rejeter cette demande d\'accès ?')) return;

    try {
      await api.updateAccessRequest(requestId, 'rejected');
      alert('Demande rejetée');
      loadData();
      onAccessRequestChange?.();
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    }
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
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Droits</th>
                  <th style={{ width: '80px' }}>Actions</th>
                  <th style={{ width: '100px' }}>Personnel</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-name-cell">
                        <UserAvatar name={user.name} avatar={user.avatar} size={22} />
                        <span>{user.name}</span>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <label className="admin-checkbox">
                        <input
                          type="checkbox"
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
                      <div className="action-buttons">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="btn-icon btn-primary"
                          title="Modifier le profil"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleResetPassword(user.id)}
                          className="btn-icon btn-warning"
                          title="Réinitialiser - l'utilisateur devra définir un nouveau mot de passe"
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="btn-icon btn-danger"
                          title="Supprimer l'utilisateur"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                    <td>
                      {personsMap[user.id] ? (
                        <button
                          className="personnel-linked-badge clickable"
                          title={`Voir la fiche de ${personsMap[user.id].firstName} ${personsMap[user.id].lastName}`}
                          onClick={() => onNavigateToPersonnel && onNavigateToPersonnel(personsMap[user.id])}
                        >
                          <UserCheck size={13} />
                          <span>{personsMap[user.id].type === 'contractuel' ? 'Contractuel' : 'Permanent'}</span>
                          <ExternalLink size={11} />
                        </button>
                      ) : (
                        <button
                          onClick={() => setPersonModal({ user })}
                          className="btn-create-personnel"
                          title="Créer une fiche personnel pour cet utilisateur"
                        >
                          <Users size={13} /> Créer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Emails autorisés */}
      <div className="user-management-section">
        <h3><Mail size={20} /> Emails autorisés</h3>
        
        <form onSubmit={handleAddEmail} className="add-email-form">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            required
          />
          <button type="submit">
            <UserPlus size={18} /> Autoriser
          </button>
        </form>

        <div className="emails-list">
          {authorizedEmails.length === 0 ? (
            <p className="no-data">Aucun email autorisé</p>
          ) : (
            <table>
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
                      <span className={`status-badge ${email.status}`}>
                        {email.status === 'activated' ? (
                          <><Check size={14} /> Activé</>
                        ) : (
                          <><Clock size={14} /> En attente</>
                        )}
                      </span>
                    </td>
                    <td>{email.userName || '-'}</td>
                    <td>
                      <button
                        onClick={() => handleRemoveEmail(email.id)}
                        className="btn-icon btn-danger"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Historique des demandes traitées */}
      {accessRequests.filter(r => r.status !== 'pending').length > 0 && (
        <div className="user-management-section">
          <h3>Historique des demandes</h3>
          <div className="requests-history">
            <table>
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
                {accessRequests.filter(r => r.status !== 'pending').map((request) => (
                  <tr key={request.id}>
                    <td>{request.name}</td>
                    <td>{request.email}</td>
                    <td>
                      {new Date(request.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td>
                      <span className={`status-badge ${request.status}`}>
                        {request.status === 'approved' ? '✓ Approuvée' : '✗ Rejetée'}
                      </span>
                    </td>
                    <td>{request.reviewedByName || '-'}</td>
                    <td>
                      {request.reviewedAt 
                        ? new Date(request.reviewedAt).toLocaleDateString('fr-FR')
                        : '-'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Demandes d'accès en attente */}
      {accessRequests.filter(r => r.status === 'pending').length > 0 && (
        <div className="user-management-section access-requests-section">
          <h3>
            <Bell size={20} className="notification-icon" />
            Demandes d'accès en attente ({accessRequests.filter(r => r.status === 'pending').length})
          </h3>
          
          <div className="requests-list">
            {accessRequests.filter(r => r.status === 'pending').map((request) => (
              <div key={request.id} className="request-card">
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
                  <button 
                    className="btn-approve"
                    onClick={() => handleApproveRequest(request.id, request.email, request.name)}
                    title="Approuver"
                  >
                    <UserCheck size={18} /> Approuver
                  </button>
                  <button 
                    className="btn-reject"
                    onClick={() => handleRejectRequest(request.id)}
                    title="Rejeter"
                  >
                    <UserX size={18} /> Rejeter
                  </button>
                </div>
              </div>
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
              alert('Erreur lors de la création : ' + (err.message || err));
            }
          }}
          onCancel={() => setPersonModal(null)}
        />
      )}
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
    <div className="modal-overlay" onClick={onCancel}>
      <div className="approve-modal" onClick={(e) => e.stopPropagation()}>
        <div className="approve-modal-header">
          <UserCheck size={24} />
          <h3>Approuver la demande</h3>
        </div>
        
        <div className="approve-modal-body">
          <div className="approve-modal-info">
            <div className="approve-modal-user">
              <strong>{request.name}</strong>
              <span>{request.email}</span>
            </div>
          </div>

          <div className="approve-modal-options">
            <label className="approve-checkbox-label">
              <input
                type="checkbox"
                checked={giveAdmin}
                onChange={(e) => setGiveAdmin(e.target.checked)}
              />
              <Shield size={16} />
              <span>Donner les droits administrateur</span>
            </label>

            <label className="approve-checkbox-label">
              <input
                type="checkbox"
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

        <div className="approve-modal-actions">
          <button 
            className="btn-secondary" 
            onClick={onCancel} 
            disabled={loading}
          >
            Annuler
          </button>
          <button 
            className="btn-approve" 
            onClick={handleConfirm}
            disabled={loading}
          >
            <UserCheck size={18} />
            {loading ? 'Approbation...' : 'Approuver'}
          </button>
        </div>
      </div>
    </div>
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
      alert('Le prénom et le nom sont obligatoires.');
      return;
    }
    setLoading(true);
    try {
      const personData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: user.email || '',
        type: personType,
        status: 'active',
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
    <div className="modal-overlay" onClick={onCancel}>
      <div className="create-personnel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-personnel-modal-header">
          <Users size={22} />
          <h3>Créer une fiche personnel</h3>
        </div>

        <div className="create-personnel-modal-body">
          <p className="create-personnel-subtitle">
            Créer une fiche personnel liée au compte de <strong>{user.name || user.email}</strong>
          </p>

          <div className="create-personnel-fields">
            <div className="create-personnel-field">
              <label>Prénom</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prénom"
              />
            </div>
            <div className="create-personnel-field">
              <label>Nom</label>
              <input
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
                <button
                  key={t.value}
                  className={`personnel-type-card ${personType === t.value ? 'active' : ''}`}
                  onClick={() => setPersonType(t.value)}
                >
                  <span className="personnel-type-icon">{t.icon}</span>
                  <span className="personnel-type-label">{t.label}</span>
                </button>
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

        <div className="create-personnel-modal-actions">
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>
            Annuler
          </button>
          <button className="btn-approve" onClick={handleSubmit} disabled={loading || !firstName.trim() || !lastName.trim()}>
            <UserPlus size={16} />
            {loading ? 'Création...' : 'Créer la fiche'}
          </button>
        </div>
      </div>
    </div>
  );
}
