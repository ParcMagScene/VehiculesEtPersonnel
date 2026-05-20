# 📋 Checklist Déploiement — Authentification Personnelle

## Phase 1: Préparation (0-5 min)

### Code Review
- [ ] PersonalAuthContext.jsx — Syntaxe correcte ✓
- [ ] PersonalLoginModal.jsx — Stylisation OK ✓
- [ ] PersonalLoginModal.css — Responsive OK ✓
- [ ] usePersonalAuthWithAutoLogout.js — Timers OK ✓
- [ ] PersonalSuiviWrapper.jsx — Props OK ✓
- [ ] PersonalPlanningWrapper.jsx — Props OK ✓

### Environnement
- [ ] Node version >= 16.x
- [ ] npm packages à jour
- [ ] BASE_URL configurée
- [ ] JWT_SECRET défini
- [ ] Database accessible

### Documentation
- [ ] SYNTHESE-AUTHENTIFICATION-PERSONNELLE.md — Lu ✓
- [ ] QUICK-START-PERSONNEL-AUTH.md — À main ✓
- [ ] API-PERSONNEL-AUTH.md — Signets OK ✓
- [ ] INTEGRATION-AUTHENTIFICATION-PERSONNELLE.md — À jour ✓

---

## Phase 2: Setup Provider (5-7 min)

### Fichier: apps/web/src/App.jsx

```jsx
// ✅ Étape 1: Import
import { PersonalAuthProvider } from './contexts/PersonalAuthContext';
```

**Checklist:**
- [ ] Import ajouté au top
- [ ] Import à bon endroit (après AuthProvider imports)

```jsx
// ✅ Étape 2: Wrapper
<AuthProvider>
  <PersonalAuthProvider>  {/* ← Ajouter ici */}
    <AppContent />
  </PersonalAuthProvider>
</AuthProvider>
```

**Checklist:**
- [ ] Provider enveloppe AppContent
- [ ] Au bon niveau (après AuthProvider)
- [ ] Pas d'erreur de fermeture tag

### Validation
```bash
npm run build  # ✅ Pas d'erreur
```
- [ ] Compilation sans warning
- [ ] Pas de dépendance manquante

---

## Phase 3: Update PlanningPanel (7-10 min)

### Fichier: apps/web/src/components/planning/PlanningPanel.jsx

#### 3.1 Imports
```jsx
import PersonalSuiviWrapper from '../suivi/PersonalSuiviWrapper';
import PersonalPlanningWrapper from './PersonalPlanningWrapper';
```

**Checklist:**
- [ ] 2 imports ajoutés
- [ ] Chemins corrects
- [ ] Pas de typo

#### 3.2 State Personnel
```jsx
const [personnel, setPersonnel] = useState([]);

useEffect(() => {
  api.getSuiviPersonnel()
    .then(setPersonnel)
    .catch(() => setPersonnel([]));
}, []);
```

**Checklist:**
- [ ] State `personnel` créé
- [ ] useEffect charge les données
- [ ] Erreur gérée gracieusement

#### 3.3 Remplacer Rendus

**Chercher:** `activeSubTab === 'suivi'`

**Remplacer par:**
```jsx
{activeSubTab === 'suivi' && (
  <Suspense fallback={<Spinner />}>
    <PersonalSuiviWrapper
      currentUser={currentUser}
      personnel={personnel}
    />
  </Suspense>
)}
```

**Checklist:**
- [ ] SuiviPanel → PersonalSuiviWrapper
- [ ] Props passées: currentUser, personnel
- [ ] Suspense/Spinner conservés

**Chercher:** `activeSubTab === 'tasks'`

**Remplacer par:**
```jsx
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

**Checklist:**
- [ ] TaskPlanningPanel → PersonalPlanningWrapper
- [ ] Props passées: currentUser, personnel, googleEvents
- [ ] Suspense/Spinner conservés

### Validation
```bash
npm run dev  # ✅ Pas d'erreur dans console
```
- [ ] Page se charge
- [ ] Pas d'erreur "can't find component"
- [ ] Pas d'erreur "usePersonalAuth"

---

## Phase 4: Update SuiviPanel (10-12 min)

### Fichier: apps/web/src/components/suivi/SuiviPanel.jsx

#### 4.1 Props
```jsx
function SuiviPanel({ 
  currentUser, 
  initialPersonId,
  isPersonalMode = false,
  onPersonalDataSaved = null,
}) {
```

**Checklist:**
- [ ] Props ajoutées
- [ ] Defaults corrects (false, null)
- [ ] Signature fonction cohérente

#### 4.2 Filtrage Personnel
Chercher le premier `useEffect` qui charge le personnel.

Remplacer par:
```jsx
useEffect(() => {
  (async () => {
    try {
      const data = await api.getSuiviPersonnel();
      
      if (isPersonalMode && initialPersonId) {
        setPersonnel(data.filter(p => p.id === initialPersonId));
      } else {
        setPersonnel(data);
        // ... reste de la logique existante
      }
    } catch (err) {
      setError('Erreur chargement personnel');
    }
  })();
}, [isPersonalMode, initialPersonId]);
```

**Checklist:**
- [ ] Filtre appliqué si isPersonalMode
- [ ] Logique d'erreur préservée
- [ ] Dependencies mises à jour

#### 4.3 Callback Post-Sauvegarde
Trouver la fonction de sauvegarde (ex: `handleSaveSheet`).

Ajouter au bout:
```jsx
// Appeler le callback si en mode personnel
if (isPersonalMode && onPersonalDataSaved) {
  await onPersonalDataSaved();
}
```

**Checklist:**
- [ ] Callback ajouté après await api.*
- [ ] Condition `isPersonalMode` vérifiée
- [ ] Callback attendu avec `await`

### Validation
```bash
npm run dev  # Tester module Suivi
```
- [ ] Mode équipe: Voir tous les personnels
- [ ] Mode personnel: Voir 1 personnel
- [ ] Sauvegarde: Déclenche le callback

---

## Phase 5: Update TaskPlanningPanel (12-14 min)

### Fichier: apps/web/src/components/planning/TaskPlanningPanel.jsx

#### 5.1 Props
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

**Checklist:**
- [ ] Props ajoutées
- [ ] Defaults corrects
- [ ] Pas de conflit avec props existantes

#### 5.2 Filtrage Tâches
Ajouter juste après les states:

```jsx
const visibleTasks = useMemo(() => {
  if (!isPersonalMode || !personId) return tasks || [];
  return (tasks || []).filter(task => 
    task.person_id === personId || 
    task.assigned_to?.includes(personId)
  );
}, [tasks, isPersonalMode, personId]);
```

**Checklist:**
- [ ] useMemo ajouté
- [ ] Dépendances correctes
- [ ] Logique de filtre validée

#### 5.3 Remplacer `tasks` par `visibleTasks`
Chercher tous les usages de `tasks` dans le rendu.

Remplacer:
```jsx
// ❌ AVANT
{tasks?.map(task => ...)}

// ✅ APRÈS
{visibleTasks?.map(task => ...)}
```

**Checklist:**
- [ ] Tous les usages remplacés
- [ ] Pas de `tasks` dans render (sauf définition)
- [ ] Tests de render passent

#### 5.4 Callback Post-Modification
Trouver les fonctions qui modifient tasks (ex: `handleTaskUpdate`).

Ajouter au bout:
```jsx
// Appeler le callback si en mode personnel
if (isPersonalMode && onPersonalDataSaved) {
  await onPersonalDataSaved();
}
```

**Checklist:**
- [ ] Callback ajouté après modification
- [ ] Appel attendu avec `await`
- [ ] Condition vérifiée

### Validation
```bash
npm run dev  # Tester module Planning
```
- [ ] Mode équipe: Voir toutes les tâches
- [ ] Mode personnel: Voir tâches du personnel
- [ ] Modification: Déclenche callback

---

## Phase 6: Test Complet (14-20 min)

### Test 1: Login Équipe
- [ ] Email: commun@magsav.com
- [ ] Password: [le password]
- [ ] ✅ Accès au Dashboard

### Test 2: Accès Personnel — Navigation
- [ ] Aller à Planning tab
- [ ] Voir bouton "🔐 Accès Personnel" (si isTeam)
- [ ] Cliquer → Modal apparaît
- [ ] ✅ Modal affiche liste du personnel

### Test 3: Authentification — PIN
- [ ] Sélectionner un personnel
- [ ] Switcher vers onglet "Code PIN"
- [ ] Entrer PIN valide (4 chiffres)
- [ ] Cliquer "Accéder"
- [ ] ✅ Modal ferme
- [ ] ✅ Header warning apparaît
- [ ] ✅ "🔒 Accès Personnel — NOM PRENOM"

### Test 4: Authentification — Password
- [ ] Cliquer "Accès Personnel" again
- [ ] Sélectionner un personnel
- [ ] Switcher vers onglet "Mot de passe"
- [ ] Entrer password valide
- [ ] Toggle show/hide password
- [ ] ✅ Authentification réussie

### Test 5: Erreurs d'Authentification
- [ ] PIN invalide → message d'erreur
- [ ] Password invalide → message d'erreur
- [ ] Pas de sélection → disabled button
- [ ] ✅ Messages clairs et non-révélateurs

### Test 6: Filtrage des Données
- [ ] En mode personnel, vérifier:
  - [ ] Seules les données du personnel visibles
  - [ ] Les autres personnels **jamais** visibles
  - [ ] Tâches assignées correctement filtrées
  - [ ] Fiches de suivi filtrées

### Test 7: Auto-Logout — Sauvegarde
- [ ] Modifier une fiche/tâche
- [ ] Sauvegarder
- [ ] ✅ Message "Données sauvegardées"
- [ ] ✅ Logout après ~2 secondes
- [ ] ✅ Retour au compte Équipe

### Test 8: Auto-Logout — Inactivité
- [ ] Authentifier en mode personnel
- [ ] Rester inactif 5 minutes
- [ ] ✅ Auto-logout
- [ ] ✅ Pas d'interaction requise

### Test 9: Logout Manuel
- [ ] Authentifier en mode personnel
- [ ] Cliquer bouton "Terminer"
- [ ] ✅ Logout immédiat
- [ ] ✅ Header warning disparaît

### Test 10: Comptes Équipe vs Personnels
- [ ] Compte Équipe: `currentUser.isTeam === true`
- [ ] ✅ Voir bouton "Accès Personnel"
- [ ] Compte personnel: `currentUser.isTeam === false`
- [ ] ✅ Pas de bouton "Accès Personnel"

### Test 11: Responsivité Mobile
- [ ] Ouvrir modal sur mobile
- [ ] ✅ Modal responsive
- [ ] ✅ Select personnel lisible
- [ ] ✅ Inputs lisibles
- [ ] ✅ Buttons cliquables

### Test 12: Performance
- [ ] Pas de lag lors du login
- [ ] Pas de lag lors du filtrage
- [ ] Pas de lag lors de l'auto-logout
- [ ] ✅ Console propre (pas d'erreur)

---

## Phase 7: Optimisation (20-22 min)

### Logs
- [ ] Vérifier pas d'erreur en console
- [ ] Vérifier pas de warning React
- [ ] Vérifier pas de memory leak

### Bundle Size
```bash
npm run build  # Vérifier taille
```
- [ ] Pas de dégradation significative
- [ ] Tous les imports utilisés

### Audit (optionnel)
```bash
npm audit  # Vérifier dépendances
```
- [ ] Pas de vulnérabilité critique

---

## Phase 8: Déploiement (22-30 min)

### Git Workflow
```bash
# 1. Branch
git checkout -b feat/personnel-auth
# ✅ Ajouter checklist

# 2. Stage & commit
git add apps/web/src/
git add SYNTHESE*.md QUICK-START*.md API*.md GUIDE*.md INTEGRATION*.md
git commit -m "feat: complete personnel authentication implementation

- Add PersonalAuthContext for global auth state
- Add PersonalLoginModal for PIN/password entry
- Add usePersonalAuthWithAutoLogout for auto-logout
- Add PersonalSuiviWrapper and PersonalPlanningWrapper
- Update PlanningPanel to use wrappers
- Add isPersonalMode support to SuiviPanel and TaskPlanningPanel
- Add onPersonalDataSaved callbacks for auto-logout after save

Features:
- Personnels can authenticate via PIN (4 digits) or password
- Data is filtered to show only their own planning/suivi
- Auto-logout after 5min inactivity or 15min max session
- Auto-logout 2sec after saving data
- Manual logout via 'Terminer' button

Security:
- PIN/password validated on server
- Filtering on both client and server
- Audit logs for access tracking
- httpOnly cookies for JWT"
# ✅ Message descriptif

# 3. Push
git push origin feat/personnel-auth
# ✅ Voir réponse GitHub

# 4. PR
# → Créer PR via interface GitHub
# → Ajouter description
# → Assigner reviewers
# ✅ Attendre approbation

# 5. Merge
# → After approval: Squash & merge
git checkout main
git pull
# ✅ Branch supprimée automatiquement
```

### Tests Avant Deploy
```bash
npm run lint      # ✅ Pas d'erreur ESLint
npm run build     # ✅ Build succès
npm run test      # ✅ Tests passent (si existants)
npm run deploy    # ✅ Déploiement
```

**Checklist:**
- [ ] Pas d'erreur lint
- [ ] Build sans warning
- [ ] Tests verts
- [ ] Deploy script successful
- [ ] Logs de déploiement vérifiés

### Post-Deploy
- [ ] Vérifier en production
- [ ] Tester login Équipe
- [ ] Tester "Accès Personnel"
- [ ] Vérifier filtrage data
- [ ] Monitor les erreurs

---

## ✅ Sign-Off

### Responsables

| Rôle | Nom | Checked |
|------|------|---------|
| Dev | [Votre nom] | ✅ |
| Review | [Reviewer] | ☐ |
| QA | [QA] | ☐ |
| Deploy | [DevOps] | ☐ |

### Notes

```
[Espace pour notes additionnelles]
```

---

## 📞 Contacts d'urgence

- **Bug imprévu:** [Contact support]
- **Rollback requis:** Revert commit + redeploy
- **Questions:** Voir SYNTHESE-AUTHENTIFICATION-PERSONNELLE.md

---

**Checklist complétée:** [DATE/HEURE]  
**Déploié en production:** [DATE/HEURE]  
**Status final:** ✅ **SUCCÈS**
