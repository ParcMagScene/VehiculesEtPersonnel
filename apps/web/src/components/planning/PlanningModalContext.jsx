import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Contexte centralisé pour la gestion des modals de planning
const PlanningModalContext = createContext();

export function PlanningModalProvider({ children }) {
  // Un seul modal actif à la fois, on stocke son type et ses props
  const [modal, setModal] = useState(null); // { type: string, props: object }

  // Ouvre un modal (ferme tous les autres)
  const openModal = useCallback((type, props = {}) => {
    setModal({ type, props });
  }, []);

  // Ferme le modal courant
  const closeModal = useCallback(() => {
    setModal(null);
  }, []);

  // [PERF Phase 4.G] Mémoïser la value pour éviter de re-render tous les
  // subscribers à chaque render du Provider parent.
  const value = useMemo(() => ({ modal, openModal, closeModal }), [modal, openModal, closeModal]);

  return <PlanningModalContext.Provider value={value}>{children}</PlanningModalContext.Provider>;
}

export function usePlanningModal() {
  return useContext(PlanningModalContext);
}
