// Gestion de la base de données IndexedDB

const DB_NAME = 'ReservationVehicules';
const DB_VERSION = 7;
const STORES = {
  vehicles: 'vehicles',
  reservations: 'reservations',
  clients: 'clients',
  drivers: 'drivers',
  locations: 'locations',
  calendarConfig: 'calendarConfig',
  garages: 'garages',
  maintenances: 'maintenances',
  affaires: 'affaires',
  persons: 'persons',
  skills: 'skills',
  missions: 'missions',
  inventoryLocations: 'inventoryLocations',
  inventoryAlerts: 'inventoryAlerts',
  inventoryAnomalies: 'inventoryAnomalies',
  inventoryPendingCounts: 'inventoryPendingCounts',
  auth: 'auth',
};

// Ouvrir ou créer la base de données
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Créer les object stores si ils n'existent pas
      Object.values(STORES).forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
        }
      });
    };
  });
};

// Sauvegarder des données
export const saveToIndexedDB = async (storeName, data) => {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    // Vider le store avant d'ajouter les nouvelles données
    await new Promise((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });
    
    // Ajouter toutes les données après le clear
    if (Array.isArray(data)) {
      for (const item of data) {
        // Vérifier que l'objet a un ID valide avant de le sauvegarder
        if (item && (item.id !== undefined && item.id !== null)) {
          store.put(item);
        } else {
          console.warn('⚠️ IndexedDB: Objet sans ID ignoré dans', storeName, ':', item);
        }
      }
    } else if (data && typeof data === 'object') {
      // Pour les objets simples comme calendarConfig
      store.put({ ...data, id: 1 });
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error('Transaction error'));
      };
      transaction.onabort = () => {
        db.close();
        reject(new Error('Transaction aborted'));
      };
    });
  } catch (error) {
    console.error(`Erreur lors de la sauvegarde dans ${storeName}:`, error);
    throw error;
  }
};

// Charger des données
export const loadFromIndexedDB = async (storeName, defaultValue = []) => {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        const result = request.result;
        
        // Si c'est un objet unique (comme calendarConfig), retourner le premier élément
        if (storeName === STORES.calendarConfig && result && result.length > 0) {
          const { id: _id, ...config } = result[0];
          resolve(config);
          return;
        }
        
        resolve(result && result.length > 0 ? result : defaultValue);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error(`Erreur lors du chargement depuis ${storeName}:`, error);
    return defaultValue;
  }
};

// Ajouter un élément
export const addToIndexedDB = async (storeName, item) => {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(item);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error(`Erreur lors de l'ajout dans ${storeName}:`, error);
    throw error;
  }
};

// Mettre à jour un élément
export const updateInIndexedDB = async (storeName, item) => {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error(`Erreur lors de la mise à jour dans ${storeName}:`, error);
    throw error;
  }
};

export { STORES };

// ── Auth persistence (fallback si localStorage vidé) ──

export const saveAuthToIDB = async (user) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.auth, 'readwrite');
    tx.objectStore(STORES.auth).put({ id: 1, user, updatedAt: Date.now() });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch { /* silencieux — fallback non critique */ }
};

export const loadAuthFromIDB = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.auth, 'readonly');
    const request = tx.objectStore(STORES.auth).get(1);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => { db.close(); resolve(request.result?.user || null); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch { return null; }
};

export const clearAuthFromIDB = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.auth, 'readwrite');
    tx.objectStore(STORES.auth).clear();
    return new Promise((resolve) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch { /* silencieux */ }
};
