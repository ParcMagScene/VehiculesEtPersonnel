Tu es Copilot, expert en design system, UI/UX, React, CSS architecture, tokens, theming avancé, et reproduction d’interfaces complexes.
Ta mission : implémenter un mode d’affichage “VS Code” dans eM@g, qui reproduit fidèlement l’apparence réelle de Visual Studio Code — pas seulement ses couleurs, mais sa structure, sa densité, sa philosophie visuelle, ses marges, ses panneaux, ses bordures, ses comportements.

🎯 Objectif général
Créer un mode VS Code dans eM@g qui applique :

une refonte visuelle complète

un layout identique à VS Code

une densité d’interface équivalente

une philosophie minimaliste stricte

une suppression totale des effets web classiques

une cohérence parfaite Desktop + Mobile

Ce mode doit être activable/désactivable via les préférences utilisateur.

🎨 1. Règles visuelles strictes (obligatoires)
Ces règles doivent être appliquées à l’ensemble de l’interface lorsque le mode VS Code est actif.

🔹 Zéro ombre
Aucun box-shadow

Aucun effet de profondeur

Aucun relief visuel

🔹 Zéro arrondi
border-radius: 0 partout

Exceptions très rares : 2px max si nécessaire

🔹 Zéro marge inutile
Layout dense

Panneaux collés bord à bord

Espacements réduits au strict minimum

🔹 Zéro effet glossy
Pas de dégradés

Pas de surfaces brillantes

Pas de transitions inutiles

🔹 Palette VS Code officielle
Fond principal : #1e1e1e

Panneaux : #252526

Sidebar : #1f1f1f

Bordures : #3c3c3c

Texte : #d4d4d4

Accent bleu : #007acc

Hover : éclaircissement léger (+5%)

🔹 Typographie
"Cascadia Code", Consolas, monospace

Taille compacte (13px)

🔹 Icônes
Pack Codicon (icônes officielles VS Code)

Style monochrome

Taille 16px

🔹 Scrollbars
fines

fond sombre

thumb gris clair

🧩 2. Structure UI à reproduire (fidèle à VS Code)
✔ Sidebar gauche
Largeur fixe

Icônes verticales

Labels minimalistes

Séparateur vertical 1px

✔ Header ultra fin
Hauteur réduite

Pas de shadow

Pas de gradient

Alignement strict

✔ Panneaux collés
Aucun espace entre les sections

Bordures fines pour séparer

✔ Modales style VS Code
Fond sombre

Bordure 1px

Header compact

Boutons plats

✔ Tables
Lignes compactes

Hover discret

Bordures fines

Pas de zebra stripes

🧪 3. Livrables attendus de Copilot
Copilot doit générer tout ce qui suit :

📌 A. Fichier CSS complet : theme-vscode.css
Variables CSS globales

Overrides pour tous les composants

Layout, panels, sidebar, header

Boutons, inputs, tables, modales

Scrollbars

Icônes Codicon

📌 B. Composant React : VSCodeLayout.jsx
Structure globale

Sidebar

Header

Panneaux

Zones de contenu

📌 C. Hook : useVSCodeTheme()
Activation / désactivation

Application des classes globales

Gestion des tokens

📌 D. Plan de migration
Liste des composants à adapter

Liste des composants à surcharger

Liste des composants à réécrire

Ordre recommandé

📌 E. Checklist de validation visuelle
Densité

Marges

Bordures

Typo

Hover

Scrollbars

Fidélité VS Code

🧠 4. Contraintes techniques
Ne pas casser le thème actuel

Ne pas casser la PWA

Ne pas casser le TV client

Ne pas casser les modules existants

Le mode VS Code doit être optionnel

Le code doit être modulaire et maintenable

Le thème doit être basé sur des variables CSS

Le layout doit être compatible mobile

🚀 5. Action
Génère maintenant :

Le fichier CSS complet

Les composants React

Le hook de thème

Les tokens

Les overrides

La structure VS Code

Les scrollbars

Les boutons

Les tables

Les modales

Le plan de migration

La checklist de validation

Le tout fidèle à l’apparence réelle de VS Code, pas un simple thème de couleurs.