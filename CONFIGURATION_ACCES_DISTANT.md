# 🌐 Configuration Accès Distant - Port 4173

## 📊 État Actuel

### ✅ Serveur Local Configuré
- **Port** : 4173
- **Interface** : 0.0.0.0 (toutes les interfaces)
- **Processus** : PM2 "vehicules" avec `vite preview`
- **IP Locale** : 192.168.205.75
- **Status** : ✅ Accessible localement

### 🌍 Configuration Externe
- **Nom de domaine** : magsav.duckdns.org
- **IP Publique** : 90.63.233.221
- **DNS** : ✅ Résolution correcte

---

## ⚠️ Problème Identifié

Le port 4173 n'est **pas redirigé** par votre box/routeur depuis l'Internet vers votre Mac.

### Symptômes
- ✅ `http://192.168.205.75:4173/` → Fonctionne (réseau local)
- ✅ `http://localhost:4173/` → Fonctionne (local)
- ❌ `http://magsav.duckdns.org:4173/` → **Ne fonctionne pas** (externe)

---

## 🔧 Solution : Redirection de Port (NAT/PAT)

### Étape 1 : Accéder à l'Interface de Votre Box

#### 🔵 Livebox (Orange)
1. Ouvrir un navigateur
2. Aller sur **http://192.168.1.1**
3. Se connecter (mot de passe au dos de la box)
4. Aller dans **Configuration avancée** → **Réseau** → **NAT/PAT**

#### 🔴 Freebox
1. Ouvrir **http://mafreebox.freebox.fr**
2. Se connecter avec votre compte Free
3. Aller dans **Paramètres de la Freebox** → **Mode avancé** → **Redirections de ports**

#### 🟡 SFR/RED Box
1. Ouvrir **http://192.168.1.1**
2. Se connecter (identifiants sur la box)
3. Aller dans **Réseau** → **NAT/PAT** → **Ajouter une redirection**

#### 🟢 Bouygues Bbox
1. Ouvrir **http://192.168.1.254**
2. Se connecter
3. Aller dans **Services de la Box** → **NAT/PAT**

---

### Étape 2 : Créer la Redirection de Port

Ajouter une nouvelle règle avec ces paramètres :

| Paramètre | Valeur |
|-----------|--------|
| **Nom de la règle** | Vehicules-Frontend |
| **Port externe** | 4173 |
| **Protocole** | TCP |
| **IP locale** | 192.168.205.75 |
| **Port interne** | 4173 |
| **État** | Activé |

### Schéma de la Redirection

```
Internet (90.63.233.221:4173)
         ↓
    Box/Routeur
         ↓ (redirection NAT/PAT)
Mac Mini (192.168.205.75:4173)
         ↓
     Vite Preview Server
```

---

### Étape 3 : Vérifications Complémentaires

#### IP Statique Recommandée

Pour éviter que l'IP locale change, configurez une **IP statique** pour votre Mac :

1. **Système** → **Réglages** → **Réseau**
2. Sélectionner votre connexion (WiFi/Ethernet)
3. **Détails** → **TCP/IP**
4. Changer **Configurer IPv4** : `Manuel`
5. Renseigner :
   - **Adresse IP** : 192.168.205.75
   - **Masque de sous-réseau** : 255.255.255.0
   - **Routeur** : 192.168.205.1 (adresse de votre box)
   - **Serveur DNS** : 8.8.8.8 (Google) ou celui de votre FAI

#### Test Depuis l'Extérieur

Une fois la redirection configurée, testez depuis :

1. **Un mobile en 4G/5G** (pas en WiFi) :
   ```
   http://magsav.duckdns.org:4173/
   ```

2. **Un site de test en ligne** :
   - https://www.yougetsignal.com/tools/open-ports/
   - Vérifier le port 4173 pour l'IP 90.63.233.221

---

## 📋 Configuration Actuelle Serveur

### Port 3002 (Backend)
- ✅ **Déjà configuré** et accessible depuis l'extérieur
- Processus PM2 : `vehicules-backend`

### Port 4173 (Frontend Production)
- ⏳ **À configurer** (objet de ce document)
- Processus PM2 : `vehicules`
- Commande : `npm run preview`

### Port 5174 (Frontend Développement)
- ℹ️ **Usage interne uniquement** (pas besoin de redirection)
- Commande : `npm run dev`

---

## 🔐 Sécurité

### Ports Exposés

Actuellement exposés sur Internet (ou à exposer) :

| Port | Service | Public | Sécurisé |
|------|---------|--------|----------|
| 3002 | Backend API | Oui | ✅ JWT Auth |
| 4173 | Frontend | Oui | ✅ HTTPS recommandé |
| 5174 | Dev Server | **Non** | ⚠️ Local uniquement |

### Recommandations

1. **HTTPS/SSL** :
   - Installer un certificat Let's Encrypt
   - Utiliser un reverse proxy (Caddy/Nginx)
   - Forcer HTTPS pour les connexions externes

2. **Pare-feu** :
   - Limiter les connexions aux ports 3002 et 4173 uniquement
   - Bloquer tous les autres ports entrants

3. **Surveillance** :
   - Activer les logs PM2 (`pm2 logs`)
   - Surveiller les tentatives de connexion suspectes

---

## 🧪 Tests de Validation

### Test 1 : Réseau Local
```bash
# Depuis le Mac
curl -I http://192.168.205.75:4173/

# Résultat attendu : HTTP/1.1 200 OK
```

### Test 2 : Depuis l'Extérieur
```bash
# Depuis un mobile en 4G (ou autre réseau)
# Ouvrir le navigateur :
http://magsav.duckdns.org:4173/

# Résultat attendu : Page de connexion de l'application
```

### Test 3 : Vérifier PM2
```bash
pm2 list
# vehicules doit être "online"

pm2 logs vehicules --lines 10
# Doit afficher "Network: http://192.168.205.75:4173/"
```

---

## 📞 Support

Si le problème persiste après configuration :

### Checklist de Dépannage

- [ ] La redirection de port est bien créée dans la box
- [ ] L'IP locale est correcte (192.168.205.75)
- [ ] Le processus PM2 "vehicules" est bien en ligne
- [ ] Le firewall macOS est désactivé (ou autorise le port 4173)
- [ ] DuckDNS pointe vers la bonne IP publique
- [ ] Test depuis un réseau externe (4G, pas WiFi local)

### Logs à Consulter

```bash
# Logs PM2
pm2 logs vehicules --lines 50

# Vérifier les ports ouverts
lsof -i :4173

# Vérifier les processus
pm2 status
```

### Commandes de Redémarrage

```bash
# Redémarrer le frontend
pm2 restart vehicules

# Redémarrer tous les services
pm2 restart all

# En cas de problème, reconstruire
cd "/Users/reunion/Resevation Véhicules"
npm run build
pm2 restart vehicules
```

---

## ✅ État Final Attendu

Une fois configuré correctement :

```
✅ http://localhost:4173/ → Accessible (local)
✅ http://192.168.205.75:4173/ → Accessible (réseau local)
✅ http://magsav.duckdns.org:4173/ → Accessible (Internet)
✅ http://magsav.duckdns.org:3002/api/vehicles → Accessible (API)
```

---

**Version** : 1.0  
**Date** : 3 février 2026  
**Serveur** : Mac Mini @ 192.168.205.75
