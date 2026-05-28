import { forwardRef } from 'react';

/**
 * Input — Composant atomique Design System
 *
 * Tailles  : sm | md | lg  (optionnel — sans size, style minimal)
 * États    : error, disabled
 * Slots    : prefix (icône gauche), suffix (icône droite)
 *
 * Mode bare  : sans prefix/suffix → rend un <input> nu (pas de wrapper div)
 * Mode slots : avec prefix/suffix → wrapper div inline-flex
 *
 * ⚠️ Sans `size`, le style est minimal (pas de bordure ni focus ring DS).
 *    Préférez explicitement `size="sm|md|lg"` sauf si vous savez ce que vous faites.
 */
const Input = forwardRef(
  ({ size, error = false, prefix, suffix, className = '', ...props }, ref) => {
    if (import.meta.env?.DEV && size === undefined && !prefix && !suffix) {
      // eslint-disable-next-line no-console
      console.warn(
        '[DS][Input] Composant rendu en mode bare (sans `size`). Ajoutez size="sm|md|lg" pour obtenir le style DS complet.',
      );
    }
    /* ─── Mode bare (pas de wrapper) ─── */
    if (!prefix && !suffix) {
      const classes = [
        'ui-input',
        size && `ui-input--${size}`,
        error && 'ui-input--error',
        props.disabled && 'ui-input--disabled',
        className,
      ]
        .filter(Boolean)
        .join(' ');

      return <input ref={ref} className={classes} aria-invalid={error || undefined} {...props} />;
    }

    /* ─── Mode wrapper (prefix / suffix) ─── */
    const wrapperClasses = [
      'ui-input-wrapper',
      `ui-input-wrapper--${size || 'md'}`,
      error && 'ui-input-wrapper--error',
      props.disabled && 'ui-input-wrapper--disabled',
      prefix && 'ui-input-wrapper--has-prefix',
      suffix && 'ui-input-wrapper--has-suffix',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={wrapperClasses}>
        {prefix && <span className="ui-input__prefix">{prefix}</span>}
        <input ref={ref} className="ui-input" aria-invalid={error || undefined} {...props} />
        {suffix && <span className="ui-input__suffix">{suffix}</span>}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
