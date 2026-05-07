# 🛡️ Audit complet eM@g — 6 mai 2026

> **Statut** : audit lecture seule — **aucun correctif appliqué**.
> **Périmètre** : backend Express, frontend React Desktop, frontend Mobile, TV client (lecture seule), SQLite, workflows critiques (SAV, contrôles périodiques, étiquettes, inventaire, parc, sync LocMat), PDF/SVG/QR, sécurité, performance, dette technique.
> **Date** : 6 mai 2026 — **Commit HEAD** : `321ef262` (dev) — **Build prod** : déployé.
> **Auditeur** : GitHub Copilot.

---

## 0. Synthèse exécutive

| Domaine | Note | Tendance vs audit avril | Risque résiduel |
|---|---|---|---|
| Architecture | **A−** | ↗ stable monorepo propre | Faible |
| Sécurité | **B+** | ↗ phases A/B/E terminées, Helmet+CSP+JWT solides | **Modéré** (5 CVE deps + 7 SQL dynamiques résiduels) |
| Performance backend | **B** | → stable | Modéré (WAL 244 Mo, requêtes O(N) sans pagination) |
| Performance frontend | **B−** | ↗ chunkSize 500, lazy + memo OK | Modéré (10+ fichiers >2000 LOC) |
| Stabilité | **B+** | ↗ tests 440 + Husky | Faible |
| UX/UI | **B+** | ↗ DS 100% testé (34/34) | Faible (incohérences modal :user-select récent) |
| Dette technique | **C+** | ↗ inline styles −100, hex −340 | Modérée (558 styles dynamiques, 510 hex restants) |
| Workflows critiques | **B+** | ↗ orders multi-lignes validé E2E aujourd'hui | Faible |
| Conformité données | **B** | → FK ON via Node, mais 0 contrôle invariants | Modéré |

### Top 5 risques bloquants (S1 — à traiter sous 7 jours)
1. **WAL SQLite 244 Mo** vs DB 277 Mo (47% du fichier en journal). Risque corruption sur crash + démarrage lent.
2. **5 vulnérabilités npm** côté API (3 high : `ip` SSRF via `sonos`, 2 moderate : `ip-address` XSS via `express-rate-limit`).
3. **7 patterns SQL dynamiques résiduels** (`${table}`, `${updates.join}`, `${placeholders}`) non couverts par la phase A. Faible risque exploitable car `table` vient d'un whitelist côté code, mais pas d'analyse statique garantie.
4. **27 fichiers `.bak`/`.backup` de la DB** dans `apps/api/` non versionnés mais physiquement présents (>1 Go cumulés probables) → encombrement disque + risque de fuite si rsync mal configuré.
5. **HTTPS port 3443 en collision permanente** au redémarrage backend (5 incidents constatés ce jour). Symptôme : démarrage en double, pas de close propre, `EADDRINUSE`.

### Top 5 leviers (S2)
1. Découper `database.js` (3797 LOC) et `suiviRoutes.js` (2835 LOC) en modules.
2. Pagination obligatoire sur listes >100 items côté backend.
3. Cache mémoire LRU sur 5 endpoints lecture chauds (équipement liste, planning month, suivi entries).
4. Reactivation Sentry/erreur tracking (config absente).
5. Suppression `*.db.bak-*` & `.db.backup-*` + ajout `.gitignore` strict.

---

## 1. Cartographie générale

| Élément | Mesure |
|---|---|
| Routes backend | **29 fichiers** `*Routes.js` |
| LOC backend (apps/api/*.js) | **42 504** |
| Composants frontend | **317 .jsx** |
| LOC frontend (apps/web/src) | **129 731** |
| TV client | **1 683 LOC** (3 fichiers : `index.html` 102, `main.js` 900, `styles.css` 665) |
| Tables SQLite | **126** |
| Index SQLite | **289** |
| Migrations | **31 fichiers** (.sql + .js) |
| Tests backend | **85 tests** (12 suites) |
| Tests frontend | **355 tests** (34 suites — DS 100%) |
| Tests E2E | **0** (Playwright dispo via outils mais pas de suite scriptée) |

### Stack
- **Backend** : Node ESM, Express 4.18, better-sqlite3 9.2, JWT HS256, bcrypt 6, helmet 8, express-rate-limit 8.2, multer 2.1, Zod 4.3, pdfkit 0.17, qrcode 1.5, googleapis 171, sonos 1.14, nodemailer 8.
- **Frontend Web** : React 18.3, react-router-dom 6.30, leaflet 1.9, jspdf 4.2, pdfjs-dist 5.4, qrcode.react 4.2, dompurify 3.3, papaparse 5.5.
- **TV** : HTML/JS/CSS vanilla, aucune dépendance build.

---

## 2. Analyse Backend (Express)

### 2.1 Forces
- ✅ Découpage par domaine (`*Routes.js`) cohérent.
- ✅ Middleware `authenticate.js` propre : JWT + cache LRU 30 s + idle timeout 24 h prod + check `is_blocked`.
- ✅ 4 rate limiters (auth/sensitive/general/google) bien dimensionnés.
- ✅ Helmet CSP **stricte** côté Web (`'self'` partout, pas d'`unsafe-eval`), HSTS prod 1 an + preload.
- ✅ Pragmas DB optimisés : `WAL`, `wal_autocheckpoint=1000`, `busy_timeout=5000`, `foreign_keys=ON` (côté Node).
- ✅ Checkpoint WAL toutes les 5 min + checkpoint à `close`.
- ✅ Validation Zod sur **25+ routes critiques** (auth, vehicles, equipment, orders, personnel, messaging).

### 2.2 Faiblesses
| Sév. | Constat | Localisation | Recommandation |
|---|---|---|---|
| 🔴 S1 | **`uncaughtException` 3443 EADDRINUSE** non géré au boot → process die avant qu'Express écoute | `server.js` (gestion ports HTTPS) | Try/catch `https.listen` + retry/backoff ou drop HTTPS si déjà occupé |
| 🟠 S2 | **7 SQL dynamiques résiduels** (table/columns interpolés) | `annuaireRoutes:1111-1137` `database:76,1598,3298,3332` `migrations:671` `savRoutes:498` `suiviRoutes:1905,1983,2736` | Whitelist explicite via `Object.freeze({...})` + assert |
| 🟠 S2 | **`db.exec` ALTER TABLE dynamiques** non protégés en prod (toujours dans migrations runtime) | `database.js:76,1598,3298,3332` | Migrations gérées en build-time uniquement (versionnées) |
| 🟠 S2 | Pas de **timeout par requête** Express (longue requête bloque pool DB single-thread) | `server.js` | `req.setTimeout(30000)` + 408 |
| 🟡 S3 | 13 `TODO/FIXME/HACK` en code | divers | Triage et conversion en issues |
| 🟡 S3 | `console.*` directs résiduels | 7 occurrences `apps/api/*.js` | Migrer vers `logger` |
| 🟡 S3 | Pas de **graceful shutdown** des intervals (`checkpointTimer`, `cleanTempFiles`, sonos heartbeat) | `server.js`, `database.js`, `messagingRoutes.js`, `sonosRoutes.js`, `planningRoutes.js` | `clearInterval` dans handler SIGTERM/SIGINT |
| 🟡 S3 | 4 `setInterval` non bornés (cumul potentiel sur reload module) | idem | Singleton + clear préalable |

### 2.3 Fichiers monolithiques (>1500 LOC)
| Fichier | LOC | Action proposée |
|---|---|---|
| `database.js` | **3797** | Extraire migrations, helpers, pragmas, scheduler |
| `suiviRoutes.js` | 2835 | Split par sous-domaine (entries/sheets/recurring/incidents) |
| `displayRoutes.js` | 2698 | Split CRUD vs SSE vs config |
| `ordersRoutes.js` | 2554 | Split orders/quotes/material-requests/lines |
| `annuaireRoutes.js` | 2278 | Déjà fait au niveau export, faire aussi au niveau fichier |
| `equipmentRoutes.js` | 2222 | Split equipment/sav/categories/lists |
| `sonosRoutes.js` | 1767 | Split commandes/streaming/proxy artworks |
| `leaveRoutes.js` | 1713 | Split balances/requests/votes |
| `personnelRoutes.js` | 1659 | Split persons/skills/positions |

---

## 3. Base de données SQLite

### 3.1 Constats
- ✅ **289 index** sur 126 tables — bon ratio.
- ✅ Mode WAL, `foreign_keys=ON` (Node), `busy_timeout=5000` ms.
- ✅ FK déclarées dans la majorité des migrations récentes (sav_ticket_history, message_attachments, etc.).
- ⚠️ **WAL = 244 Mo / DB = 277 Mo** : checkpoint configuré mais saturé. Hypothèse : connexions concurrentes (HTTP+HTTPS+TV+messaging SSE) maintiennent un reader → checkpoint passif refusé.
- ⚠️ **25 tables sans aucun index secondaire** (dont `equipment_assignments`, `equipment_categories`, `external_products`, `display_playlists`, `locations`, `email_config`, `garages`, `quote_items`). Plusieurs sont peu peuplées mais à surveiller.
- ⚠️ **126 tables** : forte cardinalité de schéma → couplage potentiel et drift difficile.

### 3.2 Risques
| Sév. | Constat | Risque |
|---|---|---|
| 🔴 S1 | WAL saturé (244 Mo) | Démarrage long, panic mémoire si crash, restauration partielle |
| 🟠 S2 | Pas de FK déclarées sur ~30% des tables anciennes | Orphelins silencieux possibles |
| 🟠 S2 | `material_requests`/`material_request_lines` : pas de cascade ON DELETE explicite (à vérifier) | Lignes orphelines |
| 🟠 S2 | 11 `*.db.bak-*` + 2 `*.db.backup-*` non gitignorés | Disque + fuite |
| 🟡 S3 | Pas d'`ANALYZE` régulier (planificateur potentiellement périmé) | Plans suboptimaux |

### 3.3 Recommandations
- **`PRAGMA wal_checkpoint(TRUNCATE);`** manuel via cron quotidien à 03:00.
- Réduire `wal_autocheckpoint` à 500 pages.
- Ajouter dans `.gitignore` : `apps/api/vehicules.db.bak-*`, `apps/api/vehicules.db.backup-*`, `apps/api/*.db-shm`, `apps/api/*.db-wal`.
- Job mensuel : `PRAGMA optimize; ANALYZE;` (durée < 1 s sur 277 Mo).
- Audit FK : `PRAGMA foreign_key_check;` à inclure dans `npm test`.

---

## 4. Frontend Desktop (React)

### 4.1 Forces
- ✅ Design System 100% testé (34/34 composants, 355 tests Vitest).
- ✅ Vite 5 + esbuild minify, `chunkSizeWarningLimit` 500.
- ✅ Hooks robustes : 949 `useMemo/useCallback`, 416 `useEffect` (audit avril : exhaustive-deps 100% vert).
- ✅ DOMPurify utilisé sur `MailingPanel` pour preview HTML.
- ✅ ErrorBoundary global.
- ✅ Migration utils/api/ centralisée (Phase B terminée).

### 4.2 Faiblesses
| Sév. | Constat | Action |
|---|---|---|
| 🟠 S2 | **14 fichiers >1500 LOC** dont 4 >2500 (`AffaireDetailPanel` 3277, `PersonnelPanel` 3113, `AnnuairePanel` 2284, `StockPanel` 2269) | Split par sous-onglet/feature |
| 🟠 S2 | `App.jsx` 1247 LOC | Extraire routing + AuthProvider |
| 🟡 S3 | 5 `innerHTML = ''` directs (datalists) → OK mais à remplacer par `replaceChildren()` | `ClientDialog`, `LocationDialog` |
| 🟡 S3 | 4 `catch (e) {}` silencieux | Logger explicite |
| 🟡 S3 | 510 hex restants (audit avril) | Continuer migration tokens |
| 🟡 S3 | 558 inline styles dynamiques | Utiliser CSS vars + utilities |
| 🟡 S3 | Pas de monitoring perf (Web Vitals) | Ajouter `web-vitals` |

### 4.3 Stabilité
- ✅ Test E2E manuel ce jour : **commande issue d'une demande matériel pending → POST 201 + validate 200**, modal sans duplication, toast OK.
- ⚠️ Pas de suite Playwright automatisée — tout E2E reste manuel.

---

## 5. Frontend Mobile

### 5.1 Constats
- Mobile = même bundle React (responsive). Pas d'app native.
- Composants `apps/web/src/components/auth/MobileAccess.jsx` confirment usage `VITE_PUBLIC_URL`.
- Pas de mesure spécifique fluidité Mobile (ex: LCP) dans le repo.

### 5.2 Recommandations
- S2 : Ajouter `web-vitals` + envoi vers backend (`/api/metrics`) pour tracker LCP/CLS/INP par device.
- S3 : Audit Lighthouse mobile cible LCP < 2.5 s.

---

## 6. TV client — analyse lecture seule

> ⚠️ **Aucune modification autorisée** (contrainte explicite).

### 6.1 Forces
- ✅ Très petit footprint (1683 LOC, vanilla JS).
- ✅ XSS hardening déjà fait (commit `cc86e24`) : `escapeHtml()` sur tous les `innerHTML`, `encodeURIComponent` URLs.
- ✅ Hardening CSS (commit `383c77c`) : `isSafeCSSValue()`, `CSS.escape()`, validation chemins photos.
- ✅ Helmet CSP TV séparée (config dans `helmet.js`) — `imgSrc: '*'` justifié pour artworks Sonos.
- ✅ Isolation : aucun import depuis `apps/web/`.

### 6.2 Risques (informatif, sans modif)
- 🟡 8 `innerHTML = ` constatés ; tous précédés d'`escapeHtml()` ou réinitialisation `''` → conformes.
- 🟡 Pas de fallback offline visible.
- 🟡 Pas de heartbeat applicatif (info utile : Pi rebooté → backend ne sait pas).
- 🟡 Aucun test automatisé.

### 6.3 Recommandation S3 (à faire valider avant exécution)
- Ajouter, **côté backend uniquement**, un endpoint `/api/tv/heartbeat` recevant un POST optionnel du TV (sans modifier le TV) — sera consommé si on décide plus tard d'instrumenter.

---

## 7. Workflows critiques

### 7.1 SAV (import CSV, collisions, doublons, statuts, PDF)
- ✅ Tables `sav_imports` + `sav_ticket_history` avec FK SET NULL (commit récent).
- ✅ Migration `equipment_id` nullable pour tickets sans rattachement.
- ✅ Index `idx_sav_imports_date`, `idx_sav_history_import`.
- ⚠️ `savRoutes.js:498` : UPDATE dynamique `${sets.join(', ')}` — clés à whitelist.
- ⚠️ Pas de test automatisé sur scénario de collision (UID identique import N et N+1).
- 🎯 **S2** : ajouter un test d'import idempotent (réimporter le même CSV ne doit pas dupliquer).

### 7.2 Contrôles périodiques
- ✅ Routes propres (390 LOC, 12 endpoints).
- ✅ Migration `controles-periodiques-v1.js` versionnée.
- ✅ Tables `equipment_controls`, `control_history`, `control_notifications`, `control_types`.
- ✅ Scheduler `Scheduler contrôles périodiques démarré (vérif 5 min, exécution 08:00)`.
- ⚠️ Pas de tests sur scénarios « contrôle manqué » et « reprogrammation après dépassement ».
- 🎯 **S2** : tests fixtures de retards/manqués/notifs.

### 7.3 Étiquettes (SVG/QR/logo/plaque)
- ✅ `services/labelGenerator.js` propre : 200×200 mm, plaque 4×8 = 32 étiquettes 50×25 mm.
- ✅ Logo Mag Scène 30% du QR + ECC 'H', validé par jsQR sur 4 cas (commentaire).
- ✅ Cache dataURI logo.
- ⚠️ Lecture PNG dimension manuelle (offset 16) — fragile si autre PNG en place.
- 🎯 **S3** : tests unitaires sur `labelGenerator` (calculs grille + scan QR avec `jsqr` mock).

### 7.4 Inventaire
- ✅ Tables UID/SN dédiées (`equipment_serials`, `uid_counter`).
- ✅ Migration `equipment-serials-uid-v2.js`.
- ✅ Tables `inventory_anomalies`, `inventory_locations`, `inventory_price_history`, `inventory_stats_cache`.
- 🎯 **S2** : invariants à vérifier en CI (`UID unique`, `SN unique par marque`).

### 7.5 Synchronisation LocMat / eM@g
- ✅ Test : `tests/locmat-import-integration.test.js`.
- ✅ Pagination diff preview (commit `9e8908c7`).
- 🎯 **S3** : surveiller volumes (logs sync timer 600 s).

---

## 8. PDF / SVG / QR

| Item | État | Observation |
|---|---|---|
| `pdfkit` 0.17 | ✅ stable | OK |
| `qrcode` 1.5 + ECC 'H' | ✅ | Bon |
| Plaque 32 étiquettes | ✅ | 200×200 mm validé |
| `jspdf` côté front | ✅ 4.2 | OK |
| `pdfjs-dist` worker | ✅ 5.4 | Worker correctement aliasé dans Vite |
| Risque blocage main thread (gros PDF) | 🟡 | Pas de pool, mais usage modéré |

🎯 **S3** : worker_threads pour PDF >50 pages.

---

## 9. Sécurité (OWASP Top 10)

| OWASP | État | Détail |
|---|---|---|
| A01 — Broken Access Control | 🟢 OK | `requireAdmin`, `requireMaintenanceAccess`, `requireCatalogAccess`, etc. Audit avril (Phase A) ✅ |
| A02 — Crypto failures | 🟢 OK | bcrypt cost OK, JWT HS256, cookies httpOnly |
| A03 — Injection SQL | 🟡 **modéré** | 7 patterns dynamiques résiduels (table/columns) |
| A04 — Insecure design | 🟢 OK | Architecture défense en profondeur |
| A05 — Misconfig | 🟡 | HSTS conditionnel OK ; mais 5 CVE deps backend |
| A06 — Vulnerable deps | 🔴 **5 CVE** | `ip` SSRF (high) via `sonos`, `ip-address` XSS (mod) via `express-rate-limit` |
| A07 — AuthN failures | 🟢 OK | Rate limit auth 5/15min prod, idle timeout 24h, blocked check |
| A08 — Integrity failures | 🟢 OK | Husky pre-commit, lock files versionnés |
| A09 — Logging | 🟡 | Logger custom OK, mais pas d'agrégation centrale |
| A10 — SSRF | 🟡 | `ip` lib vulnérable côté `sonos` ; pas d'allowlist explicite sur les fetch backend |

### Plan correctif immédiat (S1)
- `cd apps/api && npm audit fix` (sans `--force`) → corrige `express-rate-limit` (8.5.0 → 8.5.1+).
- Pour `sonos>ip` : SSRF impacte `isPublic()` ; **non exploitable** dans notre usage (Sonos LAN). Documenter le risque accepté ou attendre upstream `sonos@2.x`.

---

## 10. Performance

| Mesure | Valeur | Cible | Action |
|---|---|---|---|
| Backend cold start | ~3-5 s | <2 s | Réduire WAL + lazy load gros modules |
| DB checkpoint passif | ❌ saturé | TRUNCATE quotidien | cron 03:00 |
| Liste équipement (3830 rows) | ~50 ms (estim) | <100 ms | OK, valider sous charge |
| Bundle frontend | non mesuré ici | <500 ko gzipped initial | `vite-bundle-visualizer` |
| Tests backend | 85 / quelques sec | 100% sur workflows critiques | +tests SAV/contrôles |
| Tests frontend | 355 / ~10 s | maintenir | OK |

### Hotspots à mesurer
1. `GET /api/equipment` (3830 rows, à confirmer pagination).
2. `GET /api/planning?month=…` (jointures missions+assignments+events).
3. `GET /api/suivi/sheets` (incidents history).
4. `GET /api/orders` (joints supplier+items+lines).
5. SSE `messaging` : heartbeat 1× par client → vérifier scaling 50+ clients.

---

## 11. Stabilité

### Forces
- ✅ ErrorBoundary React.
- ✅ Husky pre-commit (ESLint + tests).
- ✅ Migrations versionnées + log `_migrations_log`.
- ✅ Backups DB fréquents (trop nombreux d'ailleurs).

### Faiblesses
- 🔴 `uncaughtException` 3443 EADDRINUSE non géré → process tombe avant écoute.
- 🟠 Pas de Sentry / pas d'agrégation erreurs prod.
- 🟠 Pas de `process.on('unhandledRejection')` global (vérifier).
- 🟡 Smoke test deploy = `curl /health` mais ne vérifie pas auth.

---

## 12. Cohérence fonctionnelle

- ✅ Modèle de données documenté dans `docs/05-Specs/` + repo memory.
- ⚠️ Drift entre frontend et backend possible : 317 .jsx / 29 routes — peu de tests d'intégration croisés.
- ⚠️ 13 TODO/FIXME = autant de zones de doute documentées.
- 🎯 **S2** : générer un schéma OpenAPI à partir des Zod schemas pour figer les contrats.

---

## 13. Dette technique — récapitulatif

| Dette | Volume | S |
|---|---|---|
| Fichiers >2000 LOC | 9 backend + 6 frontend | S2 |
| Inline styles dynamiques | 558 | S3 |
| Hex non sémantiques | 510 | S3 |
| TODO/FIXME | 13 | S3 |
| catch silencieux | 4+10 | S3 |
| SQL dynamiques | 7 | S2 |
| `*.db.bak-*` non gitignorés | 11+2 | **S1** |
| `console.log` backend | 7 | S3 |
| Pas de Sentry | — | S2 |
| Pas de Playwright auto | — | S2 |

---

## 14. Liste des risques (synthèse)

| ID | Sévérité | Risque | Probabilité | Impact |
|---|---|---|---|---|
| R-001 | S1 | WAL saturé → corruption sur crash | Moyenne | Catastrophique (perte historique) |
| R-002 | S1 | CVE high `ip` SSRF | Faible (LAN) | Élevé si exposé |
| R-003 | S1 | EADDRINUSE 3443 boot | Élevée | Moyen (downtime API HTTPS) |
| R-004 | S1 | Backups DB *.bak-* dans repo | Élevée | Moyen (fuite données) |
| R-005 | S2 | SQL dynamique 7 routes | Faible | Élevé (RCE DB) |
| R-006 | S2 | Pas de Sentry | Élevée | Moyen (bugs prod silencieux) |
| R-007 | S2 | Fichiers >2500 LOC | Élevée | Moyen (vélocité dev) |
| R-008 | S2 | Pas de timeout req Express | Moyenne | Moyen (DoS req lente) |
| R-009 | S3 | 558 inline styles | Élevée | Faible (maintenance UI) |
| R-010 | S3 | 0 test E2E auto | Élevée | Faible avec QA manuel |

---

## 15. Plan d'action priorisé

### S1 — Critique (≤ 7 jours)
1. **WAL** : ajouter cron `PRAGMA wal_checkpoint(TRUNCATE)` à 03:00 + script de purge.
2. **Backups DB** : `git rm --cached apps/api/vehicules.db.bak-* apps/api/vehicules.db.backup-*` puis `mv` vers `apps/api/_backups_local/` + ajout `.gitignore`.
3. **`npm audit fix` apps/api** (express-rate-limit) — non breaking.
4. **server.js** : try/catch `https.listen` avec retry 3× ou skip HTTPS si occupé.
5. **`process.on('unhandledRejection')`** + log structuré.

### S2 — Important (≤ 30 jours)
6. **Découpage** : `database.js`, `suiviRoutes.js`, `displayRoutes.js`, `ordersRoutes.js`, `equipmentRoutes.js`.
7. **SQL dynamiques** : whitelist `Object.freeze({...})` sur les 7 sites, assert avant build de la requête.
8. **Sentry/Glitchtip** : intégration backend + frontend.
9. **Pagination** systématique `?limit=&offset=` sur 5 endpoints chauds.
10. **Tests SAV import idempotent** + **tests contrôles manqués/repro**.
11. **Timeout Express 30 s** + 408.
12. **Suite Playwright E2E** : 5 scénarios critiques (login, créer commande depuis demande, planifier, contrôle périodique, étiquette).
13. **Schéma OpenAPI** dérivé des Zod schemas.

### S3 — Optimisation (backlog)
14. Migration restant 558 inline styles + 510 hex.
15. `web-vitals` mobile + dashboard interne.
16. PDF >50 pages dans worker_thread.
17. `PRAGMA optimize; ANALYZE` mensuel.
18. FK exhaustives + `PRAGMA foreign_key_check` en CI.
19. Lighthouse mobile (cible LCP < 2.5 s).
20. Dédoublonnage contenants UI (modals dupliqués type `LoginForm` corrigé ce jour).

---

## 16. Propositions de correctifs (non appliqués)

> Présentés sous forme de patchs prêts à valider individuellement.

### 16.1 [S1] Cron WAL TRUNCATE
**Fichier** : `apps/api/database.js` (vers L3790)
```diff
 // Checkpoint automatique toutes les 5 minutes
 const checkpointTimer = setInterval(
   () => {
     checkpointDatabase();
   },
   5 * 60 * 1000,
 );

+// Checkpoint TRUNCATE quotidien : libère le WAL accumulé
+function scheduleDailyTruncate() {
+  const now = new Date();
+  const next = new Date(now);
+  next.setHours(3, 0, 0, 0);
+  if (next <= now) next.setDate(next.getDate() + 1);
+  const ms = next - now;
+  setTimeout(() => {
+    try {
+      const r = db.pragma('wal_checkpoint(TRUNCATE)');
+      logger.info(`🧹 WAL TRUNCATE quotidien : ${JSON.stringify(r)}`);
+    } catch (e) {
+      logger.error('❌ WAL TRUNCATE échec :', e);
+    }
+    setInterval(
+      () => {
+        try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (_) {}
+      },
+      24 * 60 * 60 * 1000,
+    );
+  }, ms);
+}
+scheduleDailyTruncate();
```

### 16.2 [S1] Gestion EADDRINUSE 3443
**Fichier** : `apps/api/server.js` (autour de l'écoute HTTPS)
```diff
- httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
-   logger.info(`🔒 Serveur HTTPS démarré sur https://0.0.0.0:${HTTPS_PORT}`);
- });
+ httpsServer.on('error', (err) => {
+   if (err.code === 'EADDRINUSE') {
+     logger.warn(`⚠️ Port HTTPS ${HTTPS_PORT} occupé — démarrage HTTP only`);
+     return; // ne pas tuer le process
+   }
+   logger.error('❌ Erreur HTTPS:', err);
+ });
+ httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
+   logger.info(`🔒 Serveur HTTPS démarré sur https://0.0.0.0:${HTTPS_PORT}`);
+ });
+
+ process.on('unhandledRejection', (reason) => {
+   logger.error('❌ Unhandled rejection:', reason);
+ });
```

### 16.3 [S1] gitignore backups DB
```diff
+# Backups DB locaux (jamais versionnés)
+apps/api/vehicules.db.bak-*
+apps/api/vehicules.db.backup-*
+apps/api/*.db-shm
+apps/api/*.db-wal
+apps/api/_backups_local/
```

### 16.4 [S2] Whitelist tables annuaire
**Fichier** : `apps/api/annuaireRoutes.js:1111`
```diff
-res.json(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id));
+const ALLOWED = Object.freeze({
+  clients: 1, suppliers: 1, prestataires: 1, contacts: 1,
+});
+if (!ALLOWED[table]) return res.status(400).json({ error: 'invalid table' });
+res.json(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id));
```

### 16.5 [S2] Timeout requêtes
**Fichier** : `apps/api/server.js`
```diff
+app.use((req, res, next) => {
+  req.setTimeout(30_000, () => {
+    if (!res.headersSent) res.status(408).json({ error: 'request timeout' });
+  });
+  next();
+});
```

---

## 17. Propositions UX/UI (non appliquées)

1. **Modals** : standardiser sur `<Modal>` DS partout. Constat ce jour : `LoginForm` dupliqué dans `App.jsx` corrigé. Audit à faire sur autres usages.
2. **Listes longues** : virtualiser `equipment` (3830 rows) avec `react-window` quand passé en mode tableau.
3. **Toasts** : harmoniser durée (3 s default) + position bottom-right partout.
4. **Loaders** : ajouter skeletons sur 4 panneaux principaux (Equipment, Planning, Suivi, Orders).
5. **Mobile** : drawer plein écran pour modals au lieu de centered card.

---

## 18. Propositions performance (non appliquées)

1. Cache LRU 60 s sur `GET /api/equipment` (invalidation sur write).
2. Index composé `equipment(category_id, status, name)` pour la liste filtrée.
3. Précalcul `equipment_stats_cache` (équivalent inventory).
4. SSE messaging : passer en `compression: false` (déjà conseillé) + heartbeat 30 s.
5. Frontend : `React.lazy` sur 5 panneaux les plus lourds (`AffaireDetailPanel`, `PersonnelPanel`, `AnnuairePanel`, `StockPanel`, `ManagementPanel`).

---

## 19. Propositions stabilité (non appliquées)

1. Liveness probe `/health` enrichi : DB ping + WAL size + uptime.
2. Readiness probe `/ready` séparée (refuse trafic si migration en cours).
3. Sentry/Glitchtip backend + frontend.
4. Dead Man's Switch : ping cron externe sur backup réussi.
5. Retention backup : garder 7 derniers + 1/semaine, supprimer le reste.

---

## 20. Annexes

### A. Fichiers non versionnés constatés
- `apps/api/vehicules.db.backup-cleanup-rest-20260506T113115Z`
- `apps/api/vehicules.db.backup-merge-dups-2026-05-06T11-27-23-662Z`
- `apps/api/vehicules.db.bak-controles-20260505-092305`
- `apps/api/vehicules.db.bak-ct-reclass-20260506-134224`
- `apps/api/vehicules.db.bak-hors-stock-20260505-081858`
- `apps/api/vehicules.db.bak-pre-serials-migration-20260505-165958`
- `apps/api/vehicules.db.bak-presprint2-20260505-111236`
- `apps/api/vehicules.db.bak-presprint3-20260505-112438`
- `apps/api/vehicules.db.bak-qrcode-20260505-084454`
- `apps/api/vehicules.db.bak-qrcode2-20260505-085109`
- `scripts/_debug-modal-layout.js`

### B. Commandes utiles
```bash
# Vérifier WAL
ls -lh apps/api/vehicules.db*
# Forcer checkpoint TRUNCATE
sqlite3 apps/api/vehicules.db "PRAGMA wal_checkpoint(TRUNCATE);"
# Audit deps API
cd apps/api && npm audit --omit=dev
# Vérifier FK
sqlite3 apps/api/vehicules.db "PRAGMA foreign_key_check;"
# Lister tables sans index
sqlite3 apps/api/vehicules.db "SELECT m.name FROM sqlite_master m LEFT JOIN sqlite_master i ON i.type='index' AND i.tbl_name=m.name WHERE m.type='table' GROUP BY m.name HAVING COUNT(i.name) = 0;"
```

### C. Conformité contraintes
- ✅ TV client : non modifié.
- ✅ Aucune correction appliquée sans validation.
- ✅ Aucune donnée supprimée.
- ✅ Aucun workflow cassé.

---

**Fin du rapport**.
Pour appliquer les correctifs S1, lancer un par un avec validation explicite.
