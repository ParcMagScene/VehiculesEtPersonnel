# 🚀 Déploiement vers Production - 5 février 2026

## 📦 Modifications à déployer

### Nouvelles fonctionnalités
- ✅ Système de contrôles techniques multi-types (VL, PL, SEMI, SCENE, POLLUTION, HAYON)
- ✅ Alertes intelligentes CT (disparaissent si intervention programmée avant deadline)
- ✅ Lien automatique interventions CT → mise à jour deadlines
- ✅ Bouton "Kilométrage & CT" accessible à tous les utilisateurs
- ✅ Stabilisation OAuth Google Calendar (gestion tokens améliorée)

### Fichiers modifiés
- Database: `server/database.js`, migrations SQL
- Backend: `server/server.js` (gestion technical_control_type)
- Frontend: 29 fichiers (Calendar, MaintenanceDialog, VehicleDetailsModal, etc.)

---

## 🔄 Procédure de déploiement

### Étape 1 : Commiter les changements sur DEV

```bash
cd "/Users/reunion/Resevation Véhicules"

# Ajouter tous les fichiers
git add .

# Commit avec message descriptif
git commit -m "feat: Système CT complet + OAuth Google stable

- Ajout contrôles techniques multi-types avec deadlines
- Alertes intelligentes (masquées si intervention programmée)
- Liaison interventions CT -> mise à jour automatique deadlines
- Bouton kilométrage accessible à tous
- Stabilisation OAuth Google Calendar (tokens + retry)
- Migrations SQL: technical_control_type dans maintenances"

# Pousser sur GitHub
git push origin dev
```

### Étape 2 : Merger DEV → MAIN

```bash
# Basculer sur main
git checkout main

# Merger dev dans main
git merge dev

# Pousser main
git push origin main
```

### Étape 3 : Appliquer les migrations SQL sur la BDD de production

```bash
cd server

# ⚠️ IMPORTANT : Backup de la base avant migration
cp vehicules.db vehicules.db.backup-$(date +%Y%m%d-%H%M%S)

# Appliquer les migrations
sqlite3 vehicules.db < migrations/add_vehicle_maintenance_info.sql
sqlite3 vehicules.db < migrations/add_technical_control_type_to_maintenances.sql

echo "✅ Migrations appliquées"
```

### Étape 4 : Rebuild l'application

```bash
cd "/Users/reunion/Resevation Véhicules"

# Installer nouvelles dépendances (si nécessaire)
npm install

# Builder pour production
npm run build

echo "✅ Build terminé"
```

### Étape 5 : Redémarrer le serveur d'exploitation

#### Si vous utilisez PM2 (recommandé)

```bash
# Redémarrer l'application
pm2 restart vehicules

# Vérifier que c'est bien démarré
pm2 list
pm2 logs vehicules --lines 50
```

#### Si vous utilisez npm run preview

```bash
# Arrêter le serveur actuel (Ctrl+C dans le terminal)
# Puis relancer :
npm run preview -- --host
```

### Étape 6 : Vérifier sur le réseau

1. Ouvrir l'application : `http://[VOTRE-IP]:4173`
2. ✅ Vérifier connexion Google Calendar
3. ✅ Ouvrir un véhicule → cliquer "Kilométrage & Contrôles techniques"
4. ✅ Ajouter un contrôle technique → vérifier l'alerte apparaît
5. ✅ Programmer une intervention CT avant la deadline → l'alerte doit disparaître

---

## 🆘 Rollback en cas de problème

```bash
# Revenir à la version précédente
cd "/Users/reunion/Resevation Véhicules"
git checkout main
git reset --hard HEAD~1
npm run build
pm2 restart vehicules

# Restaurer la BDD
cd server
cp vehicules.db.backup-[DATE] vehicules.db
```

---

## 📝 Notes

- **Base de données** : Les migrations sont cumulatives, ne pas les réexécuter
- **Vehicles.db** : La base est modifiée, backup automatique créé
- **Google OAuth** : Les tokens sont mieux gérés, moins de déconnexions
- **Utilisateurs** : Tous peuvent maintenant accéder aux CT (pas seulement admins)

---

## 🎯 Commande rapide tout-en-un

```bash
#!/bin/bash
cd "/Users/reunion/Resevation Véhicules"

# DEV → commit
git add . && git commit -m "feat: CT complet + OAuth stable" && git push origin dev

# DEV → MAIN
git checkout main && git merge dev && git push origin main

# Migrations SQL
cd server
cp vehicules.db vehicules.db.backup-$(date +%Y%m%d-%H%M%S)
sqlite3 vehicules.db < migrations/add_vehicle_maintenance_info.sql 2>/dev/null
sqlite3 vehicules.db < migrations/add_technical_control_type_to_maintenances.sql 2>/dev/null
cd ..

# Build
npm run build

# Redémarrage
pm2 restart vehicules || echo "⚠️  Relancer manuellement : npm run preview -- --host"

echo "✅ Déploiement terminé !"
```
