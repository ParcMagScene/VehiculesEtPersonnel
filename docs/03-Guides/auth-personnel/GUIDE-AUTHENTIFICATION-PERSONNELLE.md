# Authentification Personnelle — Guide d'Intégration

## Vue d'ensemble

Cette fonctionnalité permet aux utilisateurs du compte commun@magsav.com (Équipe) d'accéder aux données personnalisées d'un membre du personnel (planning et fiches de suivi) en s'authentifiant avec PIN ou mot de passe.

### Flux utilisateur

1. **Accès depuis compte Équipe**
   - L'utilisateur accède au module Planning/Suivi depuis le compte commun@magsav.com
   - Un bouton "🔐 Accès Personnel" s'affiche

2. **Authentification personnelle**
   - L'utilisateur sélectionne un membre du personnel
   - Entre son PIN (4 chiffres) ou mot de passe
   - L'authentification est validée côté serveur

3. **Accès aux données personnelles**
   - Les données sont filtrées pour n'afficher que celles du personnel authentifié
   - En mode Planning : voir ses tâches et assignments uniquement
   - En mode Suivi : voir ses fiches de suivi uniquement
   - Les autres personnels ne sont pas visibles

4. **Déconnexion automatique**
   - Après modification/sauvegarde : déconnexion auto après 2 secondes
   - Après 5 minutes d'inactivité : déconnexion auto
   - Après 15 minutes max de session : déconnexion obligatoire
   - L'utilisateur reste connecté au compte commun@magsav.com

## Architecture

### Backend

La route déjà implémentée :
```
POST /api/suivi/personal-auth
```

**Paramètres :**
- `personId` (number) : ID du personnel
- `pin` (string) : Code PIN (4 chiffres) optionnel
- `password` (string) : Mot de passe optionnel

**Réponse succès :**
```json
{
  "success": true,
  "person": {
    "id": 123,
    "first_name": "Jean",
    "last_name": "Dupont"
  }
}
```

### Frontend

#### Contexte : `PersonalAuthContext`
Gère l'état global de l'authentification personnelle.

**Hooks :**
- `usePersonalAuth()` - Accéder au contexte

**État exposé :**
- `authenticatedPerson` - Personne authentifiée
- `authError` - Message d'erreur
- `authLoading` - État de chargement
- `isPersonalAuthenticated` - Boolean

**Actions :**
- `authenticatePersonal(personId, { pin, password })` - Se connecter
- `logoutPersonal()` - Se déconnecter

#### Hook : `usePersonalAuthWithAutoLogout`
Gère la déconnexion automatique (inactivité, timeout).

**Configuration :**
```javascript
const { logoutAfterSave } = usePersonalAuthWithAutoLogout({
  inactivityTimeout: 5 * 60 * 1000,  // 5 min
  sessionTimeout: 15 * 60 * 1000,    // 15 min
});
```

#### Wrappers
- `PersonalSuiviWrapper` - Enveloppe le SuiviPanel
- `PersonalPlanningWrapper` - Enveloppe le TaskPlanningPanel

## Intégration dans l'application

### 1. Setup du Provider

Dans `apps/web/src/App.jsx`, envelopper l'application avec `PersonalAuthProvider`:

```jsx
import { PersonalAuthProvider } from './contexts/PersonalAuthContext';

function App() {
  return (
    <AuthProvider>
      <PersonalAuthProvider>
        {/* Contenu de l'app */}
      </PersonalAuthProvider>
    </AuthProvider>
  );
}
```

### 2. Remplacer les composants dans PlanningPanel

Au lieu d'importer directement `SuiviPanel` et `TaskPlanningPanel`, utiliser les wrappers:

```jsx
import PersonalSuiviWrapper from './suivi/PersonalSuiviWrapper';
import PersonalPlanningWrapper from './planning/PersonalPlanningWrapper';

// Dans le composant PlanningPanel
function PlanningPanel({ currentUser, personnel = [], ... }) {
  const handleOpenSuivi = (person) => {
    // Maintenant géré par le wrapper
  };

  return (
    <div>
      {/* Onglet Suivi */}
      {activeSubTab === 'suivi' && (
        <PersonalSuiviWrapper 
          currentUser={currentUser}
          personnel={personnel}
        />
      )}

      {/* Onglet Planning */}
      {activeSubTab === 'tasks' && (
        <PersonalPlanningWrapper
          currentUser={currentUser}
          personnel={personnel}
          googleEvents={googleEvents}
        />
      )}
    </div>
  );
}
```

### 3. Passer les callbacks de sauvegarde

Modifier les props des wrappers pour notifier les sauvegardes:

```jsx
// Dans SuiviPanel.jsx - ajouter à l'effet de sauvegarde
const handleSave = async (data) => {
  // ... logique de sauvegarde
  if (onPersonalDataSaved) {
    await onPersonalDataSaved();
  }
};

// Idem dans TaskPlanningPanel.jsx
```

## Configuration de sécurité

### Filtrage côté serveur

**IMPORTANT** : Les routes API doivent filtrer les données par `person_id` quand un scope personnel est détecté.

Exemple pour GET /api/suivi/sheets:
```javascript
app.get('/api/suivi/sheets', authenticateToken, (req, res) => {
  const personId = req.query.personId;
  
  // Si scope personnel, forcer le filtrage
  if (req.user.personalScope) {
    personId = req.user.personalScope.personId;
  }
  
  // Garantir que personId est fourni
  if (!personId) {
    return res.status(403).json({ error: 'person_id requis' });
  }
  
  // Requête filtrée
  const sheets = db.prepare(
    'SELECT * FROM tracking_sheets WHERE person_id = ?'
  ).all(personId);
  
  res.json(sheets);
});
```

### Tokens JWT

Le contexte PersonalAuth ne crée PAS de nouveau token JWT. 
Il fonctionne avec le token existant du compte Équipe, en ajoutant un `personalScope` en front-end pour filtrer les données côté client.

## Tests

### Test manuel

1. **Login au compte Équipe**
   - Email: `commun@magsav.com`
   - Password: [le mot de passe]

2. **Accès Personnel**
   - Aller au module Suivi ou Planning
   - Cliquer sur "🔐 Accès Personnel"
   - Sélectionner un personnel
   - Entrer le PIN (4 chiffres) ou mot de passe

3. **Vérifier le filtrage**
   - Confirmer que seules les données du personnel s'affichent
   - Vérifier que les autres personnels ne sont pas visibles

4. **Vérifier l'auto-déconnexion**
   - Modifier une fiche → déconnexion après 2s
   - Rester inactif 5+ min → déconnexion
   - Vérifier le retour au compte Équipe

## Fichiers créés/modifiés

### Nouveaux fichiers
- `src/contexts/PersonalAuthContext.jsx` - Contexte auth personnelle
- `src/components/suivi/PersonalLoginModal.jsx` - Modal login
- `src/components/suivi/PersonalLoginModal.css` - Styles modal
- `src/components/suivi/PersonalSuiviWrapper.jsx` - Wrapper Suivi
- `src/components/planning/PersonalPlanningWrapper.jsx` - Wrapper Planning
- `src/hooks/usePersonalAuthWithAutoLogout.js` - Hook auto-logout

### À modifier
- `src/App.jsx` - Ajouter PersonalAuthProvider
- `src/components/planning/PlanningPanel.jsx` - Utiliser wrappers
- `src/components/suivi/SuiviPanel.jsx` - Ajouter support isPersonalMode
- `src/components/planning/TaskPlanningPanel.jsx` - Ajouter support isPersonalMode
- Backend: Routes API pour filtrer par person_id si personnalScope

## Notes importantes

1. **Sécurité** : Le filtrage doit être fait côté serveur, pas seulement côté client
2. **Permissions** : Le personnel ne peut accéder que via PIN/password valide
3. **Audit** : Chaque accès personnel devrait être loggé (déjà dans auditLog)
4. **Timeout** : Les délais sont configurables mais recommandés à 5/15 min
5. **Cookie** : Le token JWT reste celui du compte Équipe

## Prochaines étapes

1. ✅ Créer les composants
2. ⬜ Intégrer dans PlanningPanel
3. ⬜ Ajouter le Provider dans App.jsx
4. ⬜ Modifier les routes API pour filtrer par person_id
5. ⬜ Tester complètement
6. ⬜ Documenter pour les utilisateurs
