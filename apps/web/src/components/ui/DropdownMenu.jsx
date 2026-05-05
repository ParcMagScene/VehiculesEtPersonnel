import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * DropdownMenu — Menu déroulant positionné
 *
 * Usage :
 *   <DropdownMenu trigger={<Button variant="ghost" iconOnly><MoreVertical size={16}/></Button>}>
 *     <DropdownItem icon={<Edit size={14}/>} onClick={edit}>Modifier</DropdownItem>
 *     <DropdownDivider />
 *     <DropdownItem icon={<Trash size={14}/>} danger onClick={del}>Supprimer</DropdownItem>
 *   </DropdownMenu>
 */
export function DropdownMenu({ trigger, align = 'end', children, className = '' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const top = rect.bottom + 4;
    const left = align === 'end' ? rect.right : rect.left;
    setPos({ top, left });
  }, [align]);

  const toggle = useCallback(() => {
    if (!open) updatePosition();
    setOpen((o) => !o);
  }, [open, updatePosition]);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  return (
    <>
      <span
        ref={triggerRef}
        className="ui-dropdown-trigger"
        onClick={toggle}
        role="button"
        tabIndex={0}
        aria-haspopup="true"
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
      >
        {trigger}
      </span>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={`ui-dropdown-menu ${className}`}
            role="menu"
            style={{
              position: 'fixed',
              top: `${pos.top}px`,
              ...(align === 'end'
                ? { right: `${window.innerWidth - pos.left}px` }
                : { left: `${pos.left}px` }),
            }}
            onClick={close}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * DropdownItem — Élément du menu
 */
export function DropdownItem({
  icon,
  danger = false,
  disabled = false,
  children,
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      className={`ui-dropdown-item ${danger ? 'ui-dropdown-item--danger' : ''} ${disabled ? 'ui-dropdown-item--disabled' : ''} ${className}`}
      role="menuitem"
      disabled={disabled}
      {...props}
    >
      {icon && <span className="ui-dropdown-item__icon">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

/**
 * DropdownDivider — Séparateur visuel
 */
export function DropdownDivider() {
  return <div className="ui-dropdown-divider" role="separator" />;
}
