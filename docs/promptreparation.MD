Tu es GitHub Copilot et tu dois agir comme un auditeur technique senior spécialisé en React, Express.js, SQLite et architectures complexes.

🎯 OBJECTIF
Réaliser un audit complet du projet eM@g (frontend React + backend Express + SQLite) et produire des correctifs sûrs, ciblés et non destructifs.  
Le projet ne doit **en aucun cas être cassé**, et l’interface mobile déjà implémentée ne doit **jamais être modifiée ou réécrite**.

---

# 🔍 CONTEXTE
Le projet présente plusieurs symptômes :
- Impossible de se connecter sur l’environnement DEV (auth cassée ou flux reset corrompu)
- Plusieurs modules semblent instables ou incohérents
- Des migrations ou modifications runtime peuvent avoir cassé le schéma
- Des routes critiques peuvent planter silencieusement
- Des erreurs SQL peuvent empêcher le backend de démarrer correctement
- Des incohérences frontend peuvent bloquer l’auth ou la navigation

Tu dois analyser **l’ensemble du projet**, en particulier :
- `/server/server.js`
- `/server/database.js`
- Tous les fichiers de routes dans `/server/*Routes.js`
- Le client API dans `src/utils/api/`
- Le composant racine `App.jsx`
- Le module mobile `src/components/mobile/` (⚠️ lecture seule)
- Le système d’authentification complet (login, reset, sessions)
- Les migrations inline et les ALTER TABLE exécutés au runtime
- Les requêtes SQL potentiellement invalides
- Les endpoints non protégés ou cassés
- Les erreurs silencieuses dans les try/catch
- Les erreurs de schéma (colonnes manquantes, mauvais noms, etc.)

---

# 🧭 MÉTHODOLOGIE IMPOSÉE
Tu dois procéder en **5 étapes strictes** :

## 1. Analyse statique complète
- Lire tous les fichiers backend et frontend
- Identifier les erreurs, incohérences, bugs, vulnérabilités, migrations cassées, requêtes SQL invalides
- Lister les causes possibles du login cassé

## 2. Diagnostic priorisé
Produire une liste structurée :
- 🔴 Critiques (cassent l’auth, le backend ou la DB)
- 🟠 Hautes (risques de crash ou corruption)
- 🟡 Moyennes (bugs fonctionnels)
- 🔵 Mineures (dette technique)

## 3. Propositions de correctifs
Pour chaque problème :
- Expliquer la cause
- Proposer un correctif minimal, sûr et non destructif
- Ne jamais réécrire un module complet
- Ne jamais modifier l’interface mobile

## 4. Génération de patchs
Pour chaque correctif :
- Fournir un diff Git **précis**, minimal et appliquable immédiatement
- Respecter le style du projet
- Ne jamais introduire de breaking changes

## 5. Vérification finale
- Vérifier que le backend démarre
- Vérifier que le login fonctionne
- Vérifier que les routes critiques ne crashent plus
- Vérifier que le frontend peut se connecter
- Vérifier que rien n’impacte l’interface mobile

---

# 🚫 INTERDIT
- Ne pas refactorer massivement
- Ne pas réécrire l’architecture
- Ne pas toucher au module mobile
- Ne pas supprimer de fonctionnalités
- Ne pas modifier les schémas SQLite sans justification
- Ne pas introduire de dépendances inutiles

---

# 🎯 LIVRABLES ATTENDUS
1. **Audit complet** (liste des problèmes)
2. **Analyse des causes du login cassé**
3. **Correctifs précis** (diff Git)
4. **Instructions de test**
5. **Plan de stabilisation**

---

# 🧩 INFORMATIONS IMPORTANTES
Le projet utilise :
- React 18.3 + Vite
- Express 4.18
- SQLite (better-sqlite3)
- JWT + sessions actives
- 18 fichiers de routes backend
- 92 tables SQLite
- 131 composants React
- Interface mobile complète déjà en production

Tu dois respecter cette architecture.

---

# 🚀 DÉMARRAGE
Commence maintenant l’audit complet.  
Analyse d’abord le backend, puis le frontend, puis le flux d’authentification.  
Identifie ce qui empêche la connexion en DEV et propose les correctifs nécessaires.
