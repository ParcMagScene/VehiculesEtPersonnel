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
 */
const Input = forwardRef(
  ({ size, error = false, prefix, suffix, className = '', ...props }, ref) => {
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
