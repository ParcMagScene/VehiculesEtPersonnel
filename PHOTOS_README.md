# Gestion des photos de véhicules

## Comment ajouter de nouvelles photos

1. **Déposez vos photos** dans le dossier `Photos/` à la racine du projet
   - Formats acceptés : `.jpg`, `.jpeg`, `.png`
   - Nommez vos photos de préférence avec l'immatriculation du véhicule (ex: `DL-622-TF.jpg`)

2. **Mettez à jour la liste** en exécutant la commande :
   ```bash
   npm run update-photos
   ```

3. **Rafraîchissez dans l'interface** :
   - Ouvrez le panneau de gestion (bouton ⚙️)
   - Allez dans l'onglet "Véhicules"
   - Cliquez sur le bouton 🔄 à côté du sélecteur de photos
   - Les nouvelles photos apparaîtront dans la liste

## Automatisation

### Option 1 : Mise à jour manuelle
Exécutez `npm run update-photos` chaque fois que vous ajoutez de nouvelles photos.

### Option 2 : Surveillance automatique (recommandé en développement)
Lancez la surveillance du dossier Photos :
```bash
npm run watch-photos
```
Cette commande surveille le dossier `Photos/` et met automatiquement à jour la liste dès qu'un fichier image est ajouté, modifié ou supprimé.

**Important** : Laissez cette commande tourner dans un terminal séparé pendant que vous travaillez.

### Option 3 : Rafraîchissement dans l'interface
Utilisez le bouton de rafraîchissement 🔄 dans le panneau de gestion pour recharger la liste des photos disponibles sans redémarrer l'application.

## Structure des fichiers

```
Resevation Véhicules/
├── Photos/                    # Dossier contenant toutes les photos de véhicules
│   ├── DL-622-TF.jpg
│   ├── EB-855-VR.jpg
│   └── ...
├── public/
│   └── photos-list.json      # Liste générée automatiquement
└── scripts/
    └── generate-photo-list.js # Script de génération
```

## Dépannage

Si les photos n'apparaissent pas :
1. Vérifiez que les fichiers sont bien dans le dossier `Photos/`
2. Exécutez `npm run update-photos`
3. Vérifiez que `public/photos-list.json` contient bien vos photos
4. Rafraîchissez la page de l'application
5. Cliquez sur le bouton 🔄 dans le sélecteur de photos
