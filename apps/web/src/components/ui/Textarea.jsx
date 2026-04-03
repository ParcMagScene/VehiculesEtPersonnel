import { forwardRef } from 'react';
import './Textarea.css';

/**
 * Textarea — Composant atomique Design System
 *
 * Tailles  : sm | md | lg  (optionnel — sans size, style minimal)
 * États    : error, disabled
 *
 * Mode bare : sans size → rend un <textarea> nu (compatible CSS existant)
 * Mode styled : avec size → applique les styles DS complets
 */
const Textarea = forwardRef(({
  size,
  error = false,
  className = '',
  ...props
}, ref) => {
  const classes = [
    'ui-textarea',
    size && `ui-textarea--${size}`,
    error && 'ui-textarea--error',
    props.disabled && 'ui-textarea--disabled',
    className
  ].filter(Boolean).join(' ');

  return (
    <textarea
      ref={ref}
      className={classes}
      aria-invalid={error || undefined}
      {...props}
    />
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;
