import './ui.css';

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

  return (
    <div className={cls} {...rest}>
      {label && (
        <label
          className={`ui-form-label${required ? ' ui-form-label--required' : ''}`}
          htmlFor={htmlFor}
        >
          {label}
        </label>
      )}
      {children}
      {error && <span className="ui-form-error">{error}</span>}
      {hint && !error && <span className="ui-form-hint">{hint}</span>}
    </div>
  );
}

export default FormField;
