import { ChevronDown } from 'lucide-react';
import { forwardRef } from 'react';

/**
 * Select — Composant atomique Design System
 *
 * Tailles  : sm | md | lg  (optionnel — sans size, style minimal)
 * États    : error, disabled, fullWidth
 * Props    : options (array), placeholder, children
 *
 * Mode bare     : avec children → rend un <select> nu (pas de wrapper)
 * Mode options  : avec options prop → wrapper div + chevron
 */
const Select = forwardRef(
  (
    {
      size,
      error = false,
      fullWidth = false,
      options,
      placeholder,
      children,
      className = '',
      ...props
    },
    ref,
  ) => {
    /* ─── Mode bare (children pass-through) ─── */
    if (children) {
      const classes = [
        'ui-select',
        size && `ui-select--${size}`,
        error && 'ui-select--error',
        fullWidth && 'ui-select--full',
        props.disabled && 'ui-select--disabled',
        className,
      ]
        .filter(Boolean)
        .join(' ');

      return (
        <select ref={ref} className={classes} aria-invalid={error || undefined} {...props}>
          {children}
        </select>
      );
    }

    /* ─── Mode options (wrapper + chevron) ─── */
    const wrapperClasses = [
      'ui-select-wrapper',
      `ui-select-wrapper--${size || 'md'}`,
      error && 'ui-select-wrapper--error',
      props.disabled && 'ui-select-wrapper--disabled',
      fullWidth && 'ui-select-wrapper--full',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={wrapperClasses}>
        <select ref={ref} className="ui-select" aria-invalid={error || undefined} {...props}>
          {placeholder && <option value="">{placeholder}</option>}
          {(options || []).map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="ui-select-chevron" aria-hidden="true">
          <ChevronDown size={16} />
        </span>
      </div>
    );
  },
);

Select.displayName = 'Select';

export default Select;
