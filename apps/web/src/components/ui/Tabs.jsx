import { useState, useId, Children, cloneElement, isValidElement } from 'react';

/**
 * Tabs — Navigation par onglets
 *
 * Usage :
 *   <Tabs defaultValue="general">
 *     <TabList>
 *       <Tab value="general" icon={<Settings size={16}/>}>Général</Tab>
 *       <Tab value="avance">Avancé</Tab>
 *     </TabList>
 *     <TabPanel value="general">Contenu général…</TabPanel>
 *     <TabPanel value="avance">Contenu avancé…</TabPanel>
 *   </Tabs>
 */
export function Tabs({
  defaultValue,
  value: controlledValue,
  onChange,
  children,
  className = '',
}) {
  const [internal, setInternal] = useState(defaultValue);
  const current = controlledValue !== undefined ? controlledValue : internal;
  const handleChange = (val) => {
    if (controlledValue === undefined) setInternal(val);
    onChange?.(val);
  };

  return (
    <div className={`ui-tabs ${className}`} data-active={current}>
      {Children.map(children, child => {
        if (!isValidElement(child)) return child;
        return cloneElement(child, { _active: current, _onChange: handleChange });
      })}
    </div>
  );
}

/**
 * TabList — Conteneur des onglets
 */
export function TabList({ children, _active, _onChange, className = '' }) {
  return (
    <div className={`ui-tab-list ${className}`} role="tablist">
      {Children.map(children, child => {
        if (!isValidElement(child)) return child;
        return cloneElement(child, { _active, _onChange });
      })}
    </div>
  );
}

/**
 * Tab — Bouton onglet individuel
 */
export function Tab({
  value,
  icon,
  badge,
  disabled = false,
  children,
  _active,
  _onChange,
  className = '',
}) {
  const id = useId();
  const isActive = _active === value;

  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      className={`ui-tab ${isActive ? 'ui-tab--active' : ''} ${disabled ? 'ui-tab--disabled' : ''} ${className}`}
      disabled={disabled}
      onClick={() => _onChange?.(value)}
    >
      {icon && <span className="ui-tab__icon">{icon}</span>}
      <span>{children}</span>
      {badge != null && <span className="ui-tab__badge">{badge}</span>}
    </button>
  );
}

/**
 * TabPanel — Contenu d'un onglet
 */
export function TabPanel({ value, children, _active, className = '' }) {
  if (_active !== value) return null;

  return (
    <div
      role="tabpanel"
      className={`ui-tab-panel ${className}`}
    >
      {children}
    </div>
  );
}
