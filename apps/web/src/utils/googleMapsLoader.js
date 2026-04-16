/**
 * Utilitaire centralisé pour charger l'API Google Maps une seule fois
 * Évite les chargements multiples qui causent des erreurs
 */

let isLoading = false;
let isLoaded = false;
const loadPromises = [];

/**
 * Charge l'API Google Maps de manière unique et asynchrone
 * @param {string} apiKey - La clé API Google Maps
 * @returns {Promise<void>} Promise qui se résout quand l'API est chargée
 */
export const loadGoogleMapsAPI = (apiKey) => {
  // Si déjà chargé, retourner immédiatement
  if (isLoaded && window.google?.maps) {
    return Promise.resolve();
  }

  // Si en cours de chargement, attendre la promesse existante
  if (isLoading) {
    return new Promise((resolve, reject) => {
      loadPromises.push({ resolve, reject });
    });
  }

  // Vérifier si le script existe déjà dans le DOM
  const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
  if (existingScript) {
    if (window.google?.maps) {
      isLoaded = true;
      return Promise.resolve();
    }
    // Le script existe mais l'API n'est pas disponible — le script a peut-être échoué.
    // Supprimer l'ancien script pour permettre un nouveau chargement propre.
    existingScript.remove();
  }

  // Commencer le chargement
  isLoading = true;

  return new Promise((resolve, reject) => {
    try {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=fr&loading=async`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        // Attendre que l'API soit complètement initialisée
        const checkApiReady = () => {
          if (window.google?.maps?.Map && window.google?.maps?.places) {
            isLoaded = true;
            isLoading = false;

            // Résoudre toutes les promesses en attente
            loadPromises.forEach(({ resolve: res }) => res());
            loadPromises.length = 0;

            resolve();
          } else {
            // Réessayer après un court délai
            setTimeout(checkApiReady, 50);
          }
        };

        checkApiReady();
      };

      script.onerror = (error) => {
        isLoading = false;

        // Supprimer le script échoué du DOM pour permettre un retry propre
        script.remove();

        // Rejeter toutes les promesses en attente
        loadPromises.forEach(({ reject: rej }) => rej(error));
        loadPromises.length = 0;

        reject(error);
      };

      document.head.appendChild(script);
    } catch (error) {
      isLoading = false;
      reject(error);
    }
  });
};

/**
 * Vérifie si l'API Google Maps est chargée
 * @returns {boolean}
 */
export const isGoogleMapsLoaded = () => {
  return (
    isLoaded && window.google?.maps?.Map !== undefined && window.google?.maps?.places !== undefined
  );
};

/**
 * Attend que l'API Google Maps soit chargée
 * @param {number} timeout - Timeout en ms (défaut: 10000)
 * @returns {Promise<void>}
 */
export const waitForGoogleMaps = (timeout = 10000) => {
  if (isGoogleMapsLoaded()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkInterval = setInterval(() => {
      if (isGoogleMapsLoaded()) {
        clearInterval(checkInterval);
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for Google Maps API'));
      }
    }, 100);
  });
};
