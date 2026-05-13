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
        // En mode `loading=async`, les sous-modules (Map, places, marker, …) ne
        // sont PAS exposés sur `window.google.maps` tant que l'on n'a pas appelé
        // `importLibrary`. Sans ça, `checkApiReady` ci-dessous boucle indéfiniment
        // et le LocationDialog finit par afficher « Impossible de charger Google
        // Maps ». On précharge donc les bibliothèques requises avant de résoudre.
        const ensureLibraries = async () => {
          if (!window.google?.maps?.importLibrary) return;
          await Promise.all([
            window.google.maps.importLibrary('maps'),
            window.google.maps.importLibrary('places'),
            window.google.maps.importLibrary('marker').catch(() => null),
          ]);
        };

        ensureLibraries()
          .catch((err) => {
            // On n'interrompt pas : checkApiReady détectera l'échec final.
            console.warn('[googleMapsLoader] importLibrary partiel:', err?.message);
          })
          .finally(() => {
            // Attendre que l'API soit complètement initialisée
            const startedAt = Date.now();
            const checkApiReady = () => {
              if (window.google?.maps?.Map && window.google?.maps?.places) {
                isLoaded = true;
                isLoading = false;

                // Résoudre toutes les promesses en attente
                loadPromises.forEach(({ resolve: res }) => res());
                loadPromises.length = 0;

                resolve();
              } else if (Date.now() - startedAt > 10000) {
                isLoading = false;
                const err = new Error(
                  "Google Maps API: timeout d'initialisation (Map ou places indisponibles)",
                );
                loadPromises.forEach(({ reject: rej }) => rej(err));
                loadPromises.length = 0;
                reject(err);
              } else {
                setTimeout(checkApiReady, 50);
              }
            };

            checkApiReady();
          });
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
