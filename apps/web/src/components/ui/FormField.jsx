import './ui.css';

import { Children, cloneElement, isValidElement, useId } from 'react';

/**
 * FormField — Champ de formulaire avec label, hint, erreur
 *
 * @param {string}  label      Label du champ
 * @param {string}  htmlFor    ID de l'input associé
 * @param {boolean} required   Affiche l'astérisque
 * @param {boolean} horizontal Layout horizontal (label à gauche)
 * @param {string}  hint       Texte d'aide sous l'input
 * @param {string}  error      Message d'erreur
 * @param {string}  className  Classes additionnelles
 *
 * Accessibilité :
 * - hint et erreur reçoivent un id stable, et le premier enfant input/select/textarea
 *   reçoit automatiquement `aria-describedby` les pointant + `aria-invalid` si erreur.
 * - Le premier enfant éligible reçoit aussi un `id` (s'il n'en a pas) et le `<label>`
 *   est lié via `htmlFor` — adoption sans avoir à gérer les ids manuellement.
 * - Sans casser les overrides : si l'enfant a déjà ses propres aria-* ou id, ils gagnent.
 */
function FormField({
  label,
  htmlFor,
  required = false,
  horizontal = false,
  hint,
  error,
  className = '',
  children,
  ...rest
}) {
  const cls = ['ui-form-field', horizontal && 'ui-form-field--horizontal', className]
    .filter(Boolean)
    .join(' ');

  const reactId = useId();
  const baseId = htmlFor || reactId;
  const errorId = error ? `${baseId}-error` : null;
  const hintId = hint && !error ? `${baseId}-hint` : null;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || null;

  // Clone le premier enfant éligible pour lui injecter id, aria-describedby, aria-invalid.
  let injected = false;
  const enhancedChildren = Children.map(children, (child) => {
    if (injected || !isValidElement(child)) return child;
    injected = true;
    const next = {};
    if (!child.props.id) {
      next.id = baseId;
    }
    if (describedBy && !child.props['aria-describedby']) {
      next['aria-describedby'] = describedBy;
    }
    if (error && child.props['aria-invalid'] === undefined) {
      next['aria-invalid'] = true;
    }
    return Object.keys(next).length ? cloneElement(child, next) : child;
  });

  return (
    <div className={cls} {...rest}>
      {label && (
        <label
          className={`ui-form-label${required ? ' ui-form-label--required' : ''}`}
          htmlFor={baseId}
        >
          {label}
        </label>
      )}
      {enhancedChildren}
      {error && (
        <span className="ui-form-error" id={errorId} role="alert">
          {error}
        </span>
      )}
      {hint && !error && (
        <span className="ui-form-hint" id={hintId}>
          {hint}
        </span>
      )}
    </div>
  );
}

export default FormField;
