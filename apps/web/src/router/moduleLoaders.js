/**
 * Module loaders — préchargement onglet au hover/focus.
 *
 * Vite déduplique les imports dynamiques par chemin : appeler `import('X')`
 * via ce loader puis via `lazy(() => import('X'))` dans App.jsx résout la
 * MÊME promesse. Conséquence : l'utilisateur qui survole un onglet du Header
 * déclenche le téléchargement du chunk en arrière-plan ; quand il clique,
 * `lazy()` reçoit le code immédiatement (pas de fallback Suspense visible).
 *
 * Coût en l'absence de hover : 0 (les loaders ne s'exécutent pas).
 *
 * Important : les chemins doivent rester strictement identiques à ceux
 * déclarés dans `App.jsx` sinon la déduplication échoue et le chunk est
 * téléchargé deux fois.
 */

const MODULE_LOADERS = {
  vehicles: () => import('../components/vehicles/Calendar'),
  equipment: () => import('../components/equipment/EquipmentPanel'),
  affaires: () => import('../components/affaires/AffairesPanel'),
  orders: () => import('../components/orders/OrdersPanel'),
  stock: () => import('../components/orders/StockPanel'),
  planning: () => import('../components/planning/PlanningPanel'),
  annuaire: () => import('../components/annuaire/AnnuairePanel'),
  lieux: () => import('../components/annuaire/LocationsTab'),
  video: () => import('../components/video/VideoPanel'),
  controles: () => import('../components/controles/ControlsDashboard'),
};

// Mémorise les ids déjà préchargés pour éviter de re-déclencher la promesse
// (Vite la cache déjà, mais ça évite le bruit dans la console réseau).
const preloaded = new Set();

/**
 * Précharge le chunk d'un module sans le rendre.
 * @param {string} id — identifiant du module (voir DESKTOP_MODULES)
 */
export function preloadModule(id) {
  if (!id || preloaded.has(id)) return;
  const loader = MODULE_LOADERS[id];
  if (!loader) return;
  preloaded.add(id);
  // Avale les erreurs : si le préchargement échoue (réseau), le vrai
  // chargement lazy() réessaiera et affichera le fallback Suspense normalement.
  loader().catch(() => {
    preloaded.delete(id);
  });
}
