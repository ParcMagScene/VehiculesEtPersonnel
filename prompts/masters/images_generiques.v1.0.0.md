# Images Génériques — Prompt Maître
Version: 1.0.0
Statut: stable
Dernière mise à jour: 2026-03-30
Auteur: Alexandre + Copilot
Description: Génération d'images SVG placeholder pour les familles d'équipement dans l'inventaire eM@g.

---

## Contexte

Quand un article d'inventaire n'a pas de photo, eM@g affiche un SVG générique basé sur sa famille d'équipement. Le script `generate-generic-images.mjs` crée ces placeholders.

---

## Familles couvertes

| Famille | Couleur | Icône | Exemples d'items |
|---------|---------|-------|-------------------|
| structure | #ef4444 | 🏗️ | Carré Alu 30, Pont, Praticable |
| son | #3b82f6 | 🔊 | Enceinte, Sub, Console |
| lumiere | #f59e0b | 💡 | Projecteur, Moving Head, PAR |
| video | #8b5cf6 | 📹 | Écran, Projecteur vidéo |
| levage | #10b981 | ⚙️ | Moteur, Palan |
| praticables | #6366f1 | 🟫 | Plateforme, Estrade |
| accessoires | #64748b | 🔧 | Câble, Connecteur |

---

## Format de sortie

- **Répertoire** : `public/Photos/Generic/`
- **Nommage** : `{family}_{type}.svg`
- **Contenu** : SVG avec fond coloré, icône centrée, label texte

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="{color}" rx="12"/>
  <text x="200" y="130" text-anchor="middle" font-size="64">{icon}</text>
  <text x="200" y="200" text-anchor="middle" fill="white" font-size="18">{label}</text>
</svg>
```

---

## Script

```bash
node scripts/generate-generic-images.mjs
```

Le script :
1. Lit la configuration des familles (couleur, icône, items)
2. Génère un SVG pour chaque combinaison famille × type
3. Écrit dans `public/Photos/Generic/`
4. N'écrase pas les fichiers existants sauf si `--force`

---

## Règles impératives

1. Les couleurs doivent correspondre aux tokens du Design System
2. Les icônes doivent rester lisibles à petite taille
3. Ne jamais supprimer les SVG existants — les nouvelles familles s'ajoutent
4. Le fallback dans le frontend utilise `{family}_{type}.svg`

---

## Fichiers de référence

| Fichier | Rôle |
|---------|------|
| `scripts/generate-generic-images.mjs` | Script de génération |
| `public/Photos/Generic/` | Répertoire de sortie |
