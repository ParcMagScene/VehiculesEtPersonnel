# 🚀 Déploiement Réseau Local - Guide Express

## ⚡ Installation Rapide (5 minutes)

### 1️⃣ Créer la branche de développement

```bash
cd "/Users/reunion/Resevation Véhicules"
git checkout -b dev
git push -u origin dev
git checkout main
```

### 2️⃣ Builder l'application

```bash
npm run build
```

### 3️⃣ Lancer le serveur réseau

#### Option Simple (Vite Preview)

```bash
npm run preview -- --host
```

✅ **Application accessible sur :**
- Local : http://localhost:4173
- Réseau : http://[VOTRE-IP]:4173

#### Option Permanente (PM2 - Recommandé)

```bash
# Installer PM2 globalement
npm install -g pm2

# Installer serve
npm install -g serve

# Lancer le serveur
pm2 serve dist 4173 --spa --name vehicules

# Sauvegarder pour auto-démarrage
pm2 startup
pm2 save
```

### 4️⃣ Trouver votre IP locale

```bash
# macOS/Linux
ipconfig getifaddr en0

# Résultat exemple : 192.168.1.100
```

### 5️⃣ Partager avec collaborateurs

```
🔗 Application Véhicules
URL : http://192.168.1.100:4173

⚠️ Même réseau WiFi requis
```

---

## 🔄 Workflow Développement Quotidien

### Développer sans perturber la production

```bash
# 1. Basculer sur dev
git checkout dev

# 2. Coder
npm run dev  # http://localhost:5173

# 3. Commit fréquents
git add .
git commit -m "Feature: ..."
git push origin dev
```

### Mettre à jour la production (quand stable)

```bash
# 1. Merger dev → main
git checkout main
git merge dev
git push origin main

# 2. Rebuild
npm run build

# 3. Relancer serveur
pm2 restart vehicules
# Ou relancer preview manuellement
```

---

## 🛠️ Commandes Utiles

```bash
# Voir les logs
pm2 logs vehicules

# Monitoring
pm2 monit

# Redémarrer
pm2 restart vehicules

# Arrêter
pm2 stop vehicules

# Supprimer
pm2 delete vehicules
```

---

## 🐛 Problèmes Courants

### "Connection refused"
```bash
# Vérifier serveur
pm2 status

# Vérifier firewall macOS
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --listapps
```

### Page blanche
```bash
# Rebuild
npm run build
pm2 restart vehicules
```

### Modifications non visibles
- Vider cache navigateur : Cmd+Shift+R
- Rebuild + restart

---

## 📱 QR Code pour Mobile

Générer un QR code avec l'URL pour accès mobile facile :
https://www.qr-code-generator.com/

---

**Aide complète :** Voir [STRATEGIE_DEPLOIEMENT.md](STRATEGIE_DEPLOIEMENT.md)
