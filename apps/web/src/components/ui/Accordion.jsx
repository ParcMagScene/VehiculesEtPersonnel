import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

/**
 * Accordion — Section dépliable
 *
 * Usage :
 *   <Accordion title="Détails" icon={<Info size={16}/>} defaultOpen>
 *     <p>Contenu dépliable…</p>
 *   </Accordion>
 */
export default function Accordion({
  title,
  icon,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  children,
  className = '',
}) {
  const [internal, setInternal] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internal;
  const id = useId();

  const toggle = () => {
    if (controlledOpen === undefined) setInternal((o) => !o);
    onToggle?.(!isOpen);
  };

  return (
    <div className={`ui-accordion ${isOpen ? 'ui-accordion--open' : ''} ${className}`}>
      <button
        type="button"
        className="ui-accordion__trigger"
        aria-expanded={isOpen}
        aria-controls={`acc-${id}`}
        onClick={toggle}
      >
        {icon && <span className="ui-accordion__icon">{icon}</span>}
        <span className="ui-accordion__title">{title}</span>
        <ChevronDown size={16} className="ui-accordion__chevron" />
      </button>
      {isOpen && (
        <div id={`acc-${id}`} className="ui-accordion__content" role="region">
          {children}
        </div>
      )}
    </div>
  );
}
