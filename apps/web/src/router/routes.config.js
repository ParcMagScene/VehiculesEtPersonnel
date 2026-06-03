/**
 * Sprint B — Table unique des modules / sous-vues / surfaces.
 *
 * Source de vérité pour :
 *   - le menu desktop (Header)
 *   - la validation des paramètres URL (?module=, ?tab=, ?view=)
 *   - les préférences utilisateur (UserPreferencesModal)
 *
 * Toute nouvelle entrée DOIT être ajoutée ici plutôt qu'en dur dans un composant.
 */

import {
  Boxes,
  Briefcase,
  Building2,
  MapPin,
  Package,
  Radio,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Video,
} from 'lucide-react';

/**
 * Modules desktop affichés dans le Header (`module-tabs`).
 * L'ordre par défaut est celui de ce tableau ; l'utilisateur peut le réordonner
 * via UserPreferencesModal (stocké dans `tabPrefs.tabOrder`).
 *
 * Ne PAS ajouter de modules mobile-only ici (suivi, tasks, leaves, personnel, etc.)
 */
export const DESKTOP_MODULES = [
  { id: 'vehicles', label: 'Véhicules', icon: Truck },
  { id: 'planning', label: 'Personnel', icon: Radio },
  { id: 'equipment', label: 'Équipements', icon: Package },
  { id: 'affaires', label: 'Affaires', icon: Briefcase },
  { id: 'orders', label: 'Commandes', icon: ShoppingCart },
  { id: 'stock', label: 'Stocks', icon: Boxes },
  { id: 'annuaire', label: 'Annuaire', icon: Building2 },
  { id: 'lieux', label: 'Lieux', icon: MapPin },
  { id: 'video', label: 'Vidéo', icon: Video },
  { id: 'controles', label: 'Contrôles', icon: ShieldCheck },
];

/**
 * Modules accessibles via URL `?module=xxx` (incluent ceux atteignables uniquement
 * par lien direct, p.ex. `sonos` qui s'ouvre en fenêtre détachée).
 */
export const ALLOWED_MODULES = new Set([...DESKTOP_MODULES.map((m) => m.id), 'sonos']);

export const DEFAULT_MODULE = 'vehicles';

/**
 * Sous-onglets du module Stocks (URL ?tab=xxx).
 */
export const STOCK_SUBTABS = new Set(['vente', 'sav', 'inventory']);
export const DEFAULT_STOCK_SUBTAB = 'vente';

/**
 * Vues du calendrier véhicules (URL ?view=xxx).
 */
export const CALENDAR_VIEWS = new Set(['day', 'week', 'month']);
export const DEFAULT_CALENDAR_VIEW = 'week';

// ─────────────────────────────────────────────────────────────────────────────
// Mobile (hash router — voir apps/web/src/components/mobile/README.md)
// On NE migre PAS vers React Router : les QR codes physiques imprimés sur le
// matériel pointent vers `#/mobile/equipment/EMAG-XXXXX` et ne doivent pas
// être cassés.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapping écran ↔ chemin hash pour l'app mobile.
 * Toute nouvelle vue mobile doit être déclarée ici.
 */
export const MOBILE_ROUTES = {
  home: '/mobile',
  'parc-dashboard': '/mobile/parc',
  planning: '/mobile/planning',
  reservations: '/mobile/reservations',
  maintenances: '/mobile/maintenances',
  availability: '/mobile/availability',
  affaires: '/mobile/affaires',
  tasks: '/mobile/tasks',
  personnel: '/mobile/personnel',
  messaging: '/mobile/messaging',
  equipment: '/mobile/equipment',
  sav: '/mobile/sav',
  'equipment-qr': '/mobile/equipment-qr',
  orders: '/mobile/orders',
  leaves: '/mobile/leaves',
  inventory: '/mobile/inventory',
  location: '/mobile/location',
  sonos: '/mobile/sonos',
  suivi: '/mobile/suivi',
  'dashboard-admin': '/mobile/dashboard-admin',
};

/** Index inverse path → screen, calculé une fois au load. */
export const MOBILE_REVERSE_ROUTES = Object.fromEntries(
  Object.entries(MOBILE_ROUTES).map(([s, p]) => [p, s]),
);

/**
 * Écrans considérés comme onglets principaux : leur dernière visite est
 * persistée dans `localStorage[MOBILE_ACTIVE_TAB_KEY]` afin d'être restaurée
 * au prochain démarrage si l'URL ne précise rien.
 */
export const MOBILE_TAB_SCREENS = new Set([
  'home',
  'planning',
  'parc-dashboard',
  'orders',
  'suivi',
]);

/**
 * Hiérarchie parentale pour `goBack()`. Tout écran absent retombe sur `home`.
 */
export const MOBILE_BACK_TARGET = {
  planning: 'parc-dashboard',
  reservations: 'parc-dashboard',
  maintenances: 'parc-dashboard',
  availability: 'parc-dashboard',
  'equipment-qr': 'equipment',
  suivi: 'home',
  'dashboard-admin': 'home',
};

export const MOBILE_ACTIVE_TAB_KEY = 'mobileActiveTab';

/**
 * Pattern QR code matériel : `#/mobile/equipment/EMAG-12345`.
 * Source unique pour le hook router ET pour les scripts qui génèrent les
 * QR codes physiques — toute modification ici doit être répercutée sur les
 * étiquettes imprimées.
 */
export const MOBILE_QR_PATTERN = /^#\/mobile\/equipment\/(EMAG-\d+)/i;
