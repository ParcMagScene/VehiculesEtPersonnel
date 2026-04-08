# AUDIT_TESTS.md — Tests & CI

> **Branche** : `audit/tests` | **Phase** : E | **Priorité** : P2
> **Statut** : ✅ TERMINÉ — commit `93ef09f`

---

## État final

| Métrique | Avant | Après |
|----------|-------|-------|
| Tests | 56 | **85** |
| Suites | 9 | **14** |
| Échecs | 0 | **0** |
| Coverage script | ❌ | ✅ `npm run test:coverage` |

## Corrections appliquées

| # | Action | Détail |
|---|--------|--------|
| T1 | Tests audit Phases B+D | 29 nouveaux tests : 6 supplierImportSchema, 4 contactsImportSchema, 6 stockImportSchema (coerce.number), 5 encryptPassword/decryptPassword (AES-256-GCM), 4 sessions (store/get/remove/token), 4 generateSessionToken |
| T2 | Tables vidéo dans db-init | `cameras`, `camera_presets`, `video_sessions`, `video_access_logs` ajoutées à CRITICAL_TABLES |
| T3 | Script `test:coverage` | `node --test --experimental-test-coverage` (Node natif, 0 dépendance) |

## Backlog (hors scope audit)

| # | Action | Raison |
|---|--------|--------|
| B1 | Migrer vers vitest + @testing-library/react (tests composants) | Ajout de dépendances lourdes |
| B2 | CI GitHub Actions (coverage gate) | Nécessite accès repo/settings |
| B3 | Husky pre-commit | Choix d'outillage projet |
