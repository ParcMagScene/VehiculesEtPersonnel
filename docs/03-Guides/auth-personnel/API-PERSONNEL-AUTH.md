# API Documentation — Authentification Personnelle

## usePersonalAuth() Hook

### Description
Hook pour accéder au contexte d'authentification personnelle. Doit être utilisé à l'intérieur d'un composant enveloppé par `PersonalAuthProvider`.

### Signature
```javascript
const {
  // État
  authenticatedPerson,
  authError,
  authLoading,
  isPersonalAuthenticated,
  
  // Actions
  authenticatePersonal,
  logoutPersonal,
  getAuthenticatedPersonId,
  
  // Utilitaires
  clearError,
} = usePersonalAuth();
```

### État

#### `authenticatedPerson: Object | null`
Personne actuellement authentifiée.

**Format:**
```javascript
{
  id: 123,
  first_name: "Jean",
  last_name: "Dupont"
}
```

#### `authError: String | null`
Message d'erreur si l'authentification a échoué.

#### `authLoading: Boolean`
`true` pendant l'authentification, `false` sinon.

#### `isPersonalAuthenticated: Boolean`
`true` si une personne est authentifiée, `false` sinon.

### Actions

#### `authenticatePersonal(personId, options)`

Authentifier une personne avec PIN ou mot de passe.

**Paramètres:**
- `personId: number` (requis) — ID de la personne
- `options: Object` (optionnel)
  - `pin: string` — Code PIN (4 chiffres)
  - `password: string` — Mot de passe

**Retour:**
```javascript
{
  success: true,
  timeoutId: <timer_id>  // Utilisé pour cleanup
}
// ou
false  // Si authentification échouée
```

**Exemple:**
```javascript
const result = await authenticatePersonal(123, {
  pin: '1234'
});

if (result?.success) {
  console.log('Authentifié!');
} else {
  console.log('Erreur:', authError);
}
```

#### `logoutPersonal()`

Déconnecter la personne authentifiée.

**Exemple:**
```javascript
logoutPersonal();
// authenticatedPerson devient null
// isPersonalAuthenticated devient false
```

#### `getAuthenticatedPersonId()`

Obtenir l'ID de la personne authentifiée.

**Retour:** `number | null`

**Exemple:**
```javascript
const personId = getAuthenticatedPersonId();
if (personId) {
  console.log('Connecté en tant que:', personId);
}
```

#### `clearError()`

Effacer le message d'erreur.

**Exemple:**
```javascript
clearError();
// authError devient null
```

---

## usePersonalAuthWithAutoLogout() Hook

### Description
Hook pour gérer la déconnexion automatique basée sur l'inactivité et les timeouts.

### Signature
```javascript
const {
  isPersonalAuthenticated,
  resetInactivityTimer,
  notifyActivity,
  logoutAfterSave,
  logoutPersonal,
} = usePersonalAuthWithAutoLogout({
  inactivityTimeout: 5 * 60 * 1000,  // 5 min
  sessionTimeout: 15 * 60 * 1000,    // 15 min
});
```

### Options

#### `inactivityTimeout: Number`
Timeout d'inactivité en millisecondes. Défaut: 5 min.

#### `sessionTimeout: Number`
Durée maximale de session en millisecondes. Défaut: 15 min.

### Retour

#### `isPersonalAuthenticated: Boolean`
`true` si une personne est authentifiée.

#### `resetInactivityTimer()`
Réinitialiser le timer d'inactivité.

**Automatiquement appelé sur:**
- Clic de souris
- Frappe clavier
- Scroll
- Touch
- Autres interactions utilisateur

#### `notifyActivity()`
Notifier une activité utilisateur (réinitialise le timer).

#### `logoutAfterSave(delayMs)`

Attendre puis déconnecter. Utile après sauvegarde de données.

**Paramètres:**
- `delayMs: number` — Délai avant déconnexion (défaut: 1000ms)

**Retour:** `Promise<void>`

**Exemple:**
```javascript
// Après sauvegarde
const handleSave = async (data) => {
  await api.updateData(data);
  
  // Déconnecter après 2 secondes
  await logoutAfterSave(2000);
};
```

#### `logoutPersonal()`
Déconnecter immédiatement.

---

## PersonalLoginModal Component

### Description
Modal pour authentifier un personnel avec PIN ou mot de passe.

### Props

```typescript
interface PersonalLoginModalProps {
  personnel: Array<{
    id: number;
    first_name: string;
    last_name: string;
  }>;
  isOpen: boolean;
  onClose: () => void;
}
```

### Exemple

```jsx
import PersonalLoginModal from './PersonalLoginModal';
import { usePersonalAuth } from '../contexts/PersonalAuthContext';

function MyComponent() {
  const [showModal, setShowModal] = useState(false);
  const { isPersonalAuthenticated } = usePersonalAuth();
  const [personnel, setPersonnel] = useState([]);
  
  useEffect(() => {
    api.getSuiviPersonnel().then(setPersonnel);
  }, []);
  
  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Login Personnel
      </button>
      
      <PersonalLoginModal
        personnel={personnel}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
      
      {isPersonalAuthenticated && (
        <p>Vous êtes authentifié!</p>
      )}
    </>
  );
}
```

---

## Flux d'intégration dans un composant

### Exemple complet

```jsx
import { usePersonalAuth } from '../contexts/PersonalAuthContext';
import { usePersonalAuthWithAutoLogout } from '../hooks/usePersonalAuthWithAutoLogout';
import PersonalLoginModal from './PersonalLoginModal';

function MyPersonalDataComponent({ personnel = [] }) {
  const [showModal, setShowModal] = useState(false);
  const { authenticatedPerson, isPersonalAuthenticated } = usePersonalAuth();
  const { logoutAfterSave } = usePersonalAuthWithAutoLogout();
  
  const handleSaveData = async (data) => {
    // Sauvegarder les données
    await api.updateData(authenticatedPerson.id, data);
    
    // Afficher un message de succès
    showToast('Données sauvegardées!');
    
    // Auto-logout après 2 secondes
    await logoutAfterSave(2000);
  };
  
  if (isPersonalAuthenticated) {
    return (
      <div>
        <header>
          Connecté en tant que {authenticatedPerson.first_name} {authenticatedPerson.last_name}
        </header>
        
        {/* Contenu filtré */}
        <MyDataPanel 
          personId={authenticatedPerson.id}
          onSave={handleSaveData}
        />
        
        <button onClick={logout}>Terminer</button>
      </div>
    );
  }
  
  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Accès Personnel
      </button>
      
      <PersonalLoginModal
        personnel={personnel}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
```

---

## Gestion des erreurs

### Cas d'erreur courants

#### Personnel non trouvé
```javascript
try {
  await authenticatePersonal(999); // ID invalide
} catch (err) {
  // authError = "Personnel introuvable"
}
```

#### PIN/Password incorrect
```javascript
try {
  await authenticatePersonal(123, { pin: '0000' }); // Mauvais PIN
} catch (err) {
  // authError = "Code PIN ou mot de passe incorrect"
}
```

#### Aucun compte lié
```javascript
try {
  await authenticatePersonal(123);
} catch (err) {
  // authError = "Aucun compte lié à ce personnel"
}
```

### Gestion recommandée

```javascript
const handleAuth = async () => {
  clearError();
  
  const result = await authenticatePersonal(personId, { pin });
  
  if (!result?.success) {
    // authError contient le message
    showErrorToast(authError);
    return;
  }
  
  // Succès
  handleAuthSuccess();
};
```

---

## Performance

### Optimisations

1. **useMemo** — `authenticatedPerson` ne change que lors de l'authentification
2. **useCallback** — Les fonctions d'actions sont stables
3. **Lazy loading** — Composants enveloppés ne se chargent qu'au besoin

### Points de watchdog

```javascript
// ❌ À éviter
function MyComponent() {
  const { authenticatedPerson } = usePersonalAuth();
  
  useEffect(() => {
    // Cet effet se réexécute à chaque changement
    console.log(authenticatedPerson);
  }, [authenticatedPerson]); // ← Dépendance non stable
}

// ✅ Préférer
function MyComponent() {
  const { isPersonalAuthenticated } = usePersonalAuth();
  
  useEffect(() => {
    if (isPersonalAuthenticated) {
      // Logique après authentification
    }
  }, [isPersonalAuthenticated]); // ← Booléen stable
}
```

---

## Tests

### Tests unitaires

```javascript
// Mock du contexte
const mockContext = {
  authenticatedPerson: { id: 123, first_name: 'Jean', last_name: 'Dupont' },
  authError: null,
  authLoading: false,
  isPersonalAuthenticated: true,
  authenticatePersonal: jest.fn(),
  logoutPersonal: jest.fn(),
  getAuthenticatedPersonId: jest.fn(() => 123),
  clearError: jest.fn(),
};

// Tester un composant
test('should display personnelName when authenticated', () => {
  render(
    <PersonalAuthContext.Provider value={mockContext}>
      <MyComponent />
    </PersonalAuthContext.Provider>
  );
  
  expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
});
```

### Tests d'intégration

```javascript
test('authenticatePersonal workflow', async () => {
  const { result } = renderHook(() => usePersonalAuth(), {
    wrapper: PersonalAuthProvider,
  });
  
  // Avant auth
  expect(result.current.isPersonalAuthenticated).toBe(false);
  
  // Authentifier
  await act(async () => {
    await result.current.authenticatePersonal(123, { pin: '1234' });
  });
  
  // Après auth
  expect(result.current.isPersonalAuthenticated).toBe(true);
  expect(result.current.authenticatedPerson.id).toBe(123);
  
  // Logout
  act(() => {
    result.current.logoutPersonal();
  });
  
  // Après logout
  expect(result.current.isPersonalAuthenticated).toBe(false);
});
```

---

**Version API:** 1.0  
**Dernière mise à jour:** 27 avril 2026
