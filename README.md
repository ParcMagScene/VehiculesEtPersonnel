# 🚛 Système de Réservation de Véhicules

Application web interactive pour gérer les réservations de véhicules avec un calendrier visuel moderne.

## ✨ Fonctionnalités

- **📅 Vues multiples** : Semaine, Mois, Année
- **🖱️ Réservation par clic** : Cliquez sur une période pour créer une réservation
- **⏰ Gestion par demi-journée** : Matin (AM) et Après-midi (PM)
- **🚗 Gestion des véhicules** : Ajout, modification, suppression avec couleurs personnalisées
- **👥 Gestion des clients** : Base de données des clients
- **🚦 Gestion des conducteurs** : Liste des conducteurs disponibles
- **📍 Gestion des lieux** : Référencement des lieux de prestation
- **💾 Sauvegarde automatique** : Toutes les données sont sauvegardées dans le navigateur (localStorage)
- **🌍 Localisation française** : Dates et formats français (Réunion)

## 🚀 Installation

### Prérequis

- Node.js (version 16 ou supérieure)
- npm ou yarn

### Étapes d'installation

1. **Ouvrir le terminal dans le dossier du projet**

```bash
cd "/Users/reunion/Resevation Véhicules"
```

2. **Installer les dépendances**

```bash
npm install
```

3. **Lancer l'application en mode développement**

```bash
npm run dev
```

4. **Ouvrir dans le navigateur**

L'application s'ouvrira automatiquement à l'adresse : **http://localhost:5173**

Si elle ne s'ouvre pas automatiquement, ouvrez votre navigateur web et accédez à cette adresse.

## 📖 Utilisation

### Créer une réservation

1. Cliquez sur une case vide dans le calendrier (intersection véhicule + date + période)
2. Remplissez le formulaire :
   - Client/Prestation
   - Conducteur (optionnel)
   - Lieu (optionnel)
   - Notes (optionnel)
3. Cliquez sur "Créer"

### Modifier une réservation

1. Cliquez sur une case déjà réservée
2. Modifiez les informations
3. Cliquez sur "Modifier" ou "Supprimer"

### Gérer les données

1. Cliquez sur le bouton "⚙️ Gestion" en haut à droite
2. Accédez aux onglets :
   - **Véhicules** : Ajouter/modifier des véhicules avec leur type et couleur
   - **Clients** : Gérer la liste des clients
   - **Conducteurs** : Gérer la liste des conducteurs
   - **Lieux** : Gérer les lieux de prestation

### Navigation dans le calendrier

- **Boutons < >** : Naviguer entre les périodes
- **Bouton "Aujourd'hui"** : Revenir à la date actuelle
- **Boutons Semaine/Mois/Année** : Changer la vue

## 🏗️ Structure du projet

```
Resevation Véhicules/
├── index.html              # Page HTML principale
├── package.json            # Dépendances du projet
├── vite.config.js          # Configuration Vite
├── src/
│   ├── main.jsx            # Point d'entrée React
│   ├── App.jsx             # Composant principal
│   ├── App.css             # Styles globaux
│   ├── index.css           # Styles de base
│   ├── components/         # Composants React
│   │   ├── Header.jsx      # En-tête et navigation
│   │   ├── Calendar.jsx    # Grille du calendrier
│   │   ├── Calendar.css
│   │   ├── ReservationModal.jsx    # Modal de réservation
│   │   ├── ReservationModal.css
│   │   ├── ManagementPanel.jsx     # Panneau de gestion
│   │   └── ManagementPanel.css
│   └── utils/
│       └── storage.js      # Utilitaires localStorage
└── RESA VÉHICULES - JAN26.csv    # Données d'exemple
```

## 🛠️ Technologies utilisées

- **React 18** : Framework JavaScript
- **Vite** : Build tool ultra-rapide
- **date-fns** : Gestion des dates avec localisation française
- **Lucide React** : Icônes modernes
- **CSS3** : Styles avec animations et gradients

## 💾 Stockage des données

Les données sont sauvegardées automatiquement dans le **localStorage** du navigateur :
- Véhicules
- Réservations
- Clients
- Conducteurs
- Lieux

**Note** : Les données sont spécifiques au navigateur utilisé. Pour les sauvegarder, vous pouvez exporter/importer via les outils de développement du navigateur.

## 🌐 Accès via navigateur web

L'application fonctionne entièrement dans votre navigateur web. Aucune installation de serveur supplémentaire n'est nécessaire.

### Accès local
- **URL** : http://localhost:5173
- **Compatible avec** : Chrome, Firefox, Safari, Edge (dernières versions)

### Pour un accès réseau local (autres appareils)

Si vous souhaitez accéder à l'application depuis d'autres appareils sur votre réseau local :

1. Modifiez `vite.config.js` :

```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Permet l'accès réseau
    port: 5173,
    open: true
  }
})
```

2. Trouvez votre adresse IP locale :
   - Mac : `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - Ou dans Préférences Système > Réseau

3. Accédez depuis un autre appareil : `http://[VOTRE_IP]:5173`

## 📱 Responsive

L'application est optimisée pour :
- 💻 Ordinateurs de bureau
- 💻 Ordinateurs portables
- 📱 Tablettes (mode paysage recommandé)

## 🎨 Personnalisation

### Couleurs des véhicules
10 couleurs prédéfinies sont disponibles dans le panneau de gestion.

### Format des dates
La localisation est en français (Réunion) avec `date-fns/locale/fr`.

## 🐛 Dépannage

### Le port 5173 est déjà utilisé
Modifiez le port dans `vite.config.js` :
```javascript
server: {
  port: 5174,  // Changez le numéro
  open: true
}
```

### Les dépendances ne s'installent pas
Essayez :
```bash
rm -rf node_modules package-lock.json
npm install
```

### L'application ne s'ouvre pas dans le navigateur
Ouvrez manuellement : http://localhost:5173

## 📝 Commandes disponibles

```bash
# Développement (avec rechargement automatique)
npm run dev

# Build de production
npm run build

# Prévisualiser le build de production
npm run preview

# Vérifier le code (linting)
npm run lint
```

## 📄 Licence

Projet personnel - Libre d'utilisation

## 👨‍💻 Support

Pour toute question ou problème, consultez :
- Documentation Vite : https://vitejs.dev/
- Documentation React : https://react.dev/
- Documentation date-fns : https://date-fns.org/

---

**Développé avec ❤️ pour faciliter la gestion des réservations de véhicules**
