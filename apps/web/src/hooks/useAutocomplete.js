import { useState, useEffect } from 'react';

/**
 * Hook pour gérer l'autocomplétion basée sur l'historique
 * @param {string} key - Clé pour localStorage
 * @param {number} maxSuggestions - Nombre max de suggestions à garder
 */
export const useAutocomplete = (key, maxSuggestions = 20) => {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    // Charger les suggestions depuis localStorage
    const stored = localStorage.getItem(`autocomplete_${key}`);
    if (stored) {
      try {
        setSuggestions(JSON.parse(stored));
      } catch (e) {
        console.error('Erreur chargement suggestions:', e);
      }
    }
  }, [key]);

  const addToHistory = (value) => {
    if (!value || !value.trim()) return;
    
    const trimmed = value.trim();
    const newSuggestions = [
      trimmed,
      ...suggestions.filter(s => s !== trimmed)
    ].slice(0, maxSuggestions);
    
    setSuggestions(newSuggestions);
    localStorage.setItem(`autocomplete_${key}`, JSON.stringify(newSuggestions));
  };

  const clearHistory = () => {
    setSuggestions([]);
    localStorage.removeItem(`autocomplete_${key}`);
  };

  return { suggestions, addToHistory, clearHistory };
};
