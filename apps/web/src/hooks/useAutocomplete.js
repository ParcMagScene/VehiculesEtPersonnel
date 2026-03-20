import { useState } from 'react';

/**
 * Hook pour gérer l'autocomplétion basée sur l'historique
 * @param {string} key - Clé pour localStorage
 * @param {number} maxSuggestions - Nombre max de suggestions à garder
 */
export const useAutocomplete = (key, maxSuggestions = 20) => {
  const [suggestions, setSuggestions] = useState(() => {
    try {
      const stored = localStorage.getItem(`autocomplete_${key}`);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

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
