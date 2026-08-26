# Politique d'Authentification et Validation — eM@g API

## Vue d'ensemble

Cette politique définit les standards obligatoires pour **chaque route mutation** (POST, PUT, PATCH, DELETE) dans l'API backend eM@g.

**Objectif** : Éliminer les failles de sécurité liées à l'authentification incohérente et la validation manquante.

---

## 1. Principes fondamentaux

### 1.1 Authentification
- **Toute mutation** (POST, PUT, PATCH, DELETE) **DOIT** avoir `authenticateToken` comme middleware
- **Aucune exception** — pas d'endpoints de mutation sans auth, sauf cas très exceptionnels documentés et approuvés

### 1.2 Validation des entrées
- **Tout body** de mutation **DOIT** être validé via Zod schema
- **Tous les params** (`:id`, `:resourceId`, etc.) **DOIVENT** être validés via schémas Zod unitaires
- **Aucune validation manuelle** ne remplace une validation Zod formelle

### 1.3 Autorisation
- Déterminer si le middleware `requireAdmin` est nécessaire
- Vérifier la propriété de la ressource (ex: user peut modifier ses propres messages)
- Documentez chaque décision d'autorisation dans la route

---

## 2. Structure obligatoire d'une route mutation

### Pattern standard

```javascript
app.post(
  '/api/resource',
  authenticateToken,                    // OBLIGATOIRE
  validate(resourceBodySchema),          // OBLIGATOIRE — valide req.body
  (req, res) => {
    try {
      // Vérifier l'existence
      // Vérifier la propriété
      // Effectuer la mutation
      // Invalider les caches
      res.json(result);
    } catch (error) {
      logger.error('Erreur POST /api/resource:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  },
);

app.put(
  '/api/resource/:id',
  authenticateToken,                    // OBLIGATOIRE
  validate(numericIdSchema),             // OBLIGATOIRE — valide :id (params)
  validate(resourceBodySchema),          // OBLIGATOIRE — valide req.body
  (req, res) => {
    // ...
  },
);

app.delete(
  '/api/resource/:id',
  authenticateToken,                    // OBLIGATOIRE
  requireAdmin,                         // SI APPLICABLE (optional)
  validate(numericIdSchema),             // OBLIGATOIRE
  (req, res) => {
    // ...
  },
);
```

---

## 3. Schémas de validation disponibles

### Schémas de paramètres (`apps/api/schemas/paramsSchema.js`)

| Schéma | Utilisation | Pattern |
|--------|-----------|---------|
| `numericIdSchema` | ID numérique (affaire_id, person_id) | `{ id: number }` |
| `textIdSchema` | ID textuel (vehicle_id, reservation_id) | `{ id: string }` avec validation alphanumeric |
| `uuidSchema` | ID UUID v4 | `{ id: UUID }` |
| `affaireIdSchema` | Numéro affaire spécifique | `{ id: 'AFxxxxx' }` |

### Schémas métier (`apps/api/schemas/imports.js` et `apps/api/schemas/crud.js`)

| Schéma | Utilisation |
|--------|-----------|
| `affaireSchema` | POST/PUT `/api/affaires` |
| `locationSchema` | POST/PUT `/api/locations` |
| `clientSchema` | POST/PUT `/api/annuaire/clients` |
| `supplierSchema` | POST/PUT `/api/annuaire/suppliers` |
| `contactSchema` | POST/PUT `/api/annuaire/contacts` |
| `personSchema` | POST/PUT `/api/persons` |
| `messageSchema` | POST/PUT `/api/messaging/messages` |

---

## 4. Checklist pour chaque route mutation

- [ ] Route a `authenticateToken` middleware
- [ ] Body validé via `validate(schemaName)`
- [ ] Params validés via `validate(numericIdSchema)` (ou autre)
- [ ] Vérification d'existence : `db.prepare('SELECT ... WHERE id = ?').get(id)` avant mutation
- [ ] Retour 404 si ressource non trouvée
- [ ] Vérification propriété/autorisation si applicable
- [ ] Retour 403 Forbidden si autorisation échoue
- [ ] Cache invalidé après mutation (via `invalidateEntity()` ou `listCache.invalidate()`)
- [ ] Historique enregistré (via `addToHistory()`) si applicable
- [ ] Logs d'erreur présents dans le catch block
- [ ] Réponse JSON structurée `{ success, error, ... }`

---

## 5. Endpoints dépréciés — Pattern 410 Gone

Les endpoints dépréciés **DOIVENT** retourner **410 Gone** (pas 200).

```javascript
function deprecatedRoute(preferred) {
  return (req, res) => {
    logger.warn(
      `⛔ ${req.method} ${req.originalUrl} (legacy) → 410 Gone — utiliser ${preferred}`,
    );
    res.status(410).json({
      success: false,
      error: 'Endpoint supprimé',
      code: 'DEPRECATED_ENDPOINT',
      replacement: preferred,
    });
  };
}

// Utilisation
app.get('/api/legacy-endpoint', deprecatedRoute('/api/new-endpoint'));
```

---

## 6. Middleware validate()

Le middleware `validate()` de `schemas/imports.js` :

```javascript
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const zodIssues = /* ... */;
      const errors = zodIssues.map(e => `${e.path.join('.')}: ${e.message}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Données invalides', 
        details: errors 
      });
    }
    req.body = result.data;
    next();
  };
}
```

**Pour valider les params** (`:id`), créez une variante qui valide `req.params` :

```javascript
// À ajouter si nécessaire pour routes spéciales
export function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      // Handle error...
    }
    req.params = result.data;
    next();
  };
}
```

---

## 7. Exemples conformes

### ✅ Affaires (POST conforme)
```javascript
app.post('/api/affaires', authenticateToken, validate(affaireSchema), (req, res) => {
  // req.body est maintenant typé et validé
  const { numero_affaire, nom, type, ... } = req.body;
  // ...
});
```

### ✅ Locations (PUT conforme)
```javascript
app.put(
  '/api/locations/:id',
  authenticateToken,
  validate(numericIdSchema),
  validate(locationSchema),
  (req, res) => {
    const { id } = req.params; // Validé par numericIdSchema
    const location = req.body; // Validé par locationSchema
    // ...
  },
);
```

### ✅ Personnel (DELETE conforme)
```javascript
app.delete(
  '/api/persons/:id',
  authenticateToken,
  requireAdmin,
  validate(numericIdSchema),
  (req, res) => {
    const { id } = req.params;
    // ...
  },
);
```

---

## 8. Refactoring requis (au 2026-06-01)

| Fichier | Routes | Statut | Effort |
|---------|--------|--------|--------|
| affairesRoutes.js | PUT, DELETE | ✅ DONE | 1 jour |
| locationsRoutes.js | POST, PUT, DELETE | ✅ DONE | 1 jour |
| annuaireRoutes.js | clients/suppliers/contacts (POST/PUT/DELETE) | 🟡 IN-PROGRESS | 2 jours |
| personnelRoutes.js | PUT, DELETE | ✅ DONE | 1 jour |
| messagingRoutes.js | PUT, DELETE | ✅ DONE | 1 jour |
| **TOTAL** | — | — | **~1 semaine** |

---

## 9. Audit et conformité continue

### CI/CD

- `npm run ci:local` exécute : lint, format-check, syntax-check, **test-backend**, **test-frontend**, build
- ESLint plugin (future) : détecter routes mutation sans `authenticateToken`
- Pré-commit hook : vérifier toute mutation a schéma Zod

### Code review

Avant d'approuver un PR :
- ✓ Toute nouvelle mutation a `validate(schema)` ?
- ✓ Schéma Zod approprié choisi ou créé ?
- ✓ Vérification d'existence avant mutation ?
- ✓ Autorisation vérifiée si applicable ?
- ✓ Cache invalidé après mutation ?

---

## 10. Exceptions documentées

Aucune exception n'est autorisée. Toute déviation doit être :
1. **Documentée** dans ce fichier
2. **Approuvée** par l'équipe lead
3. **Tracée** avec un `AUDIT-NOTE` dans le code

Exemple :
```javascript
// AUDIT-NOTE: [2026-05-28] No auth pour demo-only GET endpoint
// Approved: @lead, justification: "Démo publique uniquement, pas de mutation"
app.get('/api/demo/public', (req, res) => { /* ... */ });
```

---

## 11. Contact et questions

Pour toute question concernant cette politique :
- Consulter `CONTRIBUTING.md` pour conventions générales
- Ouvrir une issue avec le label `[AUDIT] Authentication Policy`
- Référencer ce document dans les PRs de refactoring

---

**Dernière mise à jour** : 2026-06-01  
**Auteur** : GitHub Copilot Audit  
**Applicabilité** : Immédiate pour toute nouvelle mutation
