import { useId } from 'react';

/**
 * Checkbox — Composant atomique Design System
 *
 * Mode complet (label fourni) :
 *   <Checkbox checked={v} onChange={fn} label="Activer" />
 *   → rend un <label> autonome avec checkbox custom + texte.
 *
 * Mode bare (pas de label) :
 *   <label className="my-class"><Checkbox checked={v} onChange={fn} /> Mon texte</label>
 *   → rend un <span> (pas de <label>) pour s'imbriquer dans un label existant.
 */
export function Checkbox({
  checked = false,
  onChange,
  label,
  disabled = false,
  indeterminate = false,
  className = '',
  ...props
}) {
  const id = useId();
  const Wrapper = label ? 'label' : 'span';

  const cls = ['ui-checkbox', disabled && 'ui-checkbox--disabled', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Wrapper className={cls} {...(label ? { htmlFor: id } : {})}>
      <input
        id={id}
        type="checkbox"
        className="ui-checkbox__input"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        aria-checked={indeterminate ? 'mixed' : checked}
        {...props}
      />
      <span className="ui-checkbox__box" aria-hidden="true">
        {indeterminate ? (
          <svg width="10" height="2" viewBox="0 0 10 2">
            <rect width="10" height="2" rx="1" fill="currentColor" />
          </svg>
        ) : checked ? (
          <svg width="10" height="8" viewBox="0 0 10 8">
            <path
              d="M1 4l3 3 5-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      {label && <span className="ui-checkbox__label">{label}</span>}
    </Wrapper>
  );
}

/**
 * Toggle — Composant atomique Design System (switch)
 *
 * Mode complet (label fourni) :
 *   <Toggle checked={v} onChange={fn} label="Notifications" />
 *
 * Mode bare (pas de label) :
 *   <label className="my-toggle"><Toggle checked={v} onChange={fn} /> Activer</label>
 */
export function Toggle({
  checked = false,
  onChange,
  label,
  disabled = false,
  size = 'md',
  className = '',
  ...props
}) {
  const id = useId();
  const Wrapper = label ? 'label' : 'span';

  const cls = ['ui-toggle', `ui-toggle--${size}`, disabled && 'ui-toggle--disabled', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Wrapper className={cls} {...(label ? { htmlFor: id } : {})}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="ui-toggle__input"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-checked={checked}
        {...props}
      />
      <span className="ui-toggle__track" aria-hidden="true">
        <span className="ui-toggle__thumb" />
      </span>
      {label && <span className="ui-toggle__label">{label}</span>}
    </Wrapper>
  );
}
