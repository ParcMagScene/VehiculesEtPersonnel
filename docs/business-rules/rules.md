# 📐 Règles Métier — eM@g

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

---

## 1. Congés — IDCC 3252 (Spectacle vivant)

| Règle | Valeur |
|-------|--------|
| Acquisition | 2,5 jours/mois = 30 jours/an |
| Période référence | 1er juin → 31 mai |
| Congé principal | Min 12 jours consécutifs (1er mai → 31 oct) |
| Préavis minimum | 30 jours |
| Solde restant | Avant 28 février |
| Fractionnement | Droit à jours supplémentaires si fractionnement |
| Jours fériés | 11 jours fériés légaux définis dans `public_holidays` |

---

## 2. Validation SIRET

- Format : exactement 14 chiffres
- Algorithme de Luhn appliqué sur les 14 positions
- Validation côté client (annuaire) et serveur (routes)

---

## 3. TVA intracommunautaire

- Format FR : `FR` + 2 chiffres clé + 9 chiffres SIREN
- Clé = `(12 + 3 × (SIREN % 97)) % 97`
- Validation côté client

---

## 4. Politique de mot de passe (Phase 2)

| Critère | Exigence |
|---------|----------|
| Longueur min | 10 caractères |
| Majuscule | ≥ 1 |
| Chiffre | ≥ 1 |
| Symbole | ≥ 1 |
| Hachage | bcrypt (rounds=12) |

---

## 5. Réservations véhicules — Conflits (Phase 2)

- Détection chevauchement temporel pour un même véhicule
- Requête SQL : `start_date < :end AND end_date > :start AND vehicle_id = :vid`
- Exclusion de la réservation en cours d'édition par `id != :current_id`
- Retour 409 Conflict avec message explicatif

---

## 6. Matériel — Double assignation (Phase 3)

- Un équipement ne peut être assigné qu'à une seule affaire active à la fois
- Vérification serveur avant INSERT/UPDATE dans `equipment_assignments`
- Retour 409 si déjà assigné

---

## 7. Auto-approbation (Phase 1)

- Un utilisateur NE PEUT PAS approuver sa propre demande de congé
- Vérification `approver_id !== requester_id` côté serveur
- Retour 403 avec message explicite

---

## 8. Stock — Alertes

- Alerte générée quand `quantity <= min_quantity`
- Deux types de références : STK (vente), SAV (pièces détachées)
- Mouvements tracés : `in`, `out`, `adjustment`, `return`

---

## 9. SAV — Machine d'état (Phase 3)

Transitions valides définies dans `VALID_SAV_TRANSITIONS` côté serveur. Toute tentative de transition non déclarée → 400 Bad Request.

Voir [workflows/state-machines.md](../workflows/state-machines.md#3-tickets-sav) pour le diagramme.

---

## 10. Messaging — Uploads (Phase 4)

| Règle | Valeur |
|-------|--------|
| Taille max | 25 Mo |
| MIME autorisés | image/jpeg, image/png, image/gif, image/webp, application/pdf, video/mp4, video/webm |
| SVG | **Bloqué** |
| Nom fichier | Sanitisé (alphanum + tirets) |

---

## 11. Attachments — Uploads (Phase 4)

| Règle | Valeur |
|-------|--------|
| MIME autorisés | PDF, images (jpeg/png/gif/webp), Office (docx/xlsx/pptx), vidéos (mp4/webm) |
| SVG | **Bloqué** (vecteur XSS) |

---

## 12. Rate Limiting (Phase 3)

| Endpoint | Limite |
|----------|--------|
| POST /api/auth/login | 5 requêtes / 15 min |
| POST /api/auth/register | 3 requêtes / heure |
| Routes API générales | 100 requêtes / 15 min |
