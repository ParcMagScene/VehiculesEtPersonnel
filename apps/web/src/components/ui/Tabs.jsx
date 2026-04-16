import { useState, useId, createContext, useContext } from 'react';

const TabsContext = createContext(null);

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
export function Tabs({ defaultValue, value: controlledValue, onChange, children, className = '' }) {
  const [internal, setInternal] = useState(defaultValue);
  const current = controlledValue !== undefined ? controlledValue : internal;
  const handleChange = (val) => {
    if (controlledValue === undefined) setInternal(val);
    onChange?.(val);
  };

  return (
    <TabsContext.Provider value={{ active: current, onChange: handleChange }}>
      <div className={`ui-tabs ${className}`} data-active={current}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function useTabsContext() {
  return useContext(TabsContext);
}

/**
 * TabList — Conteneur des onglets
 */
export function TabList({ children, className = '' }) {
  return (
    <div className={`ui-tab-list ${className}`} role="tablist">
      {children}
    </div>
  );
}

/**
 * Tab — Bouton onglet individuel
 */
export function Tab({ value, icon, badge, disabled = false, children, className = '' }) {
  const id = useId();
  const ctx = useTabsContext();
  const isActive = ctx?.active === value;

  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      className={`ui-tab ${isActive ? 'ui-tab--active' : ''} ${disabled ? 'ui-tab--disabled' : ''} ${className}`}
      disabled={disabled}
      onClick={() => ctx?.onChange?.(value)}
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
export function TabPanel({ value, children, className = '' }) {
  const ctx = useTabsContext();
  if (ctx?.active !== value) return null;

  return (
    <div role="tabpanel" className={`ui-tab-panel ${className}`}>
      {children}
    </div>
  );
}
