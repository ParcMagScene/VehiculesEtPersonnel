// Middleware de validation Zod unifié
// Usage :
//   router.post('/users', validate({ body: userSchema }), handler)
//   router.get('/list', validate({ query: listQuerySchema }), handler)
//
// Supporte body, query, params (n'importe quelle combinaison).
// En cas d'échec : 400 + { success: false, error, details, code }.
// Les données validées remplacent req.body / req.query / req.params.

import { AppError } from './errorHandler.js';

function formatIssues(error) {
  const issues = Array.isArray(error?.issues)
    ? error.issues
    : Array.isArray(error?.errors)
      ? error.errors
      : [];
  return issues.map((e) => ({
    path: Array.isArray(e.path) ? e.path.join('.') : '',
    message: e.message,
    code: e.code,
  }));
}

export function validate(schemas) {
  // Compat ascendante : si on passe un schéma seul → assimilé à { body }
  const config =
    schemas && typeof schemas === 'object' && (schemas.body || schemas.query || schemas.params)
      ? schemas
      : { body: schemas };

  return (req, _res, next) => {
    try {
      if (config.body) {
        const r = config.body.safeParse(req.body);
        if (!r.success) {
          return next(
            new AppError(
              'Corps de requête invalide',
              400,
              'VALIDATION_ERROR',
              formatIssues(r.error),
            ),
          );
        }
        req.body = r.data;
      }
      if (config.query) {
        const r = config.query.safeParse(req.query);
        if (!r.success) {
          return next(
            new AppError(
              'Paramètres de requête invalides',
              400,
              'VALIDATION_ERROR',
              formatIssues(r.error),
            ),
          );
        }
        // Note : Express ne permet pas toujours de réassigner req.query — on copie en place
        for (const key of Object.keys(req.query)) delete req.query[key];
        Object.assign(req.query, r.data);
      }
      if (config.params) {
        const r = config.params.safeParse(req.params);
        if (!r.success) {
          return next(
            new AppError(
              "Paramètres d'URL invalides",
              400,
              'VALIDATION_ERROR',
              formatIssues(r.error),
            ),
          );
        }
        Object.assign(req.params, r.data);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export default validate;
