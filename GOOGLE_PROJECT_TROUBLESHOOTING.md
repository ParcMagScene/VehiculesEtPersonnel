# 🔧 Résolution problèmes Google Cloud Project

## 🎯 Problème 1 : Projet SYNCHROVEHICULES invisible

### Cause
Votre projet est dans une **organisation** Google Cloud. Par défaut, la console filtre par organisation.

### Solution

1. **Option A : Voir tous les projets**
   - En haut de la console : cliquez sur le sélecteur de projet
   - Cliquez sur **"AUCUNE ORGANISATION"** dans le menu déroulant
   - Vous verrez alors **SYNCHROVEHICULES** apparaître

2. **Option B : Sélectionner l'organisation**
   - Identifiez le nom de votre organisation (ex: "MagScène" ou votre domaine)
   - Sélectionnez cette organisation dans le filtre
   - SYNCHROVEHICULES apparaîtra

3. **Accès direct**
   - URL : https://console.cloud.google.com/home/dashboard?project=VOTRE_PROJECT_ID
   - Le project ID est visible quand vous cliquez sur SYNCHROVEHICULES

## 🔴 Problème 2 : Erreur 401 Unauthorized

### Diagnostic
```
❌ Erreur 401: Request had invalid authentication credentials
```

Cela signifie que vos credentials OAuth2 sont **invalides ou révoquées**.

### Causes possibles

1. **Mauvais Client ID** 
   - Le Client ID actuel : `186509931977-3fnhrf7pepmqrhpt8rfu29q6jgmte8rf`
   - Il pourrait appartenir à "My First Project" au lieu de "SYNCHROVEHICULES"

2. **Token révoqué**
   - Vous avez révoqué l'accès dans votre compte Google
   - Le token a expiré de façon permanente

3. **Mauvais projet sélectionné**
   - Les APIs sont activées dans SYNCHROVEHICULES
   - Mais les credentials utilisées viennent de "My First Project"

## ✅ Solution complète

### Étape 1 : Accéder au bon projet

1. Allez sur https://console.cloud.google.com/
2. En haut : sélecteur de projet → **AUCUNE ORGANISATION**
3. Cliquez sur **SYNCHROVEHICULES**

### Étape 2 : Vérifier/créer les credentials OAuth2

1. Dans SYNCHROVEHICULES, allez dans :
   ```
   APIs & Services → Credentials
   ```

2. **Si vous avez déjà un "Client ID OAuth 2.0"** :
   - Cliquez dessus
   - Vérifiez le **Client ID** et le **Client Secret**
   - Notez-les

3. **Si vous n'avez PAS de Client ID** :
   - Cliquez sur **+ CREATE CREDENTIALS** → **OAuth client ID**
   - Type : **Web application**
   - Nom : `Véhicules MagScène`
   
   - **Origines JavaScript autorisées** :
     ```
     http://localhost:4173
     http://localhost:5173
     http://magsav.duckdns.org:4173
     ```
   
   - **URI de redirection autorisés** :
     ```
     http://localhost:4173
     http://localhost:5173
     http://magsav.duckdns.org:4173
     ```
   
   - Cliquez **CREATE**
   - Notez le **Client ID** et le **Client Secret**

### Étape 3 : Vérifier les APIs activées

Dans SYNCHROVEHICULES → **APIs & Services** → **Enabled APIs & services**

Activées requises :
- ✅ Google Calendar API
- ✅ Maps JavaScript API (pour les lieux)
- ✅ Places API
- ✅ Distance Matrix API
- ✅ Geocoding API

Si manquantes → **+ ENABLE APIS AND SERVICES** → Rechercher et activer

### Étape 4 : Mettre à jour la configuration dans l'application

1. Ouvrez votre application : http://magsav.duckdns.org:4173/
2. Cliquez sur **Gestion** (en haut à droite)
3. Onglet **Config Google**
4. Mettez à jour :
   - **Client ID** : Collez le nouveau Client ID de SYNCHROVEHICULES
   - **Calendar ID** : Laissez `agendamagscene@gmail.com`
   - **Clé API Google Maps** : (si vous avez une clé API)
5. Cliquez **Sauvegarder**

### Étape 5 : Révoquer et reconnecter

1. **Révoquer l'ancien accès** :
   - Allez sur https://myaccount.google.com/permissions
   - Trouvez "Véhicules MagScène" ou "My First Project"
   - Cliquez **Supprimer l'accès**

2. **Dans l'application** :
   - Rechargez la page
   - Cliquez sur **Se connecter à Google Calendar**
   - Autorisez l'accès avec votre compte Google

### Étape 6 : Tester

1. L'application devrait afficher : ✅ Connecté à Google Calendar
2. Essayez de créer une réservation
3. Elle devrait apparaître dans votre Google Calendar

## 🔍 Vérifications supplémentaires

### A. Vérifier quel projet est utilisé

Dans votre navigateur, console (F12) :
```
✅ Config Google chargée - clientId: 186509931977-...
```

Ce Client ID doit correspondre à celui de **SYNCHROVEHICULES**, pas "My First Project".

### B. Comparer les Client IDs

1. **Client ID actuel dans l'app** : 
   ```
   186509931977-3fnhrf7pepmqrhpt8rfu29q6jgmte8rf.apps.googleusercontent.com
   ```

2. **Client ID de SYNCHROVEHICULES** :
   - À vérifier dans Google Cloud Console → Credentials

3. **S'ils sont différents** → Mettez à jour dans Config Google

### C. Écran de consentement OAuth

Dans SYNCHROVEHICULES → **APIs & Services** → **OAuth consent screen**

Vérifiez :
- **Type d'utilisateur** : External (pour usage personnel)
- **Statut** : En test (OK) ou En production
- **Utilisateurs de test** : Ajoutez votre email Google si statut = "En test"

## 🆘 Solution rapide : Nouveau projet propre

Si ça ne fonctionne toujours pas :

### 1. Créer un nouveau projet

1. Google Cloud Console → **Sélecteur de projet** → **NEW PROJECT**
2. Nom : `VehiculesSync` (ou autre)
3. Organisation : **Aucune organisation** (plus simple)
4. **CREATE**

### 2. Activer les APIs

Dans le nouveau projet :
```
APIs & Services → + ENABLE APIS AND SERVICES
```

Activez :
- Google Calendar API
- Maps JavaScript API
- Places API
- Distance Matrix API  
- Geocoding API

### 3. Créer OAuth Client ID

```
APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID
```

Configuration :
- Type : Web application
- Origines JS : `http://magsav.duckdns.org:4173`
- URI de redirection : `http://magsav.duckdns.org:4173`

### 4. Créer une clé API (pour Maps)

```
APIs & Services → Credentials → + CREATE CREDENTIALS → API key
```

Restreindre la clé :
- **API restrictions** : Cochez les 4 APIs Maps
- **Application restrictions** : HTTP referrers
  - Ajoutez : `http://magsav.duckdns.org:4173/*`

### 5. Mettre à jour l'application

Config Google :
- Nouveau Client ID
- Nouvelle clé API Maps
- Calendar ID : `agendamagscene@gmail.com`

## 📊 Résumé des URLs importantes

| Action | URL |
|--------|-----|
| Console principale | https://console.cloud.google.com/ |
| Sélectionner projet | https://console.cloud.google.com/projectselector2 |
| APIs activées | https://console.cloud.google.com/apis/dashboard |
| Credentials | https://console.cloud.google.com/apis/credentials |
| OAuth consent screen | https://console.cloud.google.com/apis/credentials/consent |
| Accès autorisés (compte) | https://myaccount.google.com/permissions |

## 🔐 Sécurité

Pour la production :
1. Restreindre le Client ID aux domaines autorisés uniquement
2. Restreindre la clé API aux APIs utilisées
3. Mettre l'écran de consentement OAuth en production
4. Activer la facturation (mais restez dans le quota gratuit)

---

**Besoin d'aide ?** Si le problème persiste, envoyez-moi :
- Le Client ID que vous utilisez
- Le nom exact de votre projet Google Cloud
- Une capture d'écran de la page Credentials
