import './MobileHeader.css';

import { ArrowLeft, Home, MessageSquare } from 'lucide-react';

import { Button } from '@/design-system';

const SCREEN_TITLES = {
  home: 'Accueil',
  'parc-dashboard': 'Parc',
  planning: 'Planning',
  reservations: 'Réservations',
  maintenances: 'Interventions',
  availability: 'Disponibilité',
  affaires: 'Affaires',
  tasks: 'Tâches du jour',
  personnel: 'Personnel',
  messaging: 'Messagerie',
  equipment: 'Matériel & SAV',
  sav: 'SAV',
  'equipment-qr': 'Fiche équipement',
  orders: 'Commandes',
  leaves: 'Congés',
  inventory: 'Inventaire',
  location: 'Plan',
  sonos: 'Sonos',
  suivi: 'Suivi',
  'suivi-detail': 'Détail suivi',
  'suivi-add': 'Nouvelle entrée',
  'dashboard-admin': 'Dashboard',
};

function MobileHeader({
  currentScreen,
  onBack,
  onHome,
  onMessaging,
  unreadMsgCount = 0,
  currentUser,
  onUserMenu,
}) {
  const isHome = currentScreen === 'home';
  const title = SCREEN_TITLES[currentScreen] || 'eM@g';

  return (
    <header className="mobile-header">
      <div className="mh-left">
        {!isHome && (
          <Button variant="ghost" className="mh-btn mh-back" onClick={onBack} aria-label="Retour">
            <ArrowLeft size={22} />
          </Button>
        )}
      </div>

      <span className="mh-title">{title}</span>

      <div className="mh-right">
        <Button
          variant="ghost"
          className="mh-btn mh-msg"
          onClick={onMessaging}
          aria-label="Messagerie"
        >
          <MessageSquare size={20} />
          {unreadMsgCount > 0 && (
            <span className="mh-badge">{unreadMsgCount > 9 ? '9+' : unreadMsgCount}</span>
          )}
        </Button>
        {!isHome && (
          <Button variant="ghost" className="mh-btn mh-home" onClick={onHome} aria-label="Accueil">
            <Home size={20} />
          </Button>
        )}
        <Button
          variant="ghost"
          className="mh-avatar"
          onClick={onUserMenu}
          aria-label="Menu utilisateur"
        >
          {currentUser?.name?.charAt(0)}
        </Button>
      </div>
    </header>
  );
}

export default MobileHeader;
