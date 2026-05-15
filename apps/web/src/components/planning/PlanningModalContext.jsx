import { createContext, useCallback, useContext, useState } from 'react';

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

  return (
    <PlanningModalContext.Provider value={{ modal, openModal, closeModal }}>
      {children}
    </PlanningModalContext.Provider>
  );
}

export function usePlanningModal() {
  return useContext(PlanningModalContext);
}
