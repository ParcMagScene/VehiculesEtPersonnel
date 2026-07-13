# API v2 — SAV (Service Après-Vente enrichi)

**Ticket** : T-P1-07 (Équipements v2 — SAV enrichi).
**Feature flag serveur** : `FEATURE_V2_SAV` (off par défaut).
**Coexistence** : `/api/sav/*` v1 (`savRoutes.js`, `savComparator`)
inchangé.

Ce namespace apporte 2 compléments :

1. **Machine d'état** explicite des tickets SAV — `assertTransition`
   valide chaque changement de statut avant l'UPDATE. Le v1 accepte
   toujours toute transition texte, le v2 est strict.
2. **Pièces détachées** — table `sav_parts` (nouvelle, migration
   `sav-parts-v1`) avec cycle `requested → ordered → received →
   installed` (ou `cancelled` à toute étape).

---

## Discovery — `GET /api/v2/sav/protocol`

Public. Retourne notamment :

```json
{
  "part_statuses": ["requested", "ordered", "received", "installed", "cancelled"],
  "allowed_ticket_transitions": {
    "open":          ["open", "in_progress", "waiting_parts", "sortie_sav", "closed"],
    "in_progress":   ["in_progress", "waiting_parts", "resolved", "sortie_sav"],
    "waiting_parts": ["waiting_parts", "in_progress", "sortie_sav"],
    "resolved":      ["resolved", "closed", "in_progress"],
    "sortie_sav":    ["sortie_sav", "closed"],
    "closed":        ["closed", "in_progress"]
  }
}
```

Les auto-transitions (`from === to`) sont autorisées (idempotence).

---

## Pièces — `GET /api/v2/sav/tickets/:id/parts`

Authentifié. Liste triée `requested_at DESC, id DESC`.

## Pièces — `POST /api/v2/sav/tickets/:id/parts`

Authentifié. Crée une nouvelle pièce en statut `requested`.

### Body

```json
{
  "part_name": "Ampoule LED",
  "part_reference": "REF-01",
  "quantity": 2,
  "unit_price": 12.5,
  "supplier": "ACME",
  "notes": "Compatibilité vérifiée"
}
```

- `part_name` requis (string trimée non vide).
- `quantity` défaut `1`, doit être un nombre > 0.
- `unit_price` optionnel, doit être un nombre si fourni.
- Autres champs optionnels, trim automatique.

### Réponse 201

```json
{ "success": true, "data": { "part": { "id": 42, "status": "requested", ... } } }
```

## Pièces — `PATCH /api/v2/sav/parts/:id/status`

Authentifié. Change le statut d'une pièce. Le timestamp associé
(`ordered_at`, `received_at`, `installed_at`, `cancelled_at`) est
renseigné automatiquement s'il n'est pas déjà rempli.

### Body

```json
{ "status": "ordered" }
```

Valeurs : `requested`, `ordered`, `received`, `installed`, `cancelled`.

---

## Transition ticket — `POST /api/v2/sav/tickets/:id/transition`

Authentifié. Valide la transition via la machine d'état puis
applique le nouveau statut.

### Body

```json
{ "status": "in_progress" }
```

### Réponse 200

```json
{
  "success": true,
  "data": {
    "ticket_id": 17,
    "previous_status": "open",
    "new_status": "in_progress",
    "changed": true
  }
}
```

### Erreurs

- `400 VALIDATION_ERROR` : statut inconnu, body invalide.
- `404 NOT_FOUND` : ticket introuvable.
- `409 CONFLICT` : transition interdite (avec `meta.details.allowed`
  = liste des statuts atteignables depuis `from`).

---

## Reference

- `apps/api/migrations/sav-parts-v1.js` : migration additive.
- `apps/api/services/sav/stateMachine.js` : `ALLOWED_TRANSITIONS` +
  `assertTransition` + `isTransitionAllowed` + `getAllowedNext`.
- `apps/api/services/sav/parts.js` : `addPart`, `listPartsForTicket`,
  `updatePartStatus`.
- `apps/api/v2/savRoutes.js` : namespace + gate + handler.
- `apps/api/services/savComparator.js` : source des `SAV_STATUS`
  (réutilisée telle quelle par la machine d'état v2).

---

## Non couvert par T-P1-07

- **Sync LocMat auditée** (annoncée dans le plan) : le mécanisme
  existant (`savRoutes` + `savComparator`) fonctionne déjà, la
  formalisation en v2 (audit trail des sync passées) est reportée à
  un ticket dédié.
- **Migration du v1 vers `assertTransition`** : le v1 accepte
  toujours toute transition. Migration à faire après dogfooding
  v2.
- **UI** consommant `v2AddSavPart`/`v2TransitionSavTicket` : ticket
  T-P1-07b après dogfooding `FEATURE_V2_SAV=1`.

---

## Dogfooding UI — Fondations (T-P1-07b — 2026-07-10)

Fondations livrées pour la consommation UI des 4 endpoints v2 SAV
enrichis :

- `apps/web/src/utils/sav/v2Adapters.js` :
  `SAV_PART_STATUSES` (5 valeurs), `SAV_TICKET_STATUSES` (6 valeurs),
  `adaptSavPartV2ToV1`, `adaptV2SavPartsList`,
  `adaptV2TicketTransitionResponse` (passthrough), `readSavV2ClientFlag`.
- `apps/web/src/utils/sav/fetchSavParts.js` :
  `fetchSavPartsUnified(api, ticketId, { useV2 })`,
  `addSavPartUnified(api, ticketId, data, { useV2 })`,
  `updateSavPartStatusUnified(api, partId, status, { useV2 })`,
  `transitionSavTicketUnified(api, ticketId, newStatus, { useV2 })`.
  Retour `null` quand indisponible (flag off, FEATURE_DISABLED,
  id/statut invalide, méthode client absente, erreur réseau).

Aucun composant existant n'est modifié dans ce ticket
(`EquipmentSAV.jsx` reste sur les endpoints v1 legacy). Un panel
SAV enrichi consommera ces helpers dans un T-P1-07c à venir
(liste pièces + transitions ticket avec matrice ALLOWED_TRANSITIONS).

Tests de non-régression :

- `apps/web/src/utils/sav/v2Adapters.test.js` (12 cas).
- `apps/web/src/utils/sav/fetchSavParts.test.js` (12 cas).

---

## Dogfooding UI — Panel pièces ticket (T-P1-07c — 2026-07-13)

Premier composant consommateur des fondations T-P1-07b livré :
panel `SavTicketPartsPanel` inséré dans le drawer `SavSlidePanel`
d'`EquipmentSAV.jsx` (visible en cliquant sur un ticket SAV depuis
la liste). Conditionné au flag `VITE_FEATURE_V2_SAV` : si off ou
serveur `FEATURE_DISABLED`, le panel affiche un message
d'information et ne rend rien de bloquant (aucune régression pour
les utilisateurs en prod).

Nouveautés `v2Adapters.js` :

- `SAV_TICKET_TRANSITIONS` : matrice des transitions autorisées
  (miroir strict de `apps/api/services/sav/stateMachine.js#ALLOWED_TRANSITIONS`)
  dupliquée côté client pour proposer uniquement les cibles valides
  sans importer le backend.
- `getSavAllowedNext(from)` : liste des cibles autorisées.
- `isSavTransitionAllowed(from, to)` : validation client (auto-transition
  toujours autorisée pour l'idempotence).

Composant `SavTicketPartsPanel` :

- `apps/web/src/components/equipment/SavTicketPartsPanel.jsx` (~330
  lignes) + `SavTicketPartsPanel.css` (tokens `--space-*` / `--theme-*`).
- Loader initial via `fetchSavPartsUnified`, affiche liste + total.
- Formulaire d'ajout inline (`addSavPartUnified`) avec validation
  cliente (`partName` requis, `quantity > 0`, `unitPrice` numérique).
- Select de changement de statut par pièce (`updateSavPartStatusUnified`),
  parcourt `SAV_PART_STATUSES`.
- Bloc de transition ticket : affiché uniquement si `ticketStatus`
  fourni ET qu'au moins une cible valide existe (exclut
  l'auto-transition). Appelle `transitionSavTicketUnified` et
  déclenche `onTicketTransitioned(result)` sur succès.
- Toast inline succès/erreur, refresh auto après chaque mutation.

Intégration `EquipmentSAV.jsx` :

- Import ajouté en haut du fichier.
- Rendu ajouté à la fin du corps du `SavSlidePanel` (juste avant
  `</Drawer>`), sans modifier aucun autre comportement du drawer.
- Passe `ticketId={t.id}` et `ticketStatus={t.status}`. Pas de
  callback : le drawer se ferme normalement via son bouton dédié.

Tests de non-régression :

- `apps/web/src/utils/sav/v2Adapters.test.js` : +7 cas matrice
  `SAV_TICKET_TRANSITIONS` (open→5 cibles, resolved→closed +
  reprise, closed→réouverture, sortie_sav→finalisation, statut
  inconnu→[], auto-transition, cibles interdites vs valides).
- `apps/web/src/components/equipment/SavTicketPartsPanel.test.jsx`
  (11 cas) : null si ticketId manquant, message v2 désactivé,
  liste vide, affichage pièce, validation partName, appel
  addSavPartUnified + refresh, erreur ajout, changement statut +
  refresh, matrice de transition (options filtrées + application +
  callback).

Comportement en dogfooding :

- Serveur `FEATURE_V2_SAV=1` + client `VITE_FEATURE_V2_SAV=1` :
  UI complète, mutations effectives.
- Serveur off (`FEATURE_DISABLED`) OU client off : panel affiche
  `Namespace v2 SAV désactivé`, aucun appel v2 fait.
- Le workflow v1 legacy (édition ticket, changement statut simple
  via `SavTicketFormModal`) reste actif et non impacté.
