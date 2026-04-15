import React, { useState } from 'react';
import { Settings, AlertTriangle, XCircle, ClipboardList, CalendarCheck, Bell, Clock, LayoutGrid, UserCog, MessageSquare, Mail } from 'lucide-react';
import { Avatar, Button, Tooltip } from '@/design-system';
import { STATUS_COLORS } from '../../constants/colors';
import ProfileEditModal from '../auth/ProfileEditModal';

const HeaderActions = ({
  currentUser,
  reportedMaintenances,
  immobilizedVehicles,
  pendingMaintenances,
  activeInterventions,
  overdueInterventions,
  conflictingMaintenances,
  pendingRequestsCounts,
  pendingAccessRequests,
  unreadMsgCount,
  onToggleMessaging,
  onToggleMailing,
  onOpenSettings,
  onOpenPreferences,
  onLogout,
  onUserUpdate,
  setNotificationFilter,
  setShowNotificationsPopup,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
    <>
      <div className="header-controls">

        <div className="header-right-actions">
          <div className="header-notification-badges">
            {/* Badge 1: Pannes signalées (reported) */}
            {currentUser?.isAdmin && reportedMaintenances.length > 0 && (
              <div 
                className="notification-badge unified has-reported u-relative"
                onClick={() => {
                  setNotificationFilter('reported');
                  setShowNotificationsPopup(true);
                }}
                title={`${reportedMaintenances.length} panne(s) signalée(s)`}
              >
                <AlertTriangle size={16} strokeWidth={2.5} />
                <span className="notification-count">{reportedMaintenances.length}</span>
                {immobilizedVehicles.length > 0 && (
                  <span className="notification-alert-badge">
                    <XCircle size={10} strokeWidth={3} />
                  </span>
                )}
              </div>
            )}

            {/* Badge 2: Demandes d'intervention / CT (pending) */}
            {currentUser?.isAdmin && pendingMaintenances.length > 0 && (
              <div 
                className="notification-badge unified has-pending u-relative"
                onClick={() => {
                  setNotificationFilter('pending');
                  setShowNotificationsPopup(true);
                }}
                title={`${pendingMaintenances.length} demande(s) d'intervention/CT`}
              >
                <ClipboardList size={16} strokeWidth={2.5} />
                <span className="notification-count">{pendingMaintenances.length}</span>
              </div>
            )}

            {/* Badge 3: Demandes de réservation (admin) */}
            {currentUser?.isAdmin && pendingRequestsCounts.reservationRequests > 0 && (
              <div 
                className="notification-badge unified requests-badge u-relative"
                onClick={() => {
                  setNotificationFilter('reservations');
                  setShowNotificationsPopup(true);
                }}
                title={`${pendingRequestsCounts.reservationRequests} demande(s) de réservation`}
              >
                <CalendarCheck size={16} strokeWidth={2.5} />
                <span className="notification-count">{pendingRequestsCounts.reservationRequests}</span>
              </div>
            )}

            {/* Badge 4: Interventions actives (programmées, en cours, en retard) */}
            {activeInterventions.length > 0 && (
              <div 
                className={`notification-badge unified ${
                  overdueInterventions.length > 0 ? 'has-overdue' : 
                  conflictingMaintenances.length > 0 ? 'has-conflict' : 
                  'has-scheduled'
                } u-relative`}
                onClick={() => {
                  setNotificationFilter('active');
                  setShowNotificationsPopup(true);
                }}
                title={`${activeInterventions.length} intervention(s) active(s)`}
              >
                <Bell size={16} strokeWidth={2.5} />
                <span className="notification-count">{activeInterventions.length}</span>
                {overdueInterventions.length > 0 && (
                  <span className="notification-alert-badge">
                    <Clock size={10} strokeWidth={3} />
                  </span>
                )}
              </div>
            )}
          </div>
            
          <Tooltip content="Messages" position="bottom">
            <Button variant="ghost" className="msg-toggle-button" onClick={onToggleMessaging} aria-label="Messages">
              <MessageSquare size={20} />
              {unreadMsgCount > 0 && <span className="msg-toggle-badge">{unreadMsgCount > 9 ? '9+' : unreadMsgCount}</span>}
            </Button>
          </Tooltip>

          {currentUser?.isAdmin && (
            <Tooltip content="Mailing" position="bottom">
              <Button variant="ghost" className="msg-toggle-button" onClick={onToggleMailing} aria-label="Mailing">
                <Mail size={20} />
              </Button>
            </Tooltip>
          )}

          <Button variant="ghost" 
            className="settings-button u-relative" 
            onClick={onOpenSettings} 
            aria-label="Ouvrir les paramètres"
          >
            <Settings size={18} />
            {currentUser?.isAdmin && pendingAccessRequests > 0 && (
              <span 
                className="u-absolute u-rounded-full u-flex-center u-font-bold"
                style={{
                  top: '-4px',
                  right: '-4px',
                  background: STATUS_COLORS.danger,
                  color: 'white',
                  width: '20px',
                  height: '20px',
                  fontSize: '11px',
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              >
                {pendingAccessRequests}
              </span>
            )}
          </Button>

          {currentUser && (
            <div className="u-relative">
              <Button variant="ghost"
                onClick={() => setShowUserMenu(!showUserMenu)}
                title={currentUser.name}
                aria-label={`Menu utilisateur (${currentUser.name})`}
                className="u-rounded-full u-flex-center u-cursor-pointer u-overflow-hidden"
                style={{
                  width: '40px',
                  height: '40px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                  transition: 'all 0.2s',
                  padding: 0,
                  background: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.2)';
                }}
              >
                <Avatar name={currentUser.name} avatar={currentUser.avatar} size={36} />
              </Button>

              {showUserMenu && (
                <>
                  <div className="user-menu-overlay" onMouseDown={() => setShowUserMenu(false)} />
                  <div className="user-menu-dropdown">
                    <div className="user-menu-header">
                      <Avatar name={currentUser.name} avatar={currentUser.avatar} size="md" />
                      <div>
                        <div className="user-menu-name">{currentUser.name}</div>
                        <div className="user-menu-role">
                          {currentUser.isAdmin ? 'Administrateur' : 'Utilisateur'}
                        </div>
                      </div>
                    </div>
                    
                    <Button variant="ghost"
                      className="user-menu-btn"
                      onClick={() => { setShowUserMenu(false); setShowProfileModal(true); }}
                    >
                      <UserCog size={16} />
                      Mon profil
                    </Button>

                    <Button variant="ghost"
                      className="user-menu-btn"
                      onClick={() => { setShowUserMenu(false); if (onOpenPreferences) onOpenPreferences(); }}
                    >
                      <Settings size={16} />
                      Préférences
                    </Button>

                    <Button variant="ghost"
                      className="user-menu-btn"
                      onClick={() => { setShowUserMenu(false); onLogout(); }}
                    >
                      <LayoutGrid size={16} />
                      Changer d'utilisateur
                    </Button>

                    <Button variant="ghost"
                      className="user-menu-btn danger"
                      onClick={() => { setShowUserMenu(false); onLogout(); }}
                    >
                      <XCircle size={16} />
                      Se déconnecter
                    </Button>

                    <Button variant="ghost"
                      className="user-menu-cancel"
                      onClick={() => setShowUserMenu(false)}
                    >
                      Annuler
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showProfileModal && (
        <ProfileEditModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onUserUpdate={(updatedUser) => {
            if (onUserUpdate) onUserUpdate(updatedUser);
            setShowProfileModal(false);
          }}
        />
      )}
    </>
  );
};

export default React.memo(HeaderActions);
