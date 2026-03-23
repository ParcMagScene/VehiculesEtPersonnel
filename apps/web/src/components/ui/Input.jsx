import { forwardRef } from 'react';

/**
 * Input — Composant atomique Design System
 *
 * Tailles  : sm | md | lg
 * États    : error, disabled
 * Slots    : prefix (icône gauche), suffix (icône droite)
 */
const Input = forwardRef(({
  size = 'md',
  error = false,
  prefix,
  suffix,
  className = '',
  ...props
}, ref) => {
  const wrapperClasses = [
    'ui-input-wrapper',
    `ui-input-wrapper--${size}`,
    error && 'ui-input-wrapper--error',
    props.disabled && 'ui-input-wrapper--disabled',
    prefix && 'ui-input-wrapper--has-prefix',
    suffix && 'ui-input-wrapper--has-suffix',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses}>
      {prefix && <span className="ui-input__prefix">{prefix}</span>}
      <input
        ref={ref}
        className="ui-input"
        aria-invalid={error || undefined}
        {...props}
      />
      {suffix && <span className="ui-input__suffix">{suffix}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
