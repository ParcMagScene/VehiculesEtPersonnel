# 🔴 Résolution : Erreur 400 redirect_uri_mismatch

## 🎯 Problème
```
Erreur 400 : redirect_uri_mismatch
Accès bloqué : la demande de cette appli n'est pas valide
```

Cette erreur signifie que l'URI de redirection utilisée par votre application n'est pas autorisée dans votre projet Google Cloud.

## ✅ Solution rapide

### Étape 1 : Identifier votre URL actuelle

Vous accédez à l'application via :
```
http://magsav.duckdns.org:4173
```

### Étape 2 : Configurer les URI dans Google Cloud Console

1. **Allez dans Google Cloud Console**
   - URL : https://console.cloud.google.com/
   - Sélectionnez votre projet : **ParcMagScene** (ou SYNCHROVEHICULES)

2. **Accédez aux Credentials**
   ```
   APIs & Services → Credentials
   ```

3. **Cliquez sur votre OAuth 2.0 Client ID**
   - Cherchez le Client ID qui commence par : `186509931977-...`
   - Cliquez dessus pour éditer

4. **Ajoutez les URI de redirection autorisées**

   Dans **"Origines JavaScript autorisées"** :
   ```
   http://magsav.duckdns.org:4173
   http://localhost:4173
   http://localhost:5173
   ```

   Dans **"URI de redirection autorisés"** (IMPORTANT) :
   ```
   http://magsav.duckdns.org:4173
   http://localhost:4173
   http://localhost:5173
   ```

5. **Cliquez sur "SAVE" (Enregistrer)**

### Étape 3 : Attendre quelques minutes

Les changements peuvent prendre **2-5 minutes** pour se propager.

### Étape 4 : Vider le cache et réessayer

1. Dans votre navigateur, videz le cache (Ctrl+Shift+R ou Cmd+Shift+R)
2. Ou en mode navigation privée, essayez de vous connecter
3. Rechargez l'application : http://magsav.duckdns.org:4173/
4. Cliquez sur **Se connecter à Google Calendar**

## 🔍 URI de redirection utilisée par l'application

L'application utilise le mode **popup OAuth** avec les URI suivantes :

Pour l'origine : `http://magsav.duckdns.org:4173`
- Origine JavaScript : `http://magsav.duckdns.org:4173`
- URI de redirection : `http://magsav.duckdns.org:4173`

## 📋 Checklist de vérification

Dans Google Cloud Console → Credentials → Votre OAuth Client ID :

### Origines JavaScript autorisées ✅
```
☑ http://magsav.duckdns.org:4173
☑ http://localhost:4173
☑ http://localhost:5173
```

### URI de redirection autorisés ✅
```
☑ http://magsav.duckdns.org:4173
☑ http://localhost:4173
☑ http://localhost:5173
```

### Type d'application
```
☑ Application Web
```

## ⚠️ Erreurs fréquentes

### 1. Oublier le port
❌ `http://magsav.duckdns.org` (manque :4173)
✅ `http://magsav.duckdns.org:4173`

### 2. HTTPS vs HTTP
❌ `https://magsav.duckdns.org:4173` (vous utilisez HTTP, pas HTTPS)
✅ `http://magsav.duckdns.org:4173`

### 3. Slash final
Les deux fonctionnent, mais soyez cohérent :
✅ `http://magsav.duckdns.org:4173`
✅ `http://magsav.duckdns.org:4173/`

### 4. Mauvais projet Google Cloud
- Vérifiez que vous éditez le bon projet (ParcMagScene ou SYNCHROVEHICULES)
- Vérifiez que le Client ID dans l'app correspond au projet édité

## 🔧 Si ça ne fonctionne toujours pas

### Option 1 : Révoquer et recréer

1. **Supprimer l'ancien Client ID**
   - Google Cloud Console → Credentials
   - Trouvez votre OAuth Client ID
   - Cliquez sur l'icône poubelle → DELETE

2. **Créer un nouveau Client ID**
   - Cliquez sur "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Type : **Web application**
   - Nom : `ParcMagScene Production`
   
   **Origines JavaScript autorisées** :
   ```
   http://magsav.duckdns.org:4173
   http://localhost:4173
   ```
   
   **URI de redirection autorisés** :
   ```
   http://magsav.duckdns.org:4173
   http://localhost:4173
   ```

3. **Copier le nouveau Client ID**
   - Notez le Client ID généré

4. **Mettre à jour dans l'application**
   - Gestion → Config Google
   - Collez le nouveau Client ID
   - Cliquez "Enregistrer"
   - Cliquez "Déconnecter OAuth"
   - Reconnectez-vous

### Option 2 : Utiliser l'écran de test OAuth

Si vous êtes en mode "Testing" :

1. Google Cloud Console → APIs & Services → **OAuth consent screen**
2. Vérifiez que votre email (`agendamagscene@gmail.com`) est dans **"Test users"**
3. Si absent → Cliquez "+ ADD USERS" → Ajoutez votre email

## 📸 Capture d'écran de la configuration correcte

Votre configuration devrait ressembler à :

```
┌─────────────────────────────────────────────────┐
│ Edit OAuth client ID                            │
├─────────────────────────────────────────────────┤
│ Name: ParcMagScene Production                   │
│                                                  │
│ Authorized JavaScript origins                   │
│ URIs 1  http://magsav.duckdns.org:4173     [x]  │
│ URIs 2  http://localhost:4173              [x]  │
│ + ADD URI                                        │
│                                                  │
│ Authorized redirect URIs                        │
│ URIs 1  http://magsav.duckdns.org:4173     [x]  │
│ URIs 2  http://localhost:4173              [x]  │
│ + ADD URI                                        │
│                                                  │
│             [CANCEL]        [SAVE]              │
└─────────────────────────────────────────────────┘
```

## 🆘 Dépannage avancé

### Voir l'erreur détaillée

1. Ouvrez la console du navigateur (F12)
2. Onglet "Console"
3. Tentez de vous connecter
4. Cherchez les erreurs rouges contenant "redirect_uri"

### Vérifier l'URL exacte utilisée

Dans la console :
```javascript
console.log(window.location.origin)
```

Résultat attendu : `http://magsav.duckdns.org:4173`

Ajoutez cette URL EXACTEMENT dans les Origines JavaScript autorisées.

## ✅ Test final

Une fois configuré :

1. Videz le cache du navigateur
2. Rechargez : http://magsav.duckdns.org:4173/
3. Cliquez "Se connecter à Google Calendar"
4. Une popup devrait s'ouvrir avec l'écran de consentement Google
5. Autorisez l'accès
6. La popup se ferme
7. Vous devriez voir "✅ Connecté à Google Calendar"

---

**Besoin d'aide ?** Envoyez-moi :
- Capture d'écran de la configuration OAuth dans Google Cloud Console
- Le message d'erreur complet de la console navigateur (F12)
