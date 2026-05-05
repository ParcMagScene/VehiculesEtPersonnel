# Mobile Navigation — TabBar

Navigation principale du module mobile eM@g basée sur une **barre d'onglets fixe en bas** d'écran.

## Architecture

```
MobileApp
├── MobileHeader       (titre + back/home/messagerie/avatar)
├── <main>             (écrans, route via useMobileRouter)
└── MobileTabBar       (fixé en bas, 6 onglets)
```

Le routing reste **basé sur le hash** (`#/mobile/<screen>`) via [`useMobileRouter`](../../hooks/useMobileRouter.js) — pas de migration vers React Router pour préserver les QR codes existants (`#/mobile/equipment/EMAG-XXX`) et éviter d'imposer un fallback SPA serveur supplémentaire.

> Depuis Sprint C, la table de routes mobile (`MOBILE_ROUTES`, `MOBILE_TAB_SCREENS`, `MOBILE_BACK_TARGET`, `MOBILE_QR_PATTERN`, `MOBILE_ACTIVE_TAB_KEY`) est centralisée dans [`apps/web/src/router/routes.config.js`](../../router/routes.config.js). Toute nouvelle route mobile doit y être déclarée — `useMobileRouter` ne fait que la consommer.

## Onglets

| Onglet     | Écran cible       | Composant                |
| ---------- | ----------------- | ------------------------ |
| Accueil    | `home`            | `MobileHome`             |
| Planning   | `planning`        | `MobilePlanning`         |
| Parc       | `parc-dashboard`  | `MobileParcDashboard`    |
| Commandes  | `orders`          | `MobileOrders`           |
| Suivi      | `suivi`           | `MobileSuivi`            |
| Profil     | (sheet)           | bottom-sheet utilisateur |

L'onglet **Profil** n'est pas un écran : il déclenche l'ouverture du `BottomSheet` existant (thème, palette, déconnexion, bascule desktop) géré par `showUserMenu` dans `MobileApp`.

## Surlignage

Le mapping `SCREEN_TO_TAB` dans [`MobileTabBar.jsx`](./MobileTabBar.jsx) détermine quel onglet est mis en évidence selon l'écran courant. Les écrans secondaires accessibles depuis la grille de l'Accueil (réservations, maintenances, affaires, équipement…) sont rattachés à l'onglet **Parc**. Les écrans transverses (tâches, personnel, congés, messagerie, sonos) ne surlignent aucun onglet.

## Persistance

- L'URL hash (`#/mobile/<screen>`) survit au refresh nativement.
- En complément, le dernier onglet principal visité est sauvegardé dans `localStorage` sous la clé `mobileActiveTab`.
- Au démarrage : si l'URL est `#/mobile` (racine) **et** qu'un onglet est mémorisé, on restaure cet onglet. Sinon l'URL gagne (cas d'un deep-link / QR code).

## Navigation interne

- `navigate(screen)` (push hash) → bouton "back" navigateur fonctionne.
- `goBack()` (replace hash) → utilise `BACK_TARGET` pour revenir au parent logique de l'écran courant. Le bouton "Accueil" du header force `navigate('home')`.
- Le swipe-back tactile (`useSwipeBack`) appelle `goBack`.

## TV client

Aucun impact : la TabBar n'est rendue que dans `MobileApp`, mont uniquement quand `detectMobile()` retourne true dans `App.jsx`. Le `apps/tv-client/` reste totalement indépendant.
