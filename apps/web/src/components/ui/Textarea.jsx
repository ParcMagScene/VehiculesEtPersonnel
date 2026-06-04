import './Textarea.css';

import { forwardRef } from 'react';

import { warnBareOnce } from './_warnBareOnce';

/**
 * Textarea — Composant atomique Design System
 *
 * Tailles  : sm | md | lg  (optionnel — sans size, style minimal)
 * États    : error, disabled
 *
 * Mode bare : sans size → rend un <textarea> nu (compatible CSS existant)
 * Mode styled : avec size → applique les styles DS complets
 *
 * ⚠️ Sans `size`, le style est minimal. Préférez explicitement `size="sm|md|lg"`.
 */
const Textarea = forwardRef(({ size, error = false, className = '', ...props }, ref) => {
  if (import.meta.env?.DEV && size === undefined) {
    warnBareOnce('Textarea');
  }
  const classes = [
    'ui-textarea',
    size && `ui-textarea--${size}`,
    error && 'ui-textarea--error',
    props.disabled && 'ui-textarea--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <textarea ref={ref} className={classes} aria-invalid={error || undefined} {...props} />;
});

Textarea.displayName = 'Textarea';

export default Textarea;
