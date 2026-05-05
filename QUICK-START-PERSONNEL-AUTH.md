# 🚀 Quick Start — Authentification Personnelle

## Déploiement rapide en 5 étapes

### 1️⃣ Setup du Provider (2 min)

**Fichier:** `apps/web/src/App.jsx`

Ajouter avant le return:
```jsx
import { PersonalAuthProvider } from './contexts/PersonalAuthContext';

// Dans la fonction App():
<AuthProvider>
  <PersonalAuthProvider>
    <AppContent />
  </PersonalAuthProvider>
</AuthProvider>
```

✅ Commit: `feat: add PersonalAuthProvider to App`

---

### 2️⃣ Update PlanningPanel (3 min)

**Fichier:** `apps/web/src/components/planning/PlanningPanel.jsx`

Ajouter les imports:
```jsx
import PersonalSuiviWrapper from '../suivi/PersonalSuiviWrapper';
import PersonalPlanningWrapper from './PersonalPlanningWrapper';
```

Charger le personnel:
```jsx
const [personnel, setPersonnel] = useState([]);

useEffect(() => {
  api.getSuiviPersonnel()
    .then(setPersonnel)
    .catch(() => setPersonnel([]));
}, []);
```

Remplacer les rendus (chercher `activeSubTab === 'suivi'` et `'tasks'`):
```jsx
{activeSubTab === 'suivi' && (
  <PersonalSuiviWrapper currentUser={currentUser} personnel={personnel} />
)}
{activeSubTab === 'tasks' && (
  <PersonalPlanningWrapper 
    currentUser={currentUser} 
    personnel={personnel} 
    googleEvents={googleEvents} 
  />
)}
```

✅ Commit: `feat: integrate PersonalAuth wrappers in PlanningPanel`

---

### 3️⃣ Update SuiviPanel (2 min)

**Fichier:** `apps/web/src/components/suivi/SuiviPanel.jsx`

Signature fonction:
```jsx
function SuiviPanel({ 
  currentUser, 
  initialPersonId,
  isPersonalMode = false,
  onPersonalDataSaved = null,
}) {
```

Filtrer le personnel:
```jsx
useEffect(() => {
  (async () => {
    try {
      const data = await api.getSuiviPersonnel();
      
      if (isPersonalMode && initialPersonId) {
        setPersonnel(data.filter(p => p.id === initialPersonId));
      } else {
        setPersonnel(data);
      }
      
      // ... reste du code
    } catch (err) {
      setError('Erreur chargement personnel');
    }
  })();
}, [isPersonalMode, initialPersonId]);
```

Appeler le callback après sauvegarde:
```jsx
// Dans handleSaveSheet ou équivalent
await api.updateSuiviSheet(updatedSheet);
if (isPersonalMode && onPersonalDataSaved) {
  await onPersonalDataSaved();
}
```

✅ Commit: `feat: add personalMode support to SuiviPanel`

---

### 4️⃣ Update TaskPlanningPanel (2 min)

**Fichier:** `apps/web/src/components/planning/TaskPlanningPanel.jsx`

Signature fonction:
```jsx
function TaskPlanningPanel({
  currentUser,
  personId = null,
  isPersonalMode = false,
  onPersonalDataSaved = null,
  googleEvents = [],
  // ... autres props
}) {
```

Filtrer les tasks:
```jsx
const visibleTasks = useMemo(() => {
  if (!isPersonalMode || !personId) return tasks || [];
  return (tasks || []).filter(task => 
    task.person_id === personId || 
    task.assigned_to?.includes(personId)
  );
}, [tasks, isPersonalMode, personId]);
```

Utiliser `visibleTasks` au lieu de `tasks` dans le rendu.

Appeler le callback après modification:
```jsx
// Dans handleTaskUpdate ou équivalent
await api.updateTask(taskId, updates);
if (isPersonalMode && onPersonalDataSaved) {
  await onPersonalDataSaved();
}
```

✅ Commit: `feat: add personalMode support to TaskPlanningPanel`

---

### 5️⃣ Test & Deploy (3 min)

**Test unitaire rapide:**
```javascript
// Vérifier dans console:
// 1. Account Équipe login ✅
// 2. Clic "Accès Personnel" → modal apparaît ✅
// 3. Sélect personnel + PIN → filtre data ✅
// 4. Modify data → auto-logout après 2s ✅
// 5. Retour account Équipe ✅
```

**Deploy:**
```bash
git add .
git commit -m "feat: complete personnelAuth integration"
git push
npm run deploy
```

✅ **Done!**

---

## 🔍 Vérification rapide

```bash
# Vérifier les fichiers créés
ls -la apps/web/src/contexts/PersonalAuthContext.jsx
ls -la apps/web/src/components/suivi/PersonalLoginModal.jsx
ls -la apps/web/src/components/suivi/PersonalSuiviWrapper.jsx
ls -la apps/web/src/components/planning/PersonalPlanningWrapper.jsx
ls -la apps/web/src/hooks/usePersonalAuthWithAutoLogout.js

# Build test
npm run build
```

---

## 📚 Documentation

- **`AUTHENTIFICATION-PERSONNELLE-RESUME.md`** — Checklist complète
- **`GUIDE-AUTHENTIFICATION-PERSONNELLE.md`** — Architecture détaillée
- **`INTEGRATION-AUTHENTIFICATION-PERSONNELLE.md`** — Instructions pas à pas

---

## ⏱️ Temps estimé

- ⏱️ Setup Provider: **2 min**
- ⏱️ PlanningPanel: **3 min**
- ⏱️ SuiviPanel: **2 min**
- ⏱️ TaskPlanningPanel: **2 min**
- ⏱️ Test & Deploy: **3 min**

**Total:** ~**12 minutes** ⚡

---

## 🆘 Troubleshooting

### ❌ PersonalAuthProvider not found
```
Vérifier: import correct dans App.jsx
Vérifier: PersonalAuthContext.jsx existe dans src/contexts/
```

### ❌ Modal n'apparaît pas
```
Vérifier: personnel array pas vide
Vérifier: currentUser.isTeam === true
Vérifier: PersonalLoginModal importé dans wrapper
```

### ❌ Auto-logout ne fonctionne pas
```
Vérifier: onPersonalDataSaved callback appelé après save
Vérifier: usePersonalAuthWithAutoLogout hook utilisé dans wrapper
Vérifier: logoutPersonal() implémentée
```

---

## 🎯 Résultat final

✅ Les utilisateurs du compte Équipe peuvent :
- 🔐 S'authentifier comme personnel via PIN/password
- 👀 Voir UNIQUEMENT leurs données (planning/suivi)
- 🔒 Être auto-logout après sauvegarde/inactivité
- 👤 Rester connectés au compte Équipe

**Date déploiement:** 27 avril 2026  
**Statut:** ✅ Prêt pour production
