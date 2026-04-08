# 👥 API Personnel & Planning RH

> **Version** : 1.0.0  
> **Source** : `personnelRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026

---

## Personnel

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/persons` | ✅ | Liste personnel (batch skills, pas de N+1) |
| GET | `/api/persons/:id` | ✅ | Détail + compétences + disponibilités + missions |
| POST | `/api/persons` | ✅ | Crée personne avec compétences initiales |
| PUT | `/api/persons/:id` | ✅ | MAJ personne + sync compétences |
| DELETE | `/api/persons/:id` | ✅🔑 | Supprime (cascade assignations) |
| POST | `/api/persons/import-csv` | ✅🔑 | Import CSV en masse |
| POST | `/api/persons/bulk-delete` | ✅🔑 | Suppression multiple |

---

## Compétences & Postes

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/skills` | ✅ | Liste compétences |
| POST | `/api/skills` | ✅🔑 | Crée compétence |
| PUT | `/api/skills/:id` | ✅🔑 | MAJ compétence |
| DELETE | `/api/skills/:id` | ✅🔑 | Supprime (vérifie références) |
| GET | `/api/positions` | ✅ | Liste postes |
| POST | `/api/positions` | ✅🔑 | Crée poste |
| PUT | `/api/positions/:id` | ✅🔑 | MAJ poste |
| DELETE | `/api/positions/:id` | ✅🔑 | Supprime poste |

---

## Disponibilités

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/availabilities` | ✅ | Liste disponibilités/congés |
| POST | `/api/availabilities` | ✅ | Demande disponibilité (approbation admin) |
| PUT | `/api/availabilities/:id` | ✅ | MAJ propre disponibilité |
| POST | `/api/availabilities/:id/approve` | ✅🔑 | Admin approuve |
| POST | `/api/availabilities/:id/reject` | ✅🔑 | Admin rejette |
| DELETE | `/api/availabilities/:id` | ✅ | Supprime propre disponibilité |

---

## Missions & Affectations

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/missions` | ✅ | Liste missions (link event/réservation) |
| GET | `/api/missions/:id` | ✅ | Détail mission + assignations |
| POST | `/api/missions` | ✅ | Crée mission |
| PUT | `/api/missions/:id` | ✅ | MAJ statut (pending→confirmed→in_progress→completed→cancelled) |
| DELETE | `/api/missions/:id` | ✅🔑 | Admin supprime |
| GET | `/api/assignments` | ✅ | Liste affectations |
| POST | `/api/assignments` | ✅ | Affecte personne (valide skills vs requirements) |
| PUT | `/api/assignments/:id` | ✅ | MAJ affectation |
| DELETE | `/api/assignments/:id` | ✅ | Retire personne de mission |
| GET | `/api/personnel/planning` | ✅ | Vue calendrier personnel |

---

## Machine d'état Missions

```
pending → confirmed → in_progress → completed
                  ↘                     ↗
                    → cancelled ←──────
```
