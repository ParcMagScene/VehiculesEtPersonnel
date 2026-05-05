# Instructions d'Intégration — Authentification Personnelle

## 1. Setup du Provider dans App.jsx

### Fichier : `apps/web/src/App.jsx`

Ajouter l'import et le Provider:

```jsx
// ========== À ajouter en haut avec les autres imports ==========
import { PersonalAuthProvider } from './contexts/PersonalAuthContext';

// ========== Dans le return du composant App ==========
function AppContent() {
  return (
    <PersonalAuthProvider>
      {/* Wrapper principal */}
      <div className="app-container">
        {/* ... contenu existant ... */}
      </div>
    </PersonalAuthProvider>
  );
}

// À placer APRÈS AuthProvider mais AVANT d'autres providers généraux
function App() {
  return (
    <AuthProvider>
      <PersonalAuthProvider>
        <AppContent />
      </PersonalAuthProvider>
    </AuthProvider>
  );
}
```

## 2. Modification du PlanningPanel

### Fichier : `apps/web/src/components/planning/PlanningPanel.jsx`

#### 2.1 Ajouter les imports

```jsx
// Ajouter à la suite des imports existants
import PersonalSuiviWrapper from '../suivi/PersonalSuiviWrapper';
import PersonalPlanningWrapper from './PersonalPlanningWrapper';
```

#### 2.2 Récupérer la liste du personnel

Ajouter un state pour stocker le personnel (si pas déjà fait):

```jsx
function PlanningPanel({
  currentUser,
  googleEvents = [],
  onNavigateToEntity,
  personnelRefreshKey,
  view,
  setView,
  currentDate,
  setCurrentDate,
  navigateToPersonId,
  onNavigateToPersonHandled,
  quickAssignmentSlot,
  onQuickAssignmentHandled,
}) {
  // ... state existant ...
  
  // Ajouter: charger la liste du personnel pour les wrappers
  const [personnel, setPersonnel] = useState([]);
  
  useEffect(() => {
    api.getSuiviPersonnel()
      .then(setPersonnel)
      .catch(() => setPersonnel([]));
  }, []);
  
  // ... reste du code ...
}
```

#### 2.3 Remplacer les rendus Suivi et Tasks

Trouver la section qui render SuiviPanel et TaskPlanningPanel et remplacer:

**AVANT :**
```jsx
{activeSubTab === 'suivi' && (
  <Suspense fallback={<Spinner />}>
    <SuiviPanel 
      currentUser={currentUser}
      initialPersonId={suiviInitialPersonId}
    />
  </Suspense>
)}

{activeSubTab === 'tasks' && (
  <Suspense fallback={<Spinner />}>
    <TaskPlanningPanel
      currentUser={currentUser}
      googleEvents={googleEvents}
      // ... autres props ...
    />
  </Suspense>
)}
```

**APRÈS :**
```jsx
{activeSubTab === 'suivi' && (
  <Suspense fallback={<Spinner />}>
    <PersonalSuiviWrapper
      currentUser={currentUser}
      personnel={personnel}
    />
  </Suspense>
)}

{activeSubTab === 'tasks' && (
  <Suspense fallback={<Spinner />}>
    <PersonalPlanningWrapper
      currentUser={currentUser}
      personnel={personnel}
      googleEvents={googleEvents}
    />
  </Suspense>
)}
```

## 3. Modification du SuiviPanel

### Fichier : `apps/web/src/components/suivi/SuiviPanel.jsx`

#### 3.1 Ajouter les props

```jsx
function SuiviPanel({ 
  currentUser, 
  initialPersonId,
  isPersonalMode = false,        // ← Ajouter
  onPersonalDataSaved = null,    // ← Ajouter
}) {
  // ... code existant ...
}
```

#### 3.2 Filtrer le personnel en mode personnel

Ajouter après le chargement du personnel:

```jsx
// Charger la liste du personnel
useEffect(() => {
  (async () => {
    try {
      const data = await api.getSuiviPersonnel();
      
      // EN MODE PERSONNEL: filtrer pour n'afficher que le personnel sélectionné
      if (isPersonalMode && initialPersonId) {
        const filtered = data.filter(p => p.id === initialPersonId);
        setPersonnel(filtered);
        if (filtered.length > 0) {
          setSelectedPerson(filtered[0]);
        }
      } else {
        setPersonnel(data);
        // ... reste du code de sélection existant ...
      }
    } catch (err) {
      setError('Erreur chargement personnel');
    }
  })();
}, [isPersonalMode, initialPersonId]);
```

#### 3.3 Appeler le callback après sauvegarde

Trouver la fonction de sauvegarde et ajouter:

```jsx
const handleSaveSheet = async (updatedSheet) => {
  try {
    setSaving(true);
    await api.updateSuiviSheet(updatedSheet);
    setSheet(updatedSheet);
    
    // ← Ajouter ces lignes
    if (isPersonalMode && onPersonalDataSaved) {
      await onPersonalDataSaved();
    }
  } catch (err) {
    setError('Erreur sauvegarde');
  } finally {
    setSaving(false);
  }
};
```

## 4. Modification du TaskPlanningPanel

### Fichier : `apps/web/src/components/planning/TaskPlanningPanel.jsx`

#### 4.1 Ajouter les props

```jsx
function TaskPlanningPanel({
  currentUser,
  personId = null,              // ← Ajouter
  isPersonalMode = false,        // ← Ajouter
  onPersonalDataSaved = null,    // ← Ajouter
  googleEvents = [],
  // ... autres props existantes ...
}) {
  // ... code existant ...
}
```

#### 4.2 Filtrer les tasks en mode personnel

Ajouter un useEffect qui filtre les tasks:

```jsx
// Si mode personnel, filtrer les tasks pour la personne
const visibleTasks = useMemo(() => {
  if (!isPersonalMode || !personId) return tasks || [];
  
  return (tasks || []).filter(task => {
    // Task doit être assignée à ce personnel
    return task.person_id === personId || 
           task.assigned_to?.includes(personId);
  });
}, [tasks, isPersonalMode, personId]);
```

Puis remplacer tous les usages de `tasks` par `visibleTasks` dans le rendu.

#### 4.3 Appeler le callback après modification

Trouver les fonctions qui modifient les tasks et ajouter:

```jsx
const handleTaskUpdate = async (taskId, updates) => {
  try {
    await api.updateTask(taskId, updates);
    
    // Recharger les tasks
    await loadTasks();
    
    // ← Ajouter
    if (isPersonalMode && onPersonalDataSaved) {
      await onPersonalDataSaved();
    }
  } catch (err) {
    setError('Erreur mise à jour tâche');
  }
};
```

## 5. Configuration de la sécurité (Backend)

### Optionnel : Filtrage côté serveur

Si vous voulez une sécurité renforcée, modifier les routes API pour filtrer par person_id.

#### Fichier : `apps/api/suiviRoutes.js`

```javascript
// GET /api/suivi/sheets — Ajouter filtrage optionnel
app.get('/api/suivi/sheets', authenticateToken, (req, res) => {
  const { personId } = req.query;
  
  if (!personId) {
    return res.status(400).json({ 
      error: 'personId requis' 
    });
  }
  
  // Valider que personId est un entier positif
  const pid = Number.parseInt(personId, 10);
  if (!Number.isFinite(pid) || pid <= 0) {
    return res.status(400).json({ 
      error: 'personId invalide' 
    });
  }
  
  const sheets = db.prepare(`
    SELECT * FROM tracking_sheets 
    WHERE person_id = ?
    ORDER BY date DESC
  `).all(pid);
  
  res.json(sheets);
});

// Idem pour GET /api/planning/tasks
app.get('/api/planning/tasks', authenticateToken, (req, res) => {
  const { personId } = req.query;
  
  // Si mode personnel obligatoire, valider personId
  if (req.user.isTeam && !personId) {
    return res.status(400).json({ 
      error: 'personId requis pour compte Équipe' 
    });
  }
  
  let query = 'SELECT * FROM task_assignments WHERE 1=1';
  const params = [];
  
  if (personId) {
    const pid = Number.parseInt(personId, 10);
    if (!Number.isFinite(pid) || pid <= 0) {
      return res.status(400).json({ error: 'personId invalide' });
    }
    query += ' AND person_id = ?';
    params.push(pid);
  }
  
  query += ' ORDER BY date DESC, period ASC';
  const tasks = db.prepare(query).all(...params);
  
  res.json(tasks);
});
```

## 6. Vérification de checklist

- [ ] PersonalAuthProvider ajouté dans App.jsx
- [ ] PersonalSuiviWrapper utilisé dans PlanningPanel
- [ ] PersonalPlanningWrapper utilisé dans PlanningPanel
- [ ] SuiviPanel reçoit isPersonalMode et onPersonalDataSaved
- [ ] TaskPlanningPanel reçoit isPersonalMode et onPersonalDataSaved
- [ ] Les callbacks de sauvegarde sont appelés
- [ ] Les données sont filtrées en mode personnel
- [ ] Le compte Équipe peut voir le bouton "Accès Personnel"
- [ ] L'authentification fonctionne avec PIN/password
- [ ] L'auto-déconnexion fonctionne après modification
- [ ] L'auto-déconnexion fonctionne après inactivité

## Notes

- Les personnels doivent avoir un `user_id` lié dans la table `persons`
- Les personnels doivent avoir un PIN ou mot de passe défini dans la table `users`
- La déconnexion automatique ne ferme pas la session du compte Équipe
- Le filtrage côté client est recommandé mais pas suffisant — ajouter le filtrage côté serveur
