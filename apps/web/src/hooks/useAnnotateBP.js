import { useState, useCallback } from 'react';
import api from '../utils/api';
import { annotateBPItems, formatAffaireInfoBlock } from '../utils/bpAnnotationEngine';

/**
 * Hook pour annoter un BP d'affaire :
 * charge les données (items, réservations, personnel, tâches),
 * exécute l'algo d'annotation, fournit les résultats au composant.
 */
export function useAnnotateBP({ toast }) {
  const [isLoading, setIsLoading] = useState(false);
  const [annotationResult, setAnnotationResult] = useState(null);
  const [error, setError] = useState(null);

  const annotate = useCallback(
    async (affaireId, blImportId) => {
      setIsLoading(true);
      setError(null);
      setAnnotationResult(null);
      try {
        // 1. Récupérer les données agrégées depuis le backend
        const data = await api.getAnnotationData(affaireId, blImportId);

        // 2. Annoter les items BP (familles, couleurs, kits)
        const { annotatedItems, kits, sections, stats } = annotateBPItems(data.bpItems || []);

        // 3. Formater le bloc infos affaire
        const infoLines = formatAffaireInfoBlock(data);

        const result = {
          affaire: data.affaire,
          blImport: data.blImport,
          annotatedItems,
          kits,
          sections,
          stats,
          infoLines,
          reservations: data.reservations || [],
          personnel: data.personnel || [],
          tasks: data.tasks || [],
        };

        setAnnotationResult(result);
        return result;
      } catch (err) {
        const msg = err?.message || 'Erreur annotation BP';
        setError(msg);
        toast?.error?.(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  const reset = useCallback(() => {
    setAnnotationResult(null);
    setError(null);
  }, []);

  return { annotate, reset, annotationResult, isLoading, error };
}
