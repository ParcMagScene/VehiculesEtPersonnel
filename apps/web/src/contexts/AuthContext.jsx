import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import api from '../utils/api';
import { requestNotificationPermission, setVolume } from '../utils/notificationSound';

const AuthContext = createContext(null);

const VALID_TABS = [
  'vehicles',
  'personnel',
  'affaires',
  'equipment',
  'orders',
  'catalog',
  'stock',
  'planning',
];

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [tabPrefs, setTabPrefs] = useState({ tabOrder: null, hiddenTabs: [] });
  const userPrefsRef = useRef({ notificationsEnabled: true, soundEnabled: true });

  // Vérifier l'authentification au démarrage — attend la récupération async (IDB / refresh)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Attendre que la récupération auth (IDB + refresh silencieux) soit terminée
      await api.waitReady();
      if (cancelled) return;
      if (api.isAuthenticated()) {
        setIsAuthenticated(true);
        setCurrentUser(api.getCurrentUser());
      }
      setIsAuthLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyTabPrefs = useCallback((prefs) => {
    let tabOrder = (prefs.tabOrder || VALID_TABS).filter((id) => VALID_TABS.includes(id));
    VALID_TABS.forEach((id) => {
      if (!tabOrder.includes(id)) tabOrder.push(id);
    });
    const hiddenTabs = (prefs.hiddenTabs || []).filter((id) => VALID_TABS.includes(id));
    setTabPrefs({ tabOrder, hiddenTabs });
  }, []);

  // Login : retourne { user, prefs } pour que App.jsx puisse appliquer les prefs UI
  const login = useCallback(
    async (email, password) => {
      const result = await api.login(email, password);
      setIsAuthenticated(true);
      setCurrentUser(result.user);

      let prefs = {};
      try {
        prefs = await api.getPreferences();
        userPrefsRef.current = {
          notificationsEnabled: prefs.notificationsEnabled !== false,
          soundEnabled: prefs.soundEnabled !== false,
        };
        setVolume((prefs.soundVolume ?? 70) / 100);
        applyTabPrefs(prefs);
        if (prefs.notificationsEnabled !== false) {
          requestNotificationPermission();
        }
      } catch (e) {
        /* silencieux */
      }

      return { ...result, prefs };
    },
    [applyTabPrefs],
  );

  const logout = useCallback(async () => {
    await api.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
  }, []);

  const loginPin = useCallback(
    async (email, pin) => {
      const result = await api.loginPin(email, pin);
      setIsAuthenticated(true);
      setCurrentUser(result.user);

      let prefs = {};
      try {
        prefs = await api.getPreferences();
        userPrefsRef.current = {
          notificationsEnabled: prefs.notificationsEnabled !== false,
          soundEnabled: prefs.soundEnabled !== false,
        };
        setVolume((prefs.soundVolume ?? 70) / 100);
        applyTabPrefs(prefs);
        if (prefs.notificationsEnabled !== false) {
          requestNotificationPermission();
        }
      } catch (e) {
        /* silencieux */
      }

      return { ...result, prefs };
    },
    [applyTabPrefs],
  );

  const updateUser = useCallback((updatedUser) => {
    setCurrentUser(updatedUser);
    api.user = updatedUser;
    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
  }, []);

  // Mise à jour des préférences depuis UserPreferencesModal
  const updatePreferences = useCallback(
    (prefs) => {
      userPrefsRef.current = {
        notificationsEnabled: prefs.notificationsEnabled !== false,
        soundEnabled: prefs.soundEnabled !== false,
      };
      setVolume((prefs.soundVolume ?? 70) / 100);
      applyTabPrefs(prefs);
      if (prefs.notificationsEnabled !== false) {
        requestNotificationPermission();
      }
    },
    [applyTabPrefs],
  );

  const value = useMemo(
    () => ({
      isAuthenticated,
      currentUser,
      isAuthLoading,
      login,
      loginPin,
      logout,
      updateUser,
      tabPrefs,
      userPrefsRef,
      updatePreferences,
    }),
    [
      isAuthenticated,
      currentUser,
      isAuthLoading,
      login,
      loginPin,
      logout,
      updateUser,
      tabPrefs,
      updatePreferences,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
