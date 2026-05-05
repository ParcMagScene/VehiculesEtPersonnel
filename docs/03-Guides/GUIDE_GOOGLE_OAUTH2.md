# Guide — Configuration Google Calendar OAuth2

> **Version** : 2.3.0  
> **Dernière mise à jour** : 9 avril 2026

---

## Table des matières

1. [Prérequis](#1-prérequis)
2. [Créer le projet Google Cloud](#2-créer-le-projet-google-cloud)
3. [Configurer les identifiants OAuth2](#3-configurer-les-identifiants-oauth2)
4. [Variables d'environnement](#4-variables-denvironnement)
5. [Tester la connexion](#5-tester-la-connexion)
6. [Utilisation quotidienne](#6-utilisation-quotidienne)
7. [Dépannage](#7-dépannage)

---

## 1. Prérequis

- Un compte Google avec accès à [Google Cloud Console](https://console.cloud.google.com/)
- L'application eM@g v2.3.0+ déployée (backend accessible via HTTPS en production)
- Accès au fichier `.env` du backend (`apps/api/.env` ou `.env.production`)

---

## 2. Créer le projet Google Cloud

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un nouveau projet (ou utiliser un projet existant)
3. Activer l'API **Google Calendar API** :
   - Menu → APIs & Services → Library
   - Rechercher « Google Calendar API »
   - Cliquer « Enable »

---

## 3. Configurer les identifiants OAuth2

### 3.1 Écran de consentement

1. Menu → APIs & Services → OAuth consent screen
2. Choisir **External** (ou Internal si G Suite organisationnel)
3. Remplir :
   - **App name** : `eM@g`
   - **User support email** : votre email
   - **Developer contact** : votre email
4. Scopes : ajouter `https://www.googleapis.com/auth/calendar`
5. Sauvegarder

### 3.2 Créer les identifiants

1. Menu → APIs & Services → Credentials
2. **+ Create Credentials** → **OAuth client ID**
3. Type : **Web application**
4. Nom : `eM@g Backend`
5. **Authorized redirect URIs** — ajouter :
   - Production : `https://votre-domaine.com/api/google/callback`
   - Développement : `http://localhost:3003/api/google/callback`
6. Cliquer **Create**
7. **Copier** le `Client ID` et le `Client Secret`

> ⚠️ Le `Client Secret` ne sera affiché qu'une seule fois. Conservez-le en lieu sûr.

---

## 4. Variables d'environnement

Ajouter dans le fichier `.env` du backend (`apps/api/`) :

```env
# Google OAuth2 — Authorization Code Flow
GOOGLE_CLIENT_ID=123456789-xxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx

# Clé de chiffrement AES-256-GCM pour les refresh tokens en DB
# Générer avec : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
GOOGLE_ENCRYPTION_KEY=<64 caractères hexadécimaux>

# URI de redirection (doit correspondre à Google Cloud Console)
GOOGLE_REDIRECT_URI=http://localhost:3003/api/google/callback
```

### Générer la clé de chiffrement

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copier la sortie (64 caractères hex) dans `GOOGLE_ENCRYPTION_KEY`.

### Production

En production, adapter `GOOGLE_REDIRECT_URI` à votre domaine :

```env
GOOGLE_REDIRECT_URI=https://votre-domaine.com/api/google/callback
```

---

## 5. Tester la connexion

1. Redémarrer le backend après avoir configuré le `.env`
2. Vérifier que l'endpoint est accessible :
   ```
   GET /api/google/configured → { "configured": true }
   ```
3. Se connecter à eM@g en tant qu'administrateur
4. Aller dans **Configuration** → onglet **Config Google**
5. Vérifier que le statut indique « API Google configurée »
6. Cliquer **Connecter Google Calendar**
7. Autoriser l'accès sur la page de consentement Google
8. Vous êtes redirigé vers eM@g avec le statut « Connecté »

---

## 6. Utilisation quotidienne

### Connexion unique

Contrairement à l'ancien système, la connexion Google ne se fait **qu'une seule fois**. Le backend conserve un `refresh_token` chiffré qui renouvelle automatiquement les accès.

### Synchronisation

- Les événements Google Calendar se synchronisent **automatiquement toutes les 5 minutes**
- Un seul onglet (le « leader ») effectue les requêtes API
- Les autres onglets reçoivent les mises à jour via BroadcastChannel
- Les événements sont mis en cache dans IndexedDB pour un accès instantané

### Déconnexion

Pour révoquer l'accès Google :
1. Aller dans **Configuration** → **Config Google**
2. Cliquer **Déconnecter**
3. Les tokens sont supprimés du serveur et révoqués côté Google

---

## 7. Dépannage

### « API Google non configurée »

- Vérifier que `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` sont définis dans le `.env`
- Redémarrer le backend après modification du `.env`

### Erreur lors de la redirection Google

- Vérifier que `GOOGLE_REDIRECT_URI` correspond **exactement** à l'URI configurée dans Google Cloud Console
- En développement : `http://localhost:3003/api/google/callback`
- En production : `https://votre-domaine.com/api/google/callback`

### « Token refresh failed »

- Le refresh token peut être invalidé si :
  - L'utilisateur a révoqué l'accès dans [Google Security Settings](https://myaccount.google.com/permissions)
  - Le projet Google Cloud est resté en mode « Testing » plus de 7 jours (les tokens expirent)
  - Les scopes ont changé
- **Solution** : se déconnecter puis se reconnecter depuis eM@g

### Les événements ne se synchronisent pas

1. Vérifier le statut : **Configuration** → **Config Google** → statut « Connecté »
2. Vérifier que le Calendar ID est correctement configuré
3. Consulter les logs backend pour les erreurs Google API
4. Forcer une synchronisation en rechargeant la page

### Erreur « Rate limit exceeded »

- L'API Google Calendar a un quota de 1 000 000 requêtes/jour
- eM@g limite les appels à 60 req/min (120 en dev)
- Si le quota est dépassé, attendre quelques minutes

### Mode Testing vs Production (Google Cloud)

Si le projet Google Cloud est en mode **Testing** :
- Seuls les utilisateurs ajoutés comme testeurs peuvent se connecter
- Les refresh tokens **expirent après 7 jours**
- Pour passer en production : OAuth consent screen → **Publish App**
