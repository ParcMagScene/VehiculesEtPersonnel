# Module Contrôles Périodiques

> Statut : ✅ Production — Spec v1
>
> Module unifié et industriel pour la gestion des contrôles périodiques de
> tout le matériel : véhicules (CT, tachygraphe, limiteur, assurance, révision)
> et équipements techniques (levage, électrique, DMX, sécurité…).

---

## 1. Objectifs

- Source unique de vérité pour tous les contrôles obligatoires/recommandés.
- Calcul automatique de l'état (À faire / En retard / Manqué).
- Historique immuable horodaté (audit trail).
- Notifications email graduées : J-30, J-7, J-1, jour J, retard, manqué.
- Auto-reprogrammation des contrôles manqués selon la périodicité.
- Migration douce des anciennes données `vehicles.controles_techniques` (JSON).

---

## 2. Modèle de données

### 2.1 `control_types` — Référentiel des types de contrôle
| Colonne | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `code` | TEXT UNIQUE | `CT`, `TACHYGRAPHE`, `LIMITEUR`, `ASSURANCE`, `REVISION`, `LEVAGE`, `ELECTRIQUE`, `DMX`, `SECURITE`, `AUTRE` |
| `name` | TEXT | Libellé humain |
| `default_periodicity_days` | INTEGER | Périodicité par défaut (peut être surchargée par contrôle) |
| `default_missed_after_days` | INTEGER | Délai après l'échéance avant passage en `MANQUE` |
| `is_vehicle_specific` | INTEGER | 1 = uniquement véhicules |
| `is_active` | INTEGER | Soft-delete |

10 types seedés à la migration v1.

### 2.2 `equipment_controls` — Planification d'un contrôle pour une entité
| Colonne | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `entity_type` | TEXT CHECK (`vehicle` \| `equipment`) | |
| `entity_id` | TEXT | `vehicles.id` (TEXT) ou `equipment.id` stringifié |
| `control_type_id` | INTEGER FK → `control_types` | |
| `periodicity_days` | INTEGER | Snapshot — surcharge le défaut |
| `missed_after_days` | INTEGER | idem |
| `next_due_date` | DATE | Prochaine échéance (YYYY-MM-DD) |
| `last_done_date` | DATE | Dernière exécution |
| `assigned_to` | INTEGER FK → users | Responsable (notifié) |
| `status` | TEXT | `A_FAIRE` \| `EN_RETARD` \| `MANQUE` |
| `notes` | TEXT | Marqueur `[migrated:v1]` pour les imports JSON |
| `is_active` | INTEGER | Soft-delete |

Index : `entity_type+entity_id`, `next_due_date`, `assigned_to`, `status`
(tous filtrés `WHERE is_active=1`).

### 2.3 `control_history` — Trace immuable
| Colonne | Type |
|---|---|
| `id` | INTEGER PK |
| `equipment_control_id` | INTEGER FK |
| `performed_at` | DATE |
| `performed_by` | INTEGER FK → users |
| `status` | TEXT (`EFFECTUE` \| `MANQUE`) |
| `next_due_date` | DATE |
| `notes` | TEXT |
| `documents` | TEXT (JSON array URLs) |

### 2.4 `control_notifications` — Anti-doublon emails
- UNIQUE INDEX `(equipment_control_id, type, for_due_date, recipient_id)`.
- Types : `REMINDER_30`, `REMINDER_7`, `REMINDER_1`, `LATE`, `MISSED`.

---

## 3. Endpoints REST

Toutes les routes sont sous `/api/controls/*` et requièrent `authenticateToken`.
Les routes de mutation/admin requièrent `requireAdmin`.

| Méthode | Path | Description |
|---|---|---|
| GET | `/api/controls/types[?active=false]` | Liste référentiel |
| POST | `/api/controls/types` | Créer un type (admin) |
| PUT | `/api/controls/types/:id` | Modifier (admin) |
| DELETE | `/api/controls/types/:id` | Soft-delete si utilisé, hard sinon (admin) |
| GET | `/api/controls/equipment/:entityType/:entityId` | Liste contrôles d'une entité |
| POST | `/api/controls` | Planifier un contrôle |
| PUT | `/api/controls/:id` | Modifier — recompute status |
| DELETE | `/api/controls/:id` | Soft-delete (`is_active=0`) |
| POST | `/api/controls/perform/:id` | Effectuer un contrôle (insert history + update next_due) |
| GET | `/api/controls/history/:controlId` | Historique d'un contrôle |
| GET | `/api/controls/dashboard?status=&entity_type=&type_id=&assigned_to=` | Dashboard + stats |
| POST | `/api/controls/recompute` | Recalcul manuel (admin) |

Validation : Zod (`apps/api/schemas/controles.js`).

---

## 4. Logique de statut (pure, testable)

```
let d = days_between(today, next_due_date)
si d >= 0  → A_FAIRE
si d < 0 et |d| <= missed_after_days → EN_RETARD
sinon       → MANQUE  (et reprogrammation auto)
```

Voir `apps/api/services/controlesService.js` :
- `computeStatus(control, now)` — pure
- `performControl(db, id, payload, userId)` — transaction
- `recomputeAllStatuses(db, now)` — réécrit tous les statuts, repousse les manqués

---

## 5. Scheduler quotidien

`apps/api/services/controlesScheduler.js` :
- `setInterval` toutes les 5 min, exécute le batch quand `now.getHours() === 8`,
  une seule fois par jour (flag `lastRunDay` en mémoire).
- Étapes :
  1. `recomputeAllStatuses` — passe en revue tous les contrôles actifs.
  2. `sendDueReminders` — envoie REMINDER_30/7/1 / LATE / MISSED via `emailService.alertControlePeriodique`.
- Anti-doublon : `control_notifications` (SELECT 1 préalable + INSERT OR IGNORE).

---

## 6. Notifications email

`emailService.alertControlePeriodique(db, control, kind)` :
- Recipients = `assigned_email` (si présent).
- Pour `LATE` et `MISSED`, ajoute les admins (`getAdminEmails`).
- Gating global via `email_config.alert_controles` (BOOLEAN, par défaut 1).

---

## 7. Migration des données (v1)

`apps/api/migrations/controles-periodiques-v1.js` :
- Crée tables + index + seed types.
- ALTER `email_config` ADD `alert_controles BOOLEAN DEFAULT 1`.
- Lit `vehicles.controles_techniques` (JSON), crée pour chaque entrée
  un `equipment_controls` avec `notes='[migrated:v1] ...'`.
- Marqueur `notes LIKE '[migrated:v1]%'` → idempotent (pas de réimport).

---

## 8. Frontend

### Desktop
- Module dans le Header : `controles` (icône `ShieldCheck`).
- `apps/web/src/components/controles/` :
  - `ControlsDashboard.jsx` — vue principale (stats + table + filtres).
  - `EquipmentControls.jsx` — embed dans une fiche entité.
  - `ControlPerformModal.jsx` — formulaire d'exécution.
  - `ControlEditorModal.jsx` — créer/éditer.
  - `ControlHistoryModal.jsx` — historique.
- API client : `apps/web/src/utils/api/controles.js` (registerControlesMethods).

### Mobile
- `MobileControlsScreen.jsx` — écran liste + form effectuer.
- Bouton « Contrôles périodiques » dans le menu de `MobileEquipmentQR.jsx`.

---

## 9. Tests

`tests/controles.test.js` (`node --test`) — 17 tests :
- `addDays` (UTC, bissextile)
- `computeStatus` (toutes les transitions)
- Migration (tables, seed, idempotence, ALTER, import JSON véhicules)
- `performControl` (insert history, calcul next_due, override manuel, 404)
- `recomputeAllStatuses` (EN_RETARD → MANQUE + reprogramme, A_FAIRE → EN_RETARD)
- `todayIso`

---

## 10. Backup & déploiement

Avant tout déploiement :

```bash
cp apps/api/vehicules.db apps/api/vehicules.db.bak-controles-$(date +%Y%m%d-%H%M%S)
```

Puis : `npm test && npm run lint && npm run deploy`.

---

## 11. TODO / Évolutions futures

- Upload de PDF de rapport de contrôle (champ `documents` du history déjà prévu).
- Export CSV du dashboard.
- Import CSV en masse.
- Alertes SMS/push pour les contrôles MANQUE.
