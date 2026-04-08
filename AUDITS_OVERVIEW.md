# AUDITS_OVERVIEW.md — Système Multi-Audits eM@g

> **Date** : 8 avril 2026  
> **Version app** : 2.1.0  
> **Branche source** : `dev` (commit `fb7fbfc`)  
> **Gouvernance** : BDFL — validation requise avant chaque modification

---

## Règles du système

1. **Un audit = une branche = un fichier de suivi**
2. Aucune modification croisée entre audits
3. Validation obligatoire avant toute écriture de code
4. Chaque audit terminé → PR vers `dev` → review → merge
5. Conflits inter-audits signalés et résolus séquentiellement

---

## Audits déjà terminés (session précédente)

| Domaine | Résultat | Commit |
|---------|----------|--------|
| Mapping API (frontend ↔ backend) | ✅ 0 mismatch / 397+ méthodes | — |
| Boutons / Handlers React | ✅ 0 cassé / 500+ handlers | — |
| Modals / Dialogues | ✅ Tous OK (close, ESC, backdrop) | — |
| Mobile | ✅ Parité complète | — |
| Permissions / RBAC | ✅ Cohérent toutes routes | — |
| TV-Client | ✅ SNCF.wav + auth optionnelle | `f67d51c`, `216ddaf` |

---

## Audits actifs

| # | Nom | Branche | Fichier suivi | Priorité | Findings | Phase |
|---|-----|---------|---------------|----------|----------|-------|
| 1 | Robustesse | `audit/robustesse` | `AUDIT_ROBUSTESSE.md` | P2 | 7 config/governance | A |
| 2 | Planning / GCal | `audit/planning` | `AUDIT_PLANNING.md` | P1 | 5 (1 HIGH) | A |
| 3 | Sécurité API | `audit/securite` | `AUDIT_SECURITE.md` | P0 | 10 (2 CRIT) | B |
| 4 | Imports | `audit/imports` | `AUDIT_IMPORTS.md` | P1 | 3 HIGH | B |
| 5 | CSS / Design System | `audit/css` | `AUDIT_CSS.md` | P2 | Scan à faire | C |
| 6 | UI / UX | `audit/ui` | `AUDIT_UI.md` | P1 | 10 (2 CRIT) | C |
| 7 | Vidéo | `audit/video` | `AUDIT_VIDEO.md` | P1 | 5 (1 CRIT) | D |
| 8 | Tests / CI | `audit/tests` | `AUDIT_TESTS.md` | P2 | Roadmap v2.1.0 | E |

---

## Ordre d'exécution

```
Phase A (parallèle)  : audit/robustesse + audit/planning
Phase B (séquentiel) : audit/securite → audit/imports
Phase C (séquentiel) : audit/css → audit/ui
Phase D              : audit/video
Phase E              : audit/tests
```

---

## Conflits inter-audits identifiés

| Audit A | Audit B | Fichiers partagés | Résolution |
|---------|---------|-------------------|------------|
| Sécurité | Imports | `server.js`, `schemas/imports.js` | Sécurité d'abord, Imports ensuite |
| CSS | UI/UX | Composants React + CSS | CSS d'abord, UI ensuite |

---

## Versioning

| Événement | Action version |
|-----------|----------------|
| Chaque audit mergé → dev | PATCH (2.1.x) |
| Toutes phases A-E terminées | MINOR (2.2.0) |
| PR vers main | Release tag |

---

## État global

| Phase | Status |
|-------|--------|
| A — Robustesse + Planning | ⬜ TODO |
| B — Sécurité + Imports | ⬜ TODO |
| C — CSS + UI | ⬜ TODO |
| D — Vidéo | ⬜ TODO |
| E — Tests/CI | ⬜ TODO |
