# 🏖️ API Congés

> **Version** : 1.0.0  
> **Source** : `leaveRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026  
> **Conformité** : Code du Travail + IDCC 3252

---

## Types de congés

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/leaves/types` | ✅ | Types: conge_paye, sans_solde, exceptionnel, maladie, parental, sabbatique, formation, fermeture |

---

## Jours fériés

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/leaves/holidays` | ✅ | Jours fériés de l'année |
| POST | `/api/leaves/holidays` | ✅🔑 | Admin ajoute jour férié |
| DELETE | `/api/leaves/holidays/:id` | ✅🔑 | Admin supprime jour férié |

---

## Demandes de congés

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| POST | `/api/leaves/calculate` | ✅ | Calcul acquisition (2,5j/mois = 30j/an, période ref 1 juin→31 mai) |
| POST | `/api/leaves` | ✅ | Crée demande (min 12j consécutifs, deadline 28 fév, préavis 30j) |
| GET | `/api/leaves/mine` | ✅ | Mes congés |
| GET | `/api/leaves` | ✅🔑 | Admin : tous les congés |
| GET | `/api/leaves/pending` | ✅🔑 | Demandes en attente |
| GET | `/api/leaves/pending/count` | ✅🔑 | Compteur en attente |
| GET | `/api/leaves/:id` | ✅ | Détail + historique + signatures |
| PUT | `/api/leaves/:id/decision` | ✅🔑 | Admin approuve/rejette (interdit auto-approbation — Phase 1) |
| PUT | `/api/leaves/:id/sign` | ✅ | Signature salarié |
| PUT | `/api/leaves/:id/cancel` | ✅ | Annulation (>30j avant) |
| POST | `/api/leaves/:id/justification` | ✅ | Certificat médical / justificatif |

---

## Soldes & Stats

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/leaves/balances` | ✅🔑 | Soldes de tous les employés |
| PUT | `/api/leaves/balances` | ✅🔑 | Ajustement solde (correction, report) |
| GET | `/api/leaves/stats` | ✅🔑 | Stats agrégées (pris, en attente, refusés) |
| GET | `/api/leaves/conflicts` | ✅🔑 | Détection chevauchements congés |
| GET | `/api/leaves/:id/history` | ✅ | Historique modifications (audit trail) |
| GET | `/api/leaves/:id/pdf` | ✅ | Génère attestation PDF |

---

## Règles métier (Code du Travail)

- **Acquisition** : 2,5 jours ouvrables / mois travaillé (30j/an)
- **Période de référence** : 1er juin → 31 mai
- **Congé principal** : Min 12 jours ouvrables consécutifs (1er mai → 31 octobre)
- **Demande** : Préavis minimum 30 jours
- **Date limite** : Solde doit être pris avant le 28 février suivant
- **Auto-approbation** : Bloquée (CRIT-4 Phase 1 sécurité)
- **Fractionnement** : Application IDCC 3252

---

## Machine d'état

```
draft → pending → approved → taken
                → rejected
                → cancelled (par le salarié, >30j)
```
