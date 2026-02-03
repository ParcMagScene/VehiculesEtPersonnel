import React, { useState, useEffect } from 'react';
import { Mail, UserPlus, Trash2, RefreshCw, Shield, User, Check, Clock, UserCheck, UserX, Bell } from 'lucide-react';
import api from '../utils/api';
import './UserManagement.css';

const UserManagement = () => {
  const [authorizedEmails, setAuthorizedEmails] = useState([]);
  const [users, setUsers] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [resetUserId, setResetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [emailsData, usersData, requestsData] = await Promise.all([
        api.getAuthorizedEmails(),
        api.getUsers(),
        api.getAccessRequests()
      ]);
      setAuthorizedEmails(emailsData);
      setUsers(usersData);
      setAccessRequests(requestsData);
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

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      alert('Le mot de passe doit contenir au moins 4 caractères');
      return;
    }

    try {
      await api.updateUser(resetUserId, { newPassword });
      alert('Mot de passe réinitialisé avec succès');
      setResetUserId(null);
      setNewPassword('');
    } catch (error) {
    

  const handleApproveRequest = async (requestId) => {
    if (!confirm('Approuver cette demande d\'accès ?')) return;

    try {
      await api.updateAccessRequest(requestId, 'approved');
      alert('✅ Demande approuvée ! L\'utilisateur peut maintenant créer son compte.');
      loadData();
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
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    }
  };  alert(`Erreur: ${error.message}`);
    }
  };

  if (isLoading) {
    return <div className="user-management-loading">Chargement...</div>;
  }

  return (
    <div className="user-management">
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
                    onClick={() => handleApproveRequest(request.id)}
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
                      {new Date(request.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td>
                      <span className={`status-badge ${request.status}`}>
                        {request.status === 'approved' ? '✓ Approuvée' : '✗ Rejetée'}
                      </span>
                    </td>
                    <td>{request.reviewed_by_name || '-'}</td>
                    <td>
                      {request.reviewed_at 
                        ? new Date(request.reviewed_at).toLocaleDateString('fr-FR')
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
                    <td>{email.user_name || '-'}</td>
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
                  <th>Administrateur</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
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
                        {resetUserId === user.id ? (
                          <form onSubmit={handleResetPassword} className="inline-form">
                            <input
                              type="text"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Nouveau mot de passe"
                              autoFocus
                              minLength={4}
                            />
                            <button type="submit" className="btn-sm btn-primary">
                              Valider
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setResetUserId(null);
                                setNewPassword('');
                              }}
                              className="btn-sm btn-secondary"
                            >
                              Annuler
                            </button>
                          </form>
                        ) : (
                          <>
                            <button
                              onClick={() => setResetUserId(user.id)}
                              className="btn-icon btn-warning"
                              title="Réinitialiser le mot de passe"
                            >
                              <RefreshCw size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="btn-icon btn-danger"
                              title="Supprimer l'utilisateur"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
