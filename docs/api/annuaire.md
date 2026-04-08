# 📒 API Annuaire

> **Version** : 1.0.0  
> **Source** : `annuaireRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026

---

## Clients

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/annuaire/clients` | ✅ | Recherche paginée (nom, code_libre, email, tel, ville, CP, SIRET) |
| GET | `/api/annuaire/clients/:id` | ✅ | Détail client + contacts |
| POST | `/api/annuaire/clients` | ✅ | Crée client (valide SIRET Luhn 14 chiffres, TVA intra FR+11, normalise tel) |
| PUT | `/api/annuaire/clients/:id` | ✅ | MAJ + sync validation |
| DELETE | `/api/annuaire/clients/:id` | ✅🔑 | Empêche si contacts liés |

---

## Fournisseurs (enrichis)

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/annuaire/suppliers` | ✅ | Liste paginée |
| POST | `/api/annuaire/suppliers` | ✅ | Crée avec validation SIRET/TVA |
| PUT | `/api/annuaire/suppliers/:id` | ✅ | MAJ fournisseur |
| DELETE | `/api/annuaire/suppliers/:id` | ✅🔑 | Supprime fournisseur |

---

## Prestataires

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/annuaire/prestataires` | ✅ | Liste prestataires |
| POST | `/api/annuaire/prestataires` | ✅ | Crée prestataire |

---

## Contacts

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/annuaire/contacts` | ✅ | Liste paginée |
| POST | `/api/annuaire/contacts` | ✅ | Crée contact (lie à client/fournisseur/prestataire) |
| PUT | `/api/annuaire/contacts/:id` | ✅ | MAJ contact |
| DELETE | `/api/annuaire/contacts/:id` | ✅ | Supprime contact |

---

## Utilitaires

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/annuaire/lookups` | ✅ | Dropdowns: secteurs activité, structures juridiques, types service |
| GET | `/api/annuaire/search` | ✅ | Recherche FTS globale (toutes entités) |
| POST | `/api/annuaire/import` | ✅🔑 | Import CSV en masse (clients/fournisseurs/contacts) |

---

## Validations métier

- **SIRET** : 14 chiffres, algorithme de Luhn
- **TVA intracommunautaire** : Format FR + 11 chiffres
- **Téléphone** : Normalisation automatique format français
- **Code libre** : UNIQUE par client (identifiant métier)
