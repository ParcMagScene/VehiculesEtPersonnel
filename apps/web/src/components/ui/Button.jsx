import { Loader } from 'lucide-react';
import { forwardRef } from 'react';

/**
 * Button — Composant atomique Design System
 *
 * Variantes : primary | secondary | danger | success | ghost
 * Tailles   : sm | md
 * Modes     : icon-only, loading, disabled
 *
 * Note: les variants `warning` et tailles `xs`/`lg` ont ete retires (B18)
 * faute d'usage. Reintroduire si un cas legitime apparait.
 */
const Button = forwardRef(
  (
    {
      variant = 'primary',
      size = 'md',
      iconOnly = false,
      loading = false,
      disabled = false,
      children,
      className = '',
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const classes = [
      'ui-btn',
      `ui-btn--${variant}`,
      `ui-btn--${size}`,
      iconOnly && 'ui-btn--icon-only',
      loading && 'ui-btn--loading',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-label={iconOnly && !props['aria-label'] ? props.title : props['aria-label']}
        {...props}
      >
        {loading && (
          <Loader size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} className="ui-btn__spinner" />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
