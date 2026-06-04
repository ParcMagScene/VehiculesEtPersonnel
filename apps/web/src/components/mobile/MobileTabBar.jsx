import './MobileTabBar.css';

import { Calendar, CheckSquare, Home, LayoutGrid, ShoppingCart, User } from 'lucide-react';

/**
 * MobileTabBar — Barre d'onglets fixe en bas de l'écran mobile.
 *
 * Onglets : Accueil · Planning · Parc · Commandes · Suivi · Profil
 * Le mapping currentScreen → onglet actif est calculé via SCREEN_TO_TAB.
 * Les autres écrans (réservations, maintenances, affaires, etc.) restent
 * accessibles via la grille d'icônes de l'Accueil et héritent du surlignage
 * de leur onglet parent (cf. SCREEN_TO_TAB).
 *
 * L'onglet "profil" n'est pas un écran : il ouvre le bottom-sheet existant
 * (thème + déconnexion + bascule desktop) via la prop onOpenProfile.
 */

export const TABS = [
  { id: 'home', label: 'Accueil', icon: Home, screen: 'home' },
  { id: 'planning', label: 'Personnel', icon: Calendar, screen: 'planning' },
  { id: 'parc', label: 'Parc', icon: LayoutGrid, screen: 'parc-dashboard' },
  { id: 'orders', label: 'Commandes', icon: ShoppingCart, screen: 'orders' },
  { id: 'suivi', label: 'Suivi', icon: CheckSquare, screen: 'suivi' },
  { id: 'profile', label: 'Profil', icon: User, action: 'profile' },
];

// Surlignage : screen courant → id d'onglet
const SCREEN_TO_TAB = {
  home: 'home',
  planning: 'planning',
  'parc-dashboard': 'parc',
  reservations: 'parc',
  maintenances: 'parc',
  availability: 'parc',
  affaires: 'parc',
  location: 'parc',
  inventory: 'parc',
  equipment: 'parc',
  sav: 'parc',
  'equipment-qr': 'parc',
  orders: 'orders',
  suivi: 'suivi',
  // tasks/personnel/leaves/messaging/sonos/dashboard-admin → aucun onglet surligné
};

function MobileTabBar({ currentScreen, onNavigate, onOpenProfile, profileActive = false }) {
  const activeTabId = profileActive ? 'profile' : SCREEN_TO_TAB[currentScreen] || null;

  return (
    <nav className="mobile-tabbar" aria-label="Navigation principale">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTabId === tab.id;
        const handleClick = () => {
          if (tab.action === 'profile') {
            onOpenProfile?.();
          } else {
            onNavigate?.(tab.screen);
          }
        };
        return (
          <button
            type="button"
            key={tab.id}
            className={`mobile-tab ${isActive ? 'active' : ''}`}
            onClick={handleClick}
            aria-current={isActive ? 'page' : undefined}
            aria-label={tab.label}
          >
            <Icon size={20} className="mobile-tab-icon" />
            <span className="mobile-tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default MobileTabBar;
