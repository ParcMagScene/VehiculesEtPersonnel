> ⚠️ **Document d archive (20 avril 2026)** — remplacé par [AUDIT-COMPLET 2026-05-06](../../04-Operations/audits/2026-05/AUDIT-COMPLET-2026-05-06.md).
>
# 🔍 Rapport d'Audit — eM@g Frontend/Backend

**Date** : 20 avril 2026  
**Branche** : `dev`  
**Scope** : `apps/web/`, `apps/api/`, `apps/tv-client/`  
**Méthode** : Analyse statique exhaustive du code source  

---

## 📊 Résumé des Violations

| Catégorie | Critiques | Moyens | Faibles | Total |
|---|---|---|---|---|
| addEventListener non-passifs | 0 | 4 | 0 | 4 |
| preventDefault dans React passif | 1 | 0 | 0 | 1 |
| Violations CSP | 1 | 2 | 0 | 3 |
| Erreurs 404 API | 0 | 0 | 0 | **0** |
| crypto.randomUUID() | 0 | 2 | 14 | 16 |
| Forced reflow patterns | 0 | 2 | 4 | 6 |
| **TOTAL** | **2** | **10** | **18** | **30** |

---

## 1. addEventListener — Passivité

### ✅ Déjà corrects (passive: false + preventDefault)

Ces listeners utilisent `preventDefault()` et **doivent** rester `{ passive: false }` :

| Fichier | Ligne | Événement | Justification |
|---|---|---|---|
| `DepotMap.jsx` | 190 | `wheel` | zoom SVG |
| `DepotMap.jsx` | 253 | `touchstart` | pinch-to-zoom |
| `DepotMap.jsx` | 254 | `touchmove` | pinch-to-zoom |
| `DepotMapEditor.jsx` | 370 | `wheel` | zoom éditeur |
| `DepotMapEditor.jsx` | 744 | `touchmove` | drag zones |

### ✅ Déjà corrects (passive: true)

| Fichier | Ligne | Événement |
|---|---|---|
| `PersonnelPanel.jsx` | 1770 | `scroll` |
| `PersonnelPanel.jsx` | 1771 | `scroll` |

### ⚠️ À corriger — Manque `{ passive: true }`

Ces listeners `scroll` n'appellent PAS `preventDefault()` mais n'ont pas l'option passive :

| Fichier | Ligne | Événement | Correction |
|---|---|---|---|
| `Calendar.jsx` | 283 | `scroll` | Ajouter `{ passive: true }` |
| `Calendar.jsx` | 284 | `scroll` | Ajouter `{ passive: true }` |
| `GoogleCalendarBanner.jsx` | 363 | `scroll` | Ajouter `{ passive: true }` |
| `GoogleCalendarBanner.jsx` | 364 | `scroll` | Ajouter `{ passive: true }` |

### ℹ️ Pas concernés (events non-cancelables)

92 autres `addEventListener` pour : `keydown`, `keyup`, `mousedown`, `mouseup`, `mousemove`, `click`, `resize`, `hashchange`, `change`, `blur`, `visibilitychange`, `online`, `DOMContentLoaded`, `dblclick`, `unhandledrejection`, `icegatheringstatechange`, SSE events.  
→ L'option `passive` n'a pas d'impact sur ces types d'événements.

---

## 2. preventDefault() dans handlers React passifs

### 🔴 CRITIQUE — useSwipeAction.js

**Fichier** : `apps/web/src/hooks/useSwipeAction.js:59`  
**Problème** : Appelle `e.preventDefault()` dans un handler `onTouchMove` React.  
Depuis **React 17**, les handlers touch React sont **passifs par défaut**. L'appel `preventDefault()` est **ignoré silencieusement** par le navigateur avec un warning console :
```
Unable to preventDefault inside passive event listener invocation.
```
**Impact** : Le swipe horizontal ne bloque PAS le scroll vertical → UX dégradée sur mobile.

**Correction** : Convertir en `addEventListener` via `useRef` + `useEffect` avec `{ passive: false }`.

### ℹ️ Autres preventDefault() — OK

Les 147 autres `preventDefault()` sont dans :
- Handlers `onSubmit` de formulaires (empêcher submit natif) ✅
- Handlers `onClick` sur liens (navigation custom) ✅
- Handlers `onKeyDown` (raccourcis clavier) ✅
- Handlers `onDragOver` (zones de drop) ✅

---

## 3. Violations CSP (Content-Security-Policy)

### Configuration actuelle

**Vite preview** (`vite.config.js:127`) — CSP du frontend :
```
img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com
connect-src 'self' https://*.googleapis.com https://accounts.google.com
script-src 'self' https://accounts.google.com https://maps.googleapis.com
```

**Helmet** (`apps/api/config/helmet.js`) — CSP des réponses API :
```
img-src 'self' data: blob:
connect-src 'self'
```

### 🔴 Violation img-src — QR codes externes

| Fichier | Ligne | URL externe |
|---|---|---|
| `EquipmentBatchLabels.jsx` | 149 | `https://api.qrserver.com/v1/create-qr-code/...` |
| `EquipmentLabelPrint.jsx` | 153 | `https://api.qrserver.com/v1/create-qr-code/...` |
| `EquipmentSheetPrint.jsx` | 157 | `https://api.qrserver.com/v1/create-qr-code/...` |

**Impact** : Les QR codes d'équipement sont **bloqués en production** par la CSP Vite.  
Le domaine `api.qrserver.com` n'est dans aucune des deux CSP.

**Solutions possibles** (par préférence) :
1. **Générer les QR codes localement** avec `qrcode` (npm) — élimine la dépendance externe
2. Ajouter `https://api.qrserver.com` à `img-src` dans Vite + Helmet

### ⚠️ CSP Helmet trop restrictive vs Vite

La CSP Helmet ne contient PAS les Google APIs (`googleapis.com`, `gstatic.com`, `accounts.google.com`). Si des réponses API HTML sont rendues directement (peu probable mais possible), Google Maps/Auth ne fonctionnerait pas.

→ **Impact faible** : Vite est le seul serveur de pages HTML. L'API ne sert que du JSON.

### ⚠️ connect-src Helmet manque Google APIs

Si le navigateur utilise la CSP Helmet (peu probable pour le frontend), les appels `fetch` vers Google APIs seraient bloqués.

→ Même analyse : impact faible car CSP Vite prend le relais.

---

## 4. Erreurs 404 API

### ✅ Aucune erreur 404 détectée

175+ endpoints frontend ont **tous** un backend correspondant. Audit complet :
- `/api/leaves/conflicts` → `leaveRoutes.js:1378` ✅
- `/api/leaves/stats` → `leaveRoutes.js:1307` ✅
- Tous les `/stats` endpoints existent ✅

---

## 5. crypto.randomUUID()

### Contexte

- **Node.js v22.18.0** : `crypto.randomUUID()` est stable et supporté ✅
- **Navigateurs** : Disponible dans les navigateurs **modernes en contexte sécurisé (HTTPS)** uniquement.
  - Chrome 92+, Firefox 95+, Safari 15.4+
  - ❌ **Non disponible en HTTP** ni dans les WebWorkers sans HTTPS

### Backend (Node.js) — ℹ️ OK

14 usages avec `import crypto from 'crypto'` — **parfaitement supporté** sur Node 22 :

| Fichier | Occurrences |
|---|---|
| `planningRoutes.js` | 11 |
| `catalogRoutes.js` | 1 |
| `suiviRoutes.js` | 3 |

### ⚠️ Frontend — 2 fichiers à risque

| Fichier | Ligne | Problème | Fallback ? |
|---|---|---|---|
| `FicheSuivi.jsx` | 21 | `crypto.randomUUID()` | ❌ Aucun |
| `FicheSuivi.jsx` | 41 | `crypto.randomUUID()` | ❌ Aucun |
| `useGoogleSync.js` | 138 | `crypto.randomUUID?.()` | ✅ `Math.random().toString(36)...` |

**Impact** : `FicheSuivi.jsx` crashera sur :
- Navigateurs anciens (pre-Chrome 92)
- Accès HTTP (non-HTTPS)
- Certains WebViews Android

**Correction** : Ajouter un helper `generateId()` avec fallback.

---

## 6. Forced Reflow Patterns

### ⚠️ Moyens — Lecture layout dans boucles

| Fichier | Ligne | Pattern | Impact |
|---|---|---|---|
| `Calendar.jsx` | 303 | `leftChild.offsetHeight` dans `forEach` | Lecture répétée de layout dans une boucle → forced reflow potentiel si les dimensions changent entre itérations |
| `GoogleCalendarBanner.jsx` | 289 | `window.getComputedStyle(calendarGrid)` dans handler resize | Coûteux si appelé fréquemment |

### ℹ️ Faibles — Patterns acceptables

| Fichier | Ligne | Pattern | Justification |
|---|---|---|---|
| `useDraggableModals.js` | 110-111 | `getBoundingClientRect` + `getComputedStyle` | One-shot au début du drag |
| `useCalendarDrag.js` | 283, 435 | `getBoundingClientRect` | Mesure initiale |
| `DepotMap.jsx` | 306 | `getBoundingClientRect` | Ponctuel au click |
| `DepotMapEditor.jsx` | 431, 512 | `getBoundingClientRect` | Ponctuel |

### Recommandation pour Calendar.jsx:303

Battre les lectures **avant** les écritures :
```js
// ❌ Actuel : lecture + écriture entrelacées dans la boucle
leftChildren.forEach((leftChild, i) => {
  const h = leftChild.offsetHeight; // LECTURE → force reflow
  gridChild.style.height = `${h}px`; // ÉCRITURE
});

// ✅ Corrigé : séparer lectures et écritures
const heights = leftChildren.map(c => c.offsetHeight); // toutes les lectures d'abord
heights.forEach((h, i) => {
  gridChild.style.height = `${h}px`; // puis toutes les écritures
});
```

---

## 7. Plan de Correction

### Priorité 1 — Critique (à corriger maintenant)

1. **useSwipeAction.js** : Convertir `onTouchMove` React en `addEventListener` imperatif `{ passive: false }`
2. **FicheSuivi.jsx** : Ajouter fallback pour `crypto.randomUUID()`

### Priorité 2 — Moyenne (perf/compat)

3. **Calendar.jsx** : Ajouter `{ passive: true }` aux 2 scroll listeners
4. **GoogleCalendarBanner.jsx** : Ajouter `{ passive: true }` aux 2 scroll listeners
5. **Calendar.jsx** : Séparer lectures/écritures dans `syncRowHeights`
6. **QR Codes** : Remplacer `api.qrserver.com` par génération locale

### Priorité 3 — Faible (hardening)

7. **CSP Helmet** : Aligner les sources Google avec la CSP Vite (par cohérence)

### Pas de correction nécessaire

- ❌ 404 API → Aucun trouvé
- ❌ Backend `crypto.randomUUID()` → Node 22 le supporte nativement
- ❌ `passive: false` sur DepotMap/DepotMapEditor → Correctement marqués
- ❌ Autres `addEventListener` → Events non-cancelables

---

*Rapport généré automatiquement — validation manuelle requise avant application.*
