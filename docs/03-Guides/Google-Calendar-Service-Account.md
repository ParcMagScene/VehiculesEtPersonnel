# Google Calendar avec Service Account

## Objectif
Configurer Google Calendar une seule fois côté administrateur pour que le serveur eM@g charge les événements sans OAuth utilisateur.

## Résultat attendu
- Aucun écran de connexion Google dans le frontend.
- Aucun token OAuth utilisateur stocké.
- Backend uniquement: serveur -> Google Calendar.

## Prérequis
- Accès administrateur Google Cloud Console.
- Accès au serveur backend eM@g.
- ID du calendrier Google à lire.

## 1) Créer le Service Account
1. Ouvrir Google Cloud Console.
2. Sélectionner (ou créer) un projet.
3. Activer l'API Google Calendar.
4. Aller dans IAM & Admin -> Service Accounts.
5. Créer un Service Account dédié (ex: emag-calendar-reader).
6. Générer une clé JSON (Download JSON).

## 2) Partager le calendrier avec le Service Account
1. Ouvrir Google Calendar.
2. Paramètres du calendrier cible.
3. Partage avec des personnes/groupes.
4. Ajouter l'email du Service Account (champ client_email dans le JSON).
5. Donner le droit minimum requis:
   - Lecture: Voir tous les details des evenements.
   - Ecriture seulement si vous activez GOOGLE_BIDIRECTIONAL_SYNC=true.

## 3) Configurer le backend
Configurer une seule des deux options suivantes dans apps/api/.env:

Option A (JSON inline):
- GOOGLE_SERVICE_ACCOUNT_JSON={...json complet sur une ligne...}

Option B (fichier):
- GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/chemin/absolu/service-account.json

Variables associees:
- GOOGLE_CALENDAR_ID=<calendarId Google>
- GOOGLE_BIDIRECTIONAL_SYNC=false (recommande)

Notes de securite:
- Ne jamais exposer la cle Service Account au frontend.
- Ne pas committer le JSON dans Git.
- Restreindre les permissions du fichier (ex: chmod 600).

## 4) Verifier la configuration
Utiliser l'endpoint backend:
- GET /api/calendar/status

Statut attendu:
- configured: true
- serviceAccountEmail: present
- calendarId: present

## 5) Comportement applicatif
- Le frontend lit les evenements via /api/calendar/events.
- Les ecrans OAuth utilisateur ne sont plus utilises.
- Les utilisateurs finaux n'ont aucune connexion Google a effectuer.

## Depannage rapide
- configured=false: verifier la variable GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_SERVICE_ACCOUNT_KEY_PATH.
- Aucun evenement: verifier le partage du calendrier avec l'email du Service Account.
- 403/404 Google: verifier GOOGLE_CALENDAR_ID et les droits appliques au calendrier.
