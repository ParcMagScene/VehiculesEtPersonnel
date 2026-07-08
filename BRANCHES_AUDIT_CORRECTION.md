# BRANCHES D'AUDIT ET DE CORRECTION — eM@g

## 1. Branches d'audit

Branches dédiées à la lecture, au diagnostic et à la production de livrables d'audit, sans correctifs applicatifs hors périmètre explicitement validé.

- `audit/global`
- `audit/backend`
- `audit/db`
- `audit/frontend`
- `audit/uiux`
- `audit/a11y`
- `audit/perf`
- `audit/security`

Règles d'usage :
- Une branche = un périmètre d'audit.
- Pas de mélange de domaines dans la même branche.
- Les livrables d'audit sont versionnés et datés.
- Les findings critiques donnent lieu à des branches de correction dédiées.

## 2. Branches de correction

Branches dédiées aux remédiations techniques, strictement liées aux conclusions d'audit et cadrées par une convention de nommage stable.

Schémas autorisés :
- `fix/global/<issue>`
- `fix/backend/<issue>`
- `fix/db/<issue>`
- `fix/frontend/<issue>`
- `fix/uiux/<issue>`
- `fix/a11y/<issue>`
- `fix/perf/<issue>`
- `fix/security/<issue>`

Règles d'usage :
- Une branche = une intention de correction unique et traçable.
- Nom `<issue>` court, explicite, stable, sans ambiguïté fonctionnelle.
- Les correctifs critiques P0/P1 doivent être isolés des améliorations cosmétiques.
- Les changements transverses sont autorisés uniquement si justifiés dans la PR.

## 3. Règles de merge

- Cible unique de merge : `dev`.
- Interdiction de merge direct vers `main`.
- Interdiction de merge sans PR.
- Interdiction de squash local non relu pour les correctifs critiques.
- Merge conditionné à la validation CI complète.
- Merge conditionné à la résolution explicite des conflits.
- Pour les lots critiques, privilégier des PR petites et séquencées.

## 4. Règles de commit

Convention obligatoire : Conventional Commits strict.

Types autorisés (minimum) :
- `fix`
- `feat`
- `refactor`
- `perf`
- `test`
- `docs`
- `chore`
- `build`
- `ci`

Règles :
- Message : `type(scope): sujet`.
- Scope obligatoire et aligné avec le domaine impacté.
- Sujet court, concret, orienté résultat.
- Pas de commit fourre-tout ni message vague.
- Un commit doit rester lisible et réversible.

## 5. Règles de PR

Chaque PR doit inclure :
- Description précise du problème.
- Motivation du changement.
- Périmètre exact (fichiers/modules impactés).
- Risques identifiés.
- Plan de validation exécuté.
- Captures avant/après pour les changements UI/UX.
- Mise à jour du changelog si applicable.

Règles complémentaires :
- Lier la PR au finding d'audit ou à la tâche backlog.
- Mentionner explicitement les dépendances inter-PR.
- Décrire les impacts sécurité/performance/a11y quand concernés.
- Interdire les PR non testées localement.

## 6. Règles de review

- Minimum 1 reviewer requis avant merge.
- CI verte obligatoire.
- Les remarques bloquantes doivent être résolues avant approbation.
- Relecture orientée risques : sécurité, intégrité données, régression, conformité DS/a11y.
- Pour les correctifs critiques : double validation recommandée (fonctionnelle + technique).
- Les demandes de changement doivent être tracées et fermées explicitement.

## 7. Règles CI

Pipeline obligatoire avant merge :
- `lint`
- `tests`
- `build`
- `docs:check`

Règles d'application :
- Aucune PR fusionnable si un job échoue.
- Les jobs doivent couvrir backend et frontend selon le périmètre modifié.
- Les checks sécurité/performance/a11y sont ajoutés quand le lot le nécessite.
- Les artefacts de validation doivent être consultables en sortie CI.
