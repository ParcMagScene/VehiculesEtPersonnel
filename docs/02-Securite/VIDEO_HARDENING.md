# SPEC — Sécurisation du module Vidéo (MediaMTX + proxy backend)

> **Version** : 0.1.0 (T-P0-17)
> **Statut** : `Actif — durcissement continu`
> **Ticket source** : [`EXECUTION_PLAN_EMAG_3_0.md`](../../EXECUTION_PLAN_EMAG_3_0.md) — T-P0-17.

---

## 1. Modèle de menaces

Le module Vidéo (`apps/api/videoRoutes.js`, `apps/api/videoProxyService.js`,
`mediamtx.yml`) expose trois surfaces :

- **API REST MediaMTX** (`:9997`) — administration des paths, publication,
  contrôle.
- **RTSP source pull** (`:8554`) — MediaMTX tire les flux depuis les caméras
  IP internes (NVR Dahua, EZVIZ, Hikvision).
- **WebRTC WHEP** (`:8889`) — clients web reçoivent le flux via WHEP.

Risques identifiés :

| # | Menace | Vecteur | Contrôle |
|---|--------|---------|----------|
| V1 | **SSRF** via URI RTSP fabriquée | Utilisateur admin qui saisit `rtsp://127.0.0.1:22/` ou `rtsp://169.254.169.254/` | `isBlockedIP()` dans `videoProxyService.js` (IPv4 loopback + link-local + IPv6 loopback + fc00::/fd00::) |
| V2 | **Fuite credentials caméra** | Injection SQL, dump DB, log accidentel | Chiffrement AES-256-GCM (`VIDEO_CIPHER_KEY`) avant persistance en DB, jamais loggé |
| V3 | **Publication arbitraire** sur MediaMTX | Publish RTSP depuis Internet → écrasement d'un path caméra | Bind API et publication sur loopback (`127.0.0.1`), pas d'exposition WAN |
| V4 | **Fuite URI RTSP** dans les logs | Log `console.log(rtsp://user:pass@ip)` | Masquage systématique (`***@ip`) dans `video_access_logs.resource_uri` et logs applicatifs |
| V5 | **Abus de rate** (start/stop stream) | Utilisateur ou script en boucle qui démarre/arrête un flux | Rate limit backend sur endpoints de contrôle (voir §4) |
| V6 | **Traçabilité insuffisante** | Un accès vidéo légitime ne peut pas être retracé (qui, quand, pourquoi) | Table `video_access_logs` enrichie (user_id, user_name, camera_id, action, ip_address, user_agent, request_id, resource_uri masquée, response_status) |

---

## 2. Contrôles en place (état 2026-07-09)

- **V1 SSRF** : `apps/api/videoProxyService.js::isBlockedIP` bloque IPv4
  (`127.*`, `10.*`, `172.16-31.*`, `169.254.*`, `0.*`, `255.*`) et IPv6
  loopback + link-local + ULA. À invoquer avant tout `fetch()` ou
  démarrage de stream.
- **V2 cred chiffrement** : `videoProxyService.js::getKeyBuffer()` charge
  la clé depuis `VIDEO_CIPHER_KEY` (fail-fast en prod si absente,
  génération auto en dev). Passwords caméras jamais loggés en clair.
- **V4 URI masquée** : les inserts dans `video_access_logs.details`
  utilisent le pattern `rtsp://***@<host>:<port>/<path>` (voir §5).
- **V6 traçabilité de base** : `video_access_logs` avec `user_id`,
  `camera_id`, `action`, `ip_address`, `details`, `created_at`
  (migration `apps/api/migrations/video-v1.js`).

---

## 3. Contrôles à ajouter (roadmap T-P0-17)

- **V3 isolation réseau** — voir §4 (mediamtx.yml + firewall externe).
- **V5 rate limit publication / control** — voir §4.
- **V6 enrichissement `video_access_logs`** — voir §5.

---

## 4. Isolation réseau MediaMTX

Le fichier `mediamtx.yml` est **hors dépôt Git** (voir `.gitignore`).
Chaque déploiement doit suivre le canevas
`mediamtx.yml.example` avec les recommandations suivantes :

- **Bind API sur loopback uniquement** :
  ```yaml
  apiAddress: 127.0.0.1:9997
  ```
  Aucun accès admin depuis le LAN, sauf via SSH tunnel.

- **Bind publication RTSP sur loopback uniquement** si les caméras sont
  toutes tirées en mode `pull` (source distante) — ce qui est notre cas :
  ```yaml
  rtspAddress: 127.0.0.1:8554
  ```
  Si un flux `push` légitime est nécessaire, ajouter `authMethod: internal`
  + `authInternalUsers` avec IPs restreintes.

- **Firewall externe** : reverse proxy TLS (Caddy) doit être le seul
  point d'entrée public. Ne jamais exposer 9997 / 8554 / 8889 sur le WAN.

- **Rate limit publication (application)** : `POST /api/cameras/:id/start-stream`
  et `POST /api/cameras/:id/stop-stream` doivent être limités
  (par ex. 10 requêtes / minute / user) via `express-rate-limit`. Cette
  limite est plus pertinente que celle offerte nativement par MediaMTX.

---

## 5. Enrichissement `video_access_logs`

Colonnes existantes : `id`, `user_id`, `user_name`, `camera_id`,
`camera_name`, `action`, `ip_address`, `details`, `created_at`.

Colonnes ajoutées (T-P0-17) :

| Colonne | Type | Description |
|---------|------|-------------|
| `user_agent` | TEXT | En-tête HTTP `User-Agent` du client. |
| `request_id` | TEXT | UUID de traçabilité inter-service (corrélation logs). |
| `resource_uri` | TEXT | URI RTSP masquée (`rtsp://***@host:port/path`) — jamais l'URI complète. |
| `response_status` | INTEGER | Code HTTP de la réponse (200, 401, 403, 500, ...). |

Migration : `ALTER TABLE video_access_logs ADD COLUMN <name>` idempotent
via `pragma table_info(video_access_logs)` — voir
`apps/api/migrations/video-v1.js`.

Enum `action` reste identique (`view`, `snapshot`, `ptz`, `start_stream`,
`stop_stream`).

---

## 6. Checklist déploiement production

- [ ] `VIDEO_CIPHER_KEY` défini dans `.env` prod (32 bytes hex).
- [ ] `mediamtx.yml` prod utilise `apiAddress: 127.0.0.1:9997`.
- [ ] Aucun port MediaMTX (9997, 8554, 8889) accessible depuis le WAN
      (vérification `nmap` externe).
- [ ] Rate limit `express-rate-limit` actif sur les endpoints de
      contrôle stream.
- [ ] Table `video_access_logs` contient les 4 nouvelles colonnes
      (`pragma table_info(video_access_logs)` → 13 colonnes).
- [ ] Tests unitaires `videoProxyService` verts en CI (SSRF, chiffrement,
      parsing URI).

---

## 7. Rollback

Aucun impact fonctionnel si :

- Les nouvelles colonnes de `video_access_logs` restent vides (les inserts
  qui n'écrivent pas dans ces colonnes restent valides).
- Le rate limit peut être désactivé via variable d'environnement (voir
  code du middleware).
- Le fichier `mediamtx.yml` n'est jamais modifié automatiquement par
  cette itération : seul `mediamtx.yml.example` est mis à jour.

Ref : [`EXECUTION_PLAN_EMAG_3_0.md`](../../EXECUTION_PLAN_EMAG_3_0.md) —
T-P0-17 · Vidéo — Sécurisation MediaMTX + logs enrichis.
