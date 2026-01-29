# 🚀 Stratégie de Déploiement Réseau Local + Développement Continu

## 📋 Objectifs

1. ✅ Application accessible sur réseau local professionnel
2. ✅ Pas de login requis pour les collaborateurs
3. ✅ Continuer le développement sans perturber les utilisateurs
4. ✅ Commits/push réguliers sur version stable

---

## 🏗️ Architecture Proposée : Git Flow avec 2 Branches

### **Branch `main`** (Production Stable)
- Version stable testée
- Accessible aux collaborateurs sur le réseau
- Push uniquement après validation complète
- Build de production optimisé

### **Branch `dev`** (Développement)
- Votre environnement de travail
- Commits fréquents sans impact sur `main`
- Tests et expérimentations
- Merge vers `main` quand stable

---

## 🔧 Mise en Place

### 1️⃣ Créer la branche de développement

```bash
# Créer et basculer sur la branche dev
cd "/Users/reunion/Resevation Véhicules"
git checkout -b dev
git push -u origin dev

# Retour sur main pour servir la version stable
git checkout main
```

### 2️⃣ Configuration du serveur réseau local (Production)

#### Option A : Vite Preview (Recommandé - Simple)

```bash
# Sur branch main, builder la version production
npm run build

# Lancer le serveur réseau local
npm run preview -- --host
```

L'application sera accessible via :
- **Votre machine** : `http://localhost:4173`
- **Réseau local** : `http://[VOTRE-IP-LOCAL]:4173`
  
Exemple : `http://192.168.1.100:4173`

**Avantages :**
- ✅ Simple et rapide
- ✅ Build optimisé
- ✅ Pas de configuration complexe

**Inconvénient :**
- ⚠️ Doit rester ouvert dans un terminal

#### Option B : Serveur Node.js Persistant (Production)

Créer un serveur qui tourne en arrière-plan :

```bash
npm install -g serve

# Builder l'application
npm run build

# Lancer serve en arrière-plan
serve -s dist -l 4173 --host 0.0.0.0 &

# Ou avec pm2 pour auto-restart
npm install -g pm2
pm2 serve dist 4173 --spa
pm2 startup
pm2 save
```

**Avantages :**
- ✅ Tourne en arrière-plan
- ✅ Auto-redémarre avec pm2
- ✅ Logs accessibles

#### Option C : Docker (Avancé - Production Professionnelle)

Créer un `Dockerfile` :

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
RUN npm install -g serve
EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173", "--host", "0.0.0.0"]
```

Puis :

```bash
docker build -t vehicules-app .
docker run -d -p 4173:4173 --name vehicules vehicules-app
```

---

## 🔄 Workflow de Développement Quotidien

### Sur la branche `dev` (Votre travail)

```bash
# 1. Basculer sur dev
git checkout dev

# 2. Travailler normalement
npm run dev  # Serveur local sur http://localhost:5173

# 3. Commits fréquents
git add .
git commit -m "Feature: Ajout de..."
git push origin dev

# Pas d'impact sur la version production !
```

### Quand la feature est stable et testée

```bash
# 1. Être sûr que dev est à jour
git checkout dev
git pull origin dev

# 2. Merger dev dans main
git checkout main
git pull origin main
git merge dev

# 3. Résoudre conflits si nécessaire
# 4. Tester une dernière fois
npm run build
npm run preview

# 5. Push vers production
git push origin main

# 6. Rebuild et relancer le serveur réseau
npm run build
# Relancer serve ou pm2 restart
```

### Retour sur dev pour continuer

```bash
git checkout dev
npm run dev
```

---

## 📱 Trouver votre IP locale

### macOS / Linux
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# Ou plus simple :
ipconfig getifaddr en0  # WiFi
ipconfig getifaddr en1  # Ethernet
```

### Windows
```cmd
ipconfig | findstr IPv4
```

Exemple de résultat : `192.168.1.100`

---

## 🌐 Partager l'URL avec les Collaborateurs

Une fois le serveur lancé sur `main` :

```
🔗 Accès Application Véhicules
URL : http://192.168.1.100:4173

📱 Mobile : Scanner ce QR code
[Générer QR code avec https://www.qr-code-generator.com/]

⚠️ Important : Vous devez être sur le même réseau WiFi
```

---

## 🔒 Sécurité Réseau Local

### Recommandations :

1. **Firewall** : Autoriser le port 4173 uniquement sur réseau local
   ```bash
   # macOS
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
   ```

2. **Authentification (Optionnelle)** : Ajouter un reverse proxy avec auth
   ```bash
   # Nginx avec mot de passe simple
   htpasswd -c /etc/nginx/.htpasswd utilisateur
   ```

3. **HTTPS Local (Optionnel)** : Générer certificat self-signed
   ```bash
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
   ```

---

## 📊 Monitoring & Logs

### Avec PM2 :
```bash
pm2 logs vehicules    # Voir les logs
pm2 monit             # Dashboard en temps réel
pm2 restart vehicules # Redémarrer
pm2 stop vehicules    # Arrêter
```

### Logs d'accès :
Vérifier qui se connecte en ajoutant un middleware simple dans `vite.config.js` :

```javascript
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  }
});
```

---

## 🎯 Checklist de Déploiement

### Première fois :
- [ ] Créer branche `dev`
- [ ] Builder l'application (`npm run build`)
- [ ] Choisir option de serveur (Vite preview / serve / pm2)
- [ ] Trouver IP locale
- [ ] Tester accès depuis autre appareil
- [ ] Partager URL avec collaborateurs

### À chaque mise à jour stable :
- [ ] Travailler sur `dev`
- [ ] Tester localement
- [ ] Merger `dev` → `main`
- [ ] Rebuild (`npm run build`)
- [ ] Relancer serveur production
- [ ] Notifier collaborateurs si changements majeurs

---

## 🚨 Troubleshooting

### "ERR_CONNECTION_REFUSED"
- Vérifier que le serveur tourne (`pm2 status`)
- Vérifier firewall
- Ping l'IP locale depuis autre appareil

### "Page blanche après build"
- Vérifier `vite.config.js` : `base: './'`
- Reconstruire : `npm run build`

### "Modifications non visibles"
- Vider cache navigateur (Cmd+Shift+R)
- Rebuild + relancer serveur

---

## 📈 Évolutions Futures

1. **CI/CD Automatique** : GitHub Actions pour build auto sur push `main`
2. **Hébergement Cloud** : Netlify, Vercel, ou serveur dédié
3. **Multi-environnements** : Staging + Production
4. **Analytics** : Google Analytics ou Plausible
5. **PWA** : Application installable hors-ligne

---

## ✅ Commandes Rapides de Référence

```bash
# DÉVELOPPEMENT (branch dev)
git checkout dev
npm run dev
git add . && git commit -m "..." && git push origin dev

# PRODUCTION (branch main)
git checkout main
git merge dev
npm run build
npm run preview -- --host
git push origin main

# SERVEUR PERMANENT
pm2 serve dist 4173 --spa --name vehicules
pm2 save

# MONITORING
pm2 logs vehicules
pm2 monit
```

---

**Prêt à déployer ! 🚀**

Pour toute question, consultez :
- [Documentation Vite](https://vitejs.dev/guide/build.html)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Git Branching](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging)
