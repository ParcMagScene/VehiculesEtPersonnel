# 🔒 Politique de Sécurité

## Versions Supportées

| Version | Support Sécurité |
| ------- | ---------------- |
| 1.0.x   | ✅ Support actif |

---

## 🛡️ Vulnérabilités Connues

### État Actuel (Février 2026)

Nous suivons activement les vulnérabilités de nos dépendances via `npm audit`.

#### 📦 Dépendances avec Vulnérabilités

##### 1. xlsx (Haute Priorité)
- **Version actuelle:** 0.18.5
- **Vulnérabilités:**
  - **GHSA-4r6h-8v6p-xvw6** - Prototype Pollution
  - **GHSA-5pgg-2g8v-p4x9** - Regular Expression Denial of Service (ReDoS)
- **Sévérité:** HIGH
- **Impact:** 
  - Exploitable uniquement si l'utilisateur importe un fichier Excel malveillant
  - L'application n'accepte des imports Excel que depuis des utilisateurs authentifiés
- **Mitigation actuelle:**
  - ⚠️ Pas de patch disponible (dépendance maintenue mais pas de fix)
  - Limitation de l'import Excel aux administrateurs uniquement
  - Validation côté serveur des fichiers importés
- **Roadmap:**
  - **Court terme:** Documenter le risque dans la formation utilisateurs
  - **Moyen terme:** Évaluer migration vers `exceljs` ou `xlsx-populate`
  - **Date cible:** Q2 2026

##### 2. esbuild/vite (Priorité Modérée)
- **Versions actuelles:** esbuild <=0.24.2, vite 5.2.0
- **Vulnérabilité:**
  - **GHSA-67mh-4wv8-2f99** - SSRF sur serveur de développement
- **Sévérité:** MODERATE
- **Impact:**
  - ⚠️ Exploitable UNIQUEMENT en mode développement local
  - **Aucun risque en production** (build statique)
- **Mitigation:**
  - Serveur de développement utilisé uniquement sur réseau local privé
  - Serveur de production sert des fichiers statiques (pas de dev server)
- **Roadmap:**
  - Migration vers Vite 7.x planifiée pour Q2 2026
  - Nécessite tests de compatibilité (breaking changes)

---

## 🔐 Pratiques de Sécurité Implémentées

### Backend (Node.js/Express + SQLite)

✅ **Requêtes SQL Préparées**
- 100% des requêtes utilisent des prepared statements
- Protection contre SQL Injection garantie
- Audit: 100% conforme

✅ **Authentification JWT**
- Tokens expirés après 30 jours
- Hash bcrypt pour les mots de passe (12 rounds)
- Validation côté serveur sur toutes les routes protégées

✅ **Validation des Entrées**
- Validation des types de données
- Génération automatique d'ID si manquant
- Sanitization des inputs utilisateur

### Frontend (React + Vite)

✅ **Protection XSS**
- Aucun usage de `dangerouslySetInnerHTML`
- React échappe automatiquement tout le contenu JSX
- Audit: 0 occurrence trouvée

✅ **Stockage Sécurisé**
- Tokens JWT stockés en localStorage (acceptable pour usage LAN interne)
- Tokens Google Calendar expirés après 60 minutes
- Pas de refresh token persisté

⚠️ **Limitations Connues**
- LocalStorage vulnérable aux attaques XSS
- Acceptable pour usage réseau local privé
- Pour usage internet public: migrer vers httpOnly cookies

### Réseau

✅ **Configuration CORS**
- Origines autorisées configurables
- Headers sécurisés
- Validation des requêtes cross-origin

⚠️ **HTTPS**
- Actuellement HTTP uniquement (réseau local)
- Pour exposition internet: implémenter HTTPS avec Let's Encrypt

---

## 📋 Procédure de Mise à Jour des Dépendances

### Audit Régulier

```bash
# Vérifier les vulnérabilités
npm audit

# Format JSON pour analyse
npm audit --json

# Vérifier uniquement production
npm audit --production
```

### Mise à Jour Sécurisée

```bash
# 1. Sauvegarder l'état actuel
git checkout -b security-update-$(date +%Y%m%d)
npm list --depth=0 > package-versions-backup.txt

# 2. Mettre à jour les patches mineurs (safe)
npm update

# 3. Tester l'application
npm run build
npm run preview
# Tester manuellement toutes les fonctionnalités critiques

# 4. Vérifier les vulnérabilités restantes
npm audit

# 5. Si OK, commit et merge
git add package.json package-lock.json
git commit -m "Security: Mise à jour des dépendances"
git checkout main
git merge security-update-$(date +%Y%m%d)
```

### Gestion des Breaking Changes

Pour les mises à jour majeures (ex: Vite 5 → 7):

1. **Créer une branche dédiée**
   ```bash
   git checkout -b upgrade-vite-7
   ```

2. **Lire le changelog et migration guide**
   - https://vitejs.dev/guide/migration.html

3. **Mise à jour progressive**
   ```bash
   npm install vite@7 --save-dev
   npm install @vitejs/plugin-react@latest --save-dev
   ```

4. **Tests complets**
   - Build production
   - Test de toutes les routes
   - Vérification du code splitting
   - Performance benchmarking

5. **Rollback si nécessaire**
   ```bash
   git checkout main
   git branch -D upgrade-vite-7
   ```

---

## 🚨 Signaler une Vulnérabilité

### Contact

Si vous découvrez une vulnérabilité de sécurité, **ne créez PAS d'issue publique**.

Contactez:
- **Email:** admin@magsav.com
- **Délai de réponse:** 48 heures maximum

### Informations à Fournir

- Description détaillée de la vulnérabilité
- Étapes de reproduction
- Impact potentiel
- Version affectée
- Preuve de concept (si disponible)

### Processus de Traitement

1. **Accusé de réception** - 48h
2. **Évaluation de la gravité** - 1 semaine
3. **Développement du patch** - 2-4 semaines selon gravité
4. **Publication du fix** - Avec mention de crédit (si souhaité)
5. **Divulgation publique** - 30 jours après le patch

---

## 📚 Ressources Sécurité

### Outils d'Audit

- **npm audit** - Audit des dépendances Node.js
- **Snyk** - Monitoring continu des vulnérabilités
- **OWASP ZAP** - Tests de pénétration web
- **SQLMap** - Tests SQL injection

### Bonnes Pratiques

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [React Security Best Practices](https://snyk.io/blog/10-react-security-best-practices/)

### Monitoring

- Logs serveur: `/server/logs/`
- Logs PM2: `pm2 logs`
- Erreurs frontend: DevTools Console (en développement)

---

## 🔄 Historique des Mises à Jour Sécurité

### 2026-02-08
- ✅ Audit complet réalisé
- ✅ Documentation SECURITY.md créée
- ✅ Identification de 3 vulnérabilités (1 high, 2 moderate)
- ✅ Plan de mitigation établi

### 2026-02-04
- ✅ Correction vulnérabilité ID null (réservations)
- ✅ Validation serveur renforcée
- ✅ Protection contre suppression d'objets null

---

## ⚖️ Responsabilités

### Mainteneur
- Monitoring mensuel des vulnérabilités
- Application des patches critiques sous 7 jours
- Documentation des risques connus

### Utilisateurs
- Signalement rapide de comportements suspects
- Respect des bonnes pratiques (mots de passe forts)
- Mise à jour de leurs clients (navigateurs)

---

## 📞 Support

Pour toute question concernant la sécurité:
- 📧 Email: admin@magsav.com
- 📖 Documentation: `/AUDIT_COMPLET_2026.md`
- 🔧 Issues: GitHub (pour questions non-sensibles uniquement)

---

**Dernière mise à jour:** 8 février 2026  
**Prochaine révision:** Mensuelle
