# Plan de correction S2 — eM@g

**Date** : 7 mai 2026  
**Audit source** : [AUDIT-COMPLET-2026-05-06.md](AUDIT-COMPLET-2026-05-06.md) §0 « Top 5 leviers »  
**S1 finalisé** : commits `1c2244f5..cd892f05` poussés sur `origin/dev`

---

## Synthèse

| # | Item | Effort | Risque régression | ROI | Ordre proposé |
|---|------|:---:|:---:|:---:|:---:|
| S2-3 | Cache LRU sur 5 endpoints lecture chauds | Faible (1/2j) | Faible | Élevé | **1** |
| S2-4 | Réactivation Sentry / error tracking | Faible (config) | Nul | Moyen | **2** |
| S2-2 | Pagination obligatoire listes >100 items | Moyen (1-2j) | Moyen (contrat API) | Moyen | **3** |
| S2-1 | Split `database.js` (3856 LOC) + `suiviRoutes.js` (2835 LOC) | Élevé (3-5j) | Élevé | Faible immédiat | **4** |
| S2-5 | Backups DB hors git | — | — | — | ✅ déjà fait (S1-03) |

> **Principe** : items indépendants, validables un par un, commit dédié, tests entre chaque.  
> **Contrainte respectée** : pas de modification du TV client (`apps/tv-client/`).

---

## S2-3 — Cache LRU lecture (priorité 1)

### Objectif
Réduire la latence et la charge CPU sur les endpoints les plus lus en cachant les réponses pour 30s à 5 min selon volatilité.

### Cibles (5 endpoints)
| Endpoint | Fichier | TTL proposé | Invalidation |
|---|---|---|---|
| `GET /api/equipment` (liste) | `equipmentRoutes.js:150` | 60s | `POST/PUT/DELETE /api/equipment*` |
| `GET /api/equipment-categories/tree` | `equipmentRoutes.js:52` | 5 min | `POST/PUT/DELETE /api/equipment-categories*` |
| `GET /api/personnel/planning` | `personnelRoutes.js:1557` | 30s | mutations planning |
| `GET /api/suivi/personnel` | `suiviRoutes.js:1719` | 60s | mutations suivi |
| `GET /api/annuaire/ref/all` | `annuaireRoutes.js` | 10 min | mutations ref tables |

### Implémentation
1. **Module dédié** `apps/api/cache/lruCache.js` :
   - Dépendance : `lru-cache` (~10 ko, déjà transitive ?). Sinon implémentation maison Map+TTL (~40 LOC).
   - Export : `getCache(name, { max, ttl })` → instance par scope
   - API : `cache.get(key)`, `cache.set(key, val)`, `cache.invalidate(predicate?)`
2. **Middleware `cacheRead(cacheInstance, keyFn)`** : wrap handler GET, lit cache, sinon exécute et stocke
3. **Hooks d'invalidation** : appel explicite dans handlers POST/PUT/DELETE concernés
4. **Bypass** : header `Cache-Control: no-cache` côté client → recompute
5. **Métriques** : compteur `cache_hits` / `cache_misses` exposé sur `/api/admin/cache-stats` (admin only)

### Tests
- `tests/cache.test.js` : hit/miss/expiration/invalidate
- Smoke : 2 GET successifs → 2e doit être <5ms
- Régression : muter une catégorie → vérifier next GET reflète changement

### Critères d'acceptation
- 5 endpoints cachés, hit rate >70% sur logs après 1h
- Aucune régression fonctionnelle
- Cache vidé sur reload SIGHUP

### Estimation : 4-6h

---

## S2-4 — Sentry / error tracking (priorité 2)

### Objectif
Recevoir notifications proactives sur erreurs serveur + traces stack remontées, plutôt que de les découvrir via logs PM2.

### Implémentation
1. **Création projet Sentry** (Node.js) — utilisateur à effectuer hors code
2. **Variable d'env** `SENTRY_DSN` (vide = désactivé, fail-safe)
3. **Module** `apps/api/observability/sentry.js` :
   - Init `@sentry/node` au boot si DSN présent
   - `Sentry.Handlers.requestHandler()` + `errorHandler()` middlewares
   - Tag environnement (`prod`/`dev`), version (depuis `package.json`)
   - Sample rate 100% erreurs, 10% transactions
4. **Filtrage** : exclure 404, 401, 403 (bruit)
5. **Côté frontend** (optionnel, hors scope si non demandé) : `@sentry/react`

### Pré-requis utilisateur
- DSN Sentry à fournir (ou je crée une config inactive avec placeholder)
- Confirmation : 1 projet partagé back+front, ou 2 projets ?

### Tests
- Boot avec DSN vide → no-op, pas de crash
- Boot avec DSN factice → init OK, 1 erreur déclenchée volontairement
- Vérifier event reçu dans dashboard Sentry (manuel)

### Estimation : 2-3h (hors création compte)

---

## S2-2 — Pagination listes >100 items (priorité 3)

### Objectif
Empêcher OOM frontend + lenteur réseau sur retours JSON >10 Mo.

### Cibles probables (à confirmer par mesure)
- `GET /api/equipment` (peut renvoyer 5000+ lignes)
- `GET /api/orders` 
- `GET /api/suivi/incidents/tickets/:week`
- `GET /api/personnel`
- `GET /api/annuaire/contacts`

### Implémentation
1. **Helper** `apps/api/utils/pagination.js` :
   - Parse `?page=1&limit=100&sort=col:asc`
   - Limites : `limit ≤ 500`, `page ≥ 1`
   - Retour standardisé : `{ data: [], pagination: { page, limit, total, totalPages } }`
2. **Migration progressive** : nouveaux paramètres optionnels, comportement actuel = défaut si absents (rétro-compat)
3. **Header de dépréciation** sur appels non paginés : `Deprecation: true, Sunset: ...`
4. **Frontend** : adapter hooks `useEquipment`, `useOrders`, etc. pour consommer pagination + scroll infini ou pagination explicite

### Risque
- Casse contrat API si frontend pas adapté → mode rétro-compat impératif
- TV client n'utilise pas ces endpoints (à vérifier) — sinon STOP

### Tests
- `?page=2&limit=50` retourne items 51-100
- `?limit=99999` plafonné à 500
- `?page=999` retourne `{ data: [], pagination: {...} }`
- Régression : appel sans paramètres = comportement legacy

### Estimation : 1-2j (back + front)

---

## S2-1 — Split fichiers monolithiques (priorité 4)

### Objectif
Améliorer maintenabilité long terme. **Pas un fix urgent** — à programmer en sprint dédié.

### Plan de découpage suggéré
- `database.js` (3856 LOC) → 
  - `database/init.js` (open, pragmas, schema bootstrap)
  - `database/migrations.js` (déjà séparé en partie)
  - `database/maintenance.js` (WAL, vacuum, scheduler)
  - `database/index.js` (export `db`)
- `suiviRoutes.js` (2835 LOC) →
  - `suivi/personnelRoutes.js`
  - `suivi/incidentRoutes.js`
  - `suivi/syntheseRoutes.js`
  - `suivi/pdfRoutes.js`

### Risque
- 100% des routes touchées potentiellement → tests critiques
- Recommandation : feature branch dédiée + PR review humaine + déploiement staging

### Estimation : 3-5j

### **Décision** : reporté à un sprint dédié. Pas dans cette série S2.

---

## Calendrier proposé

1. **Aujourd'hui** : S2-3 (cache LRU) — feature complète + tests + commit
2. **Demain** : S2-4 (Sentry config + module) — attend DSN utilisateur
3. **J+2/J+3** : S2-2 (pagination) — back puis front
4. **Sprint séparé** : S2-1 (refactor monolithes) — sortir du périmètre S2

## Validation requise

- [ ] Confirmer ordre 1→4
- [ ] Confirmer choix `lru-cache` vs implémentation maison
- [ ] Confirmer création projet Sentry (tu fournis DSN, ou on stub temporairement ?)
- [ ] Confirmer scope pagination (5 endpoints listés OK ?)
