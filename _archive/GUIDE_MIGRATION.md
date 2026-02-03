# 🚀 Guide de Migration vers SQLite

## ✅ État actuel

Le système backend est **opérationnel** avec :
- ✅ Serveur Node.js + Express sur le port 3000
- ✅ Base de données SQLite avec tracking utilisateur
- ✅ Système d'authentification JWT
- ✅ API REST complète pour tous les modules
- ✅ Frontend React modifié pour utiliser l'API
- ✅ Premier utilisateur créé

## 📋 Étapes de Migration

### 1. Démarrer le serveur backend (si pas déjà fait)

```bash
cd "/Users/reunion/Resevation Véhicules/server"
node server.js
```

Le serveur doit afficher :
```
✅ Base de données initialisée
🚀 Serveur backend démarré sur http://localhost:3000
```

### 2. Connexion initiale

**Identifiants du compte administrateur :**
- Email : `admin@magsav.com`
- Mot de passe : `admin123`

### 3. Exécuter la migration des données

1. Ouvrir dans le navigateur : http://magsav.duckdns.org:4173/migrate-to-sqlite.html
2. Se connecter avec les identifiants admin
3. Cliquer sur "Démarrer la migration"
4. Attendre la fin de la migration (barre de progression)

La migration va transférer :
- ✅ Véhicules
- ✅ Réservations (33 existantes)
- ✅ Clients
- ✅ Conducteurs
- ✅ Lieux
- ✅ Garages
- ✅ Maintenances
- ✅ Configuration Google Calendar

### 4. Utiliser l'application avec SQLite

1. Ouvrir : http://magsav.duckdns.org:4173
2. Se connecter avec `admin@magsav.com` / `admin123`
3. L'application fonctionne maintenant avec la base de données centralisée

## 👥 Création d'utilisateurs supplémentaires

Pour créer d'autres utilisateurs, utiliser l'API :

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nom Utilisateur",
    "email": "email@example.com",
    "password": "motdepasse"
  }'
```

## 🔄 Configurer PM2 pour le backend

Pour que le serveur backend démarre automatiquement :

```bash
pm2 start "/Users/reunion/Resevation Véhicules/server/server.js" --name vehicules-backend
pm2 save
```

Vérifier les processus :
```bash
pm2 list
```

Vous devriez voir :
- `vehicules` (port 4173) - Frontend React
- `vehicules-backend` (port 3000) - Backend Node.js

## 🎯 Nouvelles fonctionnalités

### Tracking utilisateur

Toutes les entités (réservations, maintenances, etc.) sont maintenant trackées avec :
- Utilisateur créateur (`created_by`)
- Date de création (`created_at`)
- Utilisateur modificateur (`modified_by`)
- Date de modification (`modified_at`)

### Historique des modifications

L'API fournit un endpoint pour consulter l'historique :
```bash
curl http://localhost:3000/api/history/:entityType/:entityId \
  -H "Authorization: Bearer <token>"
```

Types d'entités : `vehicles`, `reservations`, `maintenances`, `clients`, `drivers`, `locations`, `garages`

## 🌐 Accès multi-utilisateurs

Tous les collaborateurs peuvent maintenant :
1. Se connecter avec leur propre compte
2. Voir les données en temps réel
3. Créer/modifier des éléments (trackés avec leur nom)
4. Consulter l'historique des modifications

Plus besoin d'import/export manuel !

## 🔧 Dépannage

### Le serveur ne démarre pas
```bash
# Vérifier qu'aucun processus n'utilise le port 3000
lsof -ti:3000 | xargs kill -9

# Redémarrer
cd "/Users/reunion/Resevation Véhicules/server"
node server.js
```

### Erreur de connexion
- Vérifier que le serveur backend tourne (voir ci-dessus)
- Vérifier que PM2 frontend est actif : `pm2 list`
- Redémarrer frontend si besoin : `pm2 restart vehicules`

### Migration échoue
- Vérifier la console du navigateur (F12)
- S'assurer d'être connecté
- Vérifier que IndexedDB contient des données (F12 > Application > IndexedDB)

## 📊 Architecture finale

```
┌─────────────────────────────────────────────┐
│  Frontend React (Port 4173)                 │
│  - Interface utilisateur                    │
│  - LoginForm pour authentification          │
│  - API client (utils/api.js)                │
└───────────────┬─────────────────────────────┘
                │ HTTP/JSON (JWT)
┌───────────────▼─────────────────────────────┐
│  Backend Node.js (Port 3000)                │
│  - Express API REST                         │
│  - Authentification JWT                     │
│  - Gestion de session                       │
└───────────────┬─────────────────────────────┘
                │
┌───────────────▼─────────────────────────────┐
│  SQLite Database (vehicules.db)             │
│  - Toutes les données centralisées          │
│  - Tracking utilisateur automatique         │
│  - Historique des modifications             │
└─────────────────────────────────────────────┘
```

## 🎉 Prochaines étapes (optionnel)

1. **Supprimer IndexedDB** : Une fois la migration confirmée et testée, supprimer le code IndexedDB
2. **Affichage métadonnées** : Ajouter l'affichage des infos utilisateur dans les modales
3. **Historique UI** : Créer une interface pour voir l'historique des modifications
4. **Sauvegarde** : Configurer une sauvegarde automatique de `vehicules.db`

## 📞 Support

En cas de problème :
1. Vérifier les logs du serveur backend
2. Vérifier la console du navigateur (F12)
3. Consulter `BACKEND_STATUS.md` pour plus de détails techniques
