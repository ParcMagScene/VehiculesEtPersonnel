# Gouvernance — eM@g

> **Version** : 1.0.0  
> **Date** : 7 avril 2026

---

## 1. Modèle de gouvernance

eM@g suit un modèle de gouvernance **BDFL** (Benevolent Dictator For Life) avec une équipe de mainteneurs.

### Rôles

| Rôle | Responsabilités | Accès |
|------|----------------|-------|
| **Mainteneur principal** | Décisions finales, releases, merge vers `main` | Admin repo |
| **Mainteneurs** | Review PRs, triage issues, merge vers `dev` | Write repo |
| **Contributeurs** | Code, docs, tests, bug reports | Fork + PR |

---

## 2. Processus de décision

### Décisions techniques
1. Discussion dans une issue GitHub
2. Si consensus → implémentation directe
3. Si désaccord → le mainteneur principal tranche

### Décisions d'architecture
1. Proposition via issue avec label `architecture`
2. Revue par au moins 1 mainteneur
3. Validation mainteneur principal obligatoire
4. Documentation mise à jour avant merge

---

## 3. Branches

| Branche | Rôle | Protection |
|---------|------|------------|
| `main` | Production stable | PR obligatoire, CI verte, review mainteneur |
| `dev` | Développement actif | PR recommandée |
| `feature/*` | Nouvelles fonctionnalités | Depuis `dev` |
| `fix/*` | Corrections | Depuis `dev` |
| `hotfix/*` | Urgences production | Depuis `main` |

---

## 4. Cycle de release

1. Développement sur `dev`
2. Feature freeze → branche `release/vX.Y.Z`
3. Tests + corrections
4. PR vers `main` avec changelog
5. Tag `vX.Y.Z`
6. Merge retour vers `dev`

### Versioning

[Semantic Versioning](https://semver.org/) strict :
- **MAJOR** : rupture d'API, refonte
- **MINOR** : nouvelle fonctionnalité
- **PATCH** : correction, documentation

---

## 5. Règles de merge

### Vers `dev`
- Build qui passe (si CI configurée)
- Pas de fichiers DB/secrets
- Conventional Commits respectés
- Documentation à jour si ajout/modif API ou module

### Vers `main`
- CI verte obligatoire
- Review par 1 mainteneur minimum
- Changelog à jour
- VERSION.md incrémenté
- Aucun fichier `.db`, `.sqlite3`, `.env`

---

## 6. Triage des issues

| Label | Priorité | SLA réponse |
|-------|----------|-------------|
| `critical` / `security` | P0 | 24h |
| `bug` | P1 | 72h |
| `enhancement` | P2 | 1 semaine |
| `question` | P3 | 2 semaines |
| `good first issue` | — | Pour nouveaux contributeurs |

---

## 7. Communication

- **Issues GitHub** : discussions techniques, bugs, features
- **Pull Requests** : reviews de code
- **Discussions GitHub** : questions générales (si activé)
- Langue principale : **Français** (code et commentaires en anglais acceptés)

---

## 8. Licence

MIT — voir [LICENSE](LICENSE)

---

## 9. Amendements

Ce document peut être modifié par PR vers `dev` avec validation du mainteneur principal.
