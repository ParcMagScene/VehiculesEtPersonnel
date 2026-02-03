# 💾 Sauvegarde de la Base de Données

## 🔄 Script de Backup Automatique

Le script `backup-database.sh` permet de créer des sauvegardes de la base de données.

### Utilisation Manuelle

```bash
cd /Users/reunion/Resevation\ Véhicules/server
./backup-database.sh
```

### Fonctionnalités

- ✅ Sauvegarde automatique de `vehicules.db`
- ✅ Horodatage des backups (format: `vehicules_backup_YYYY-MM-DD_HH-MM-SS.db`)
- ✅ Conservation des 30 dernières sauvegardes
- ✅ Nettoyage automatique des anciennes sauvegardes
- ✅ Affichage de la taille et du nombre de backups

### Configuration Cron (optionnel)

Pour automatiser les sauvegardes quotidiennes :

```bash
# Éditer le crontab
crontab -e

# Ajouter cette ligne pour une sauvegarde quotidienne à 2h du matin
0 2 * * * /Users/reunion/Resevation\ Véhicules/server/backup-database.sh >> /tmp/backup.log 2>&1
```

### Emplacement des Sauvegardes

Les backups sont stockés dans : `/Users/reunion/Resevation Véhicules/server/backups/`

### Restauration d'une Sauvegarde

Pour restaurer une sauvegarde :

```bash
# 1. Arrêter le backend
pm2 stop vehicules-backend

# 2. Sauvegarder l'état actuel
cd /Users/reunion/Resevation\ Véhicules/server
cp vehicules.db vehicules.db.before-restore

# 3. Restaurer depuis un backup
cp backups/vehicules_backup_YYYY-MM-DD_HH-MM-SS.db vehicules.db

# 4. Redémarrer le backend
pm2 start vehicules-backend
```

### ⚠️ Important

- Les fichiers `.db` sont exclus de Git (voir `.gitignore`)
- Les sauvegardes ne sont PAS versionnées dans Git
- Pensez à sauvegarder le dossier `backups/` sur un support externe régulièrement
- En production, configurez un backup hors site (cloud, NAS, etc.)

### Vérification

```bash
# Lister les sauvegardes
ls -lh /Users/reunion/Resevation\ Véhicules/server/backups/

# Voir le nombre de sauvegardes
ls -1 /Users/reunion/Resevation\ Véhicules/server/backups/*.db | wc -l
```
