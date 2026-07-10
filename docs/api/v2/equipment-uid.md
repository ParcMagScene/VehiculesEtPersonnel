# API v2 — Equipment UID (Régénération et audit)

**Ticket** : T-P1-06 (Équipements v2 — UID / serials contrôlés).
**Feature flag serveur** : `FEATURE_V2_EQUIPMENT_UID` (off par défaut).
**Coexistence** : aucun changement des endpoints v1 équipement.

Le domaine UID est déjà robuste (table `uid_counter`, helper
`getNextUid` avec anti-collision, migration v2 alignement legacy).
Ce namespace expose deux **compléments admin** :

1. **Audit** des doublons `serial_number` / `uid` et des équipements
   sans UID (pré-check avant renforcement UNIQUE en T-P1-06b).
2. **Régénération** d'un UID pour un équipement précis (recovery
   ticket support).

---

## Discovery

### `GET /api/v2/equipment-uid/protocol`

Public. Structure standard.

---

## Audit — `GET /api/v2/equipment-uid/audit`

Authentifié + admin (si `requireAdmin` fourni). Aucune écriture.

### Réponse 200

```json
{
  "success": true,
  "data": {
    "equipment_total": 6032,
    "equipment_with_uid": 6032,
    "equipment_without_uid": 0,
    "equipment_with_serial": 4180,
    "duplicate_serials": [
      { "serial_number": "SN-ABC-123", "count": 2, "ids": [42, 87] }
    ],
    "duplicate_uids": [],
    "verdict": "1 doublons serial_number — regenerate + investigation avant sunset UNIQUE"
  }
}
```

`verdict = 'OK — schema sain, renforcement UNIQUE safe (T-P1-06b)'`
si tous les compteurs sont propres.

---

## Régénération — `POST /api/v2/equipment/:id/regenerate-uid`

Authentifié + admin. Génère un nouvel UID `EMAG-XXXXX` via
`getNextUid` (anti-collision garanti) et écrit une ligne d'audit
dans `equipment.notes` (approche minimalement invasive, pas de
nouvelle table dédiée dans ce ticket).

### Body (optionnel)

```json
{ "reason": "QR code perdu / illisible" }
```

### Réponse 200

```json
{
  "success": true,
  "data": {
    "equipment_id": 42,
    "previous_uid": "EMAG-01234",
    "new_uid": "EMAG-06033",
    "regenerated_by": 3,
    "regenerated_at": "2026-07-10T10:15:00.000Z"
  }
}
```

Ligne ajoutée à `equipment.notes` :

```
[UID-REGEN 2026-07-10T10:15:00.000Z] EMAG-01234 -> EMAG-06033 — QR code perdu / illisible (by user #3)
```

### Erreurs

- `400 VALIDATION_ERROR` : `equipmentId` <= 0 ou non-entier.
- `404 NOT_FOUND` : équipement introuvable.
- `409 CONFLICT` : nouvel UID identique à l'ancien (théoriquement
  impossible, garde-fou défensif).

---

## Reference

- `apps/api/services/equipment-uid/regenerate.js` :
  `regenerateEquipmentUid`.
- `apps/api/services/equipment-uid/audit.js` : `auditUidState`.
- `apps/api/services/uidCounter.js` : `getNextUid` (existant,
  réutilisé — anti-collision robuste).
- `apps/api/v2/equipmentUidRoutes.js` : namespace + gate.

---

## Non couvert par T-P1-06

- **Renforcement contrainte UNIQUE** sur `serial_number` : reporté
  à **T-P1-06b** après audit prod à 0 doublon. Migration
  destructive (recreation de table SQLite).
- **Table `uid_regeneration_history`** dédiée : reporté (l'audit
  inline dans `equipment.notes` suffit pour le v1, à migrer si
  volume élevé).
- **Régénération batch** : hors scope T-P1-06.

---

## Dogfooding UI — Fondations (T-P1-06b — 2026-07-10)

⚠️ Le "T-P1-06b" contrainte UNIQUE mentionné ci-dessus (renforcement
DB) reste ouvert et distinct. Ce paragraphe documente les
**fondations UI** livrées en parallèle sous le même identifiant.

Chemin technique livré :

- `apps/web/src/utils/equipmentUid/v2Adapters.js` :
  `adaptDuplicateEntryV2ToV1`, `adaptV2AuditResponse` (rapport
  complet camelCase), `adaptV2RegenerateResponse`,
  `readEquipmentUidV2ClientFlag(env)`.
- `apps/web/src/utils/equipmentUid/fetchEquipmentUidAudit.js` :
  `fetchEquipmentUidAuditUnified(api, { useV2 })` et
  `regenerateEquipmentUidUnified(api, id, { reason, useV2 })`.
  Retour `null` quand indisponible (flag off, FEATURE_DISABLED,
  méthode absente, id invalide, erreur réseau).

Aucun composant existant n'est modifié dans ce ticket. Un panel
admin dédié (`AdminEquipmentUidPanel`) consommera ces helpers
dans un T-P1-06c à venir (badge "N doublons détectés" + bouton
"Régénérer UID" par ligne).

Tests de non-régression :

- `apps/web/src/utils/equipmentUid/v2Adapters.test.js` (10 cas).
- `apps/web/src/utils/equipmentUid/fetchEquipmentUidAudit.test.js`
  (11 cas).
