import './MobileApp.css';

import { LayoutGrid, LogOut, MessageSquare, Monitor, Moon, Sun } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { BottomSheet, Button, Skeleton, Spinner } from '@/design-system';

import { useMessagingSSE } from '../../hooks/useMessagingSSE';
import useMobileRouter from '../../hooks/useMobileRouter';
import useSwipeBack from '../../hooks/useSwipeBack';
import { PALETTES, useTheme } from '../../hooks/useTheme';
import api from '../../utils/api';
import MobileHeader from './MobileHeader';
import MobileHome from './MobileHome';
import MobileLogin from './MobileLogin';
import MobileParcDashboard from './MobileParcDashboard';
import MobileQRLanding from './MobileQRLanding';
import MobileQRRefLanding from './MobileQRRefLanding';

const MobilePlanning = lazy(() => import('./MobilePlanning'));
const MobileAvailability = lazy(() => import('./MobileAvailability'));
const MobileReservations = lazy(() => import('./MobileReservations'));
const MobileMaintenances = lazy(() => import('./MobileMaintenances'));
const MobileAffaires = lazy(() => import('./MobileAffaires'));
const MobileTasks = lazy(() => import('./MobileTasks'));
const MobilePersonnel = lazy(() => import('./MobilePersonnel'));
const MobileMessaging = lazy(() => import('./MobileMessaging'));
const MobileEquipment = lazy(() => import('./MobileEquipment'));
const MobileEquipmentQR = lazy(() => import('./MobileEquipmentQR'));
const MobileOrders = lazy(() => import('./MobileOrders'));
const MobileLeaves = lazy(() => import('./MobileLeaves'));
const MobileInventory = lazy(() => import('./MobileInventory'));
const MobileLocation = lazy(() => import('./MobileLocation'));
const MobileSonos = lazy(() => import('./MobileSonos'));
const MobileSuivi = lazy(() => import('./MobileSuivi'));
const MobileDashboardAdmin = lazy(() => import('./MobileDashboardAdmin'));

function MobileScreenFallback() {
  return (
    <div className="mobile-loading">
      <Spinner size="lg" />
    </div>
  );
}

function MobileApp({ onSwitchToDesktop }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const {
    currentScreen,
    qrUid: routerQrUid,
    qrRef: routerQrRef,
    params: routerParams,
    navigate,
    goBack,
  } = useMobileRouter();
  const setCurrentScreen = navigate; // Bridge — migration progressive
  const [qrEquipmentUid, setQrEquipmentUid] = useState(null);
  const [qrEquipmentRef, setQrEquipmentRef] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [clients, setClients] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [garages, setGarages] = useState([]);
  const [auxLoaded, setAuxLoaded] = useState({
    clients: false,
    drivers: false,
    garages: false,
  });
  const [auxDataLoading, setAuxDataLoading] = useState(false);
  const { theme: _theme, isDark, toggleTheme, palette, setPalette } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const isAdmin = !!currentUser?.isAdmin;
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [msgToast, setMsgToast] = useState(null);

  // Swipe-back : retour à l'écran précédent (goBack fourni par useMobileRouter)
  const { swipeBackProps, swipeProgress } = useSwipeBack(goBack, {
    disabled: currentScreen === 'home',
  });

  // Refs pour contrôler les formulaires
  const reservationFormRef = useRef(null);
  const maintenanceFormRef = useRef(null);
  const msgToastTimerRef = useRef(null);
  const currentScreenRef = useRef('home');

  // SSE messagerie temps réel (fallback polling auto)
  const handleNewMessage = useCallback((msg) => {
    if (currentScreenRef.current !== 'messaging') {
      if (msgToastTimerRef.current) clearTimeout(msgToastTimerRef.current);
      const label =
        msg.type === 'text'
          ? `💬 ${msg.sender_name}: ${msg.content?.substring(0, 50) || ''}`
          : `📎 ${msg.sender_name} a envoyé un fichier`;
      setMsgToast(label);
      msgToastTimerRef.current = setTimeout(() => setMsgToast(null), 6000);
    }
  }, []);

  const { unreadMsgCount } = useMessagingSSE({
    currentUser: isAuthenticated ? currentUser : null,
    onNewMessage: handleNewMessage,
    // eslint-disable-next-line react-hooks/refs
    isMessagingOpen: currentScreenRef.current === 'messaging',
  });

  // Vérifier l'authentification
  useEffect(() => {
    const checkAuth = async () => {
      if (api.isAuthenticated()) {
        const user = api.getCurrentUser();
        setIsAuthenticated(true);
        setCurrentUser(user);
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentScreen('home');
  };

  // Charger les données coeur (utilisées par l'accueil/parc)
  const loadCoreParcData = useCallback(async () => {
    try {
      const [vehiclesData, reservationsData, maintenancesData] = await Promise.all([
        api.getVehicles(),
        api.getReservations(),
        api.getMaintenances(),
      ]);

      setVehicles(vehiclesData.sort((a, b) => (a.order || 0) - (b.order || 0)));
      setReservations(reservationsData);
      setMaintenances(maintenancesData);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      if (error.message.includes('authentification') || error.message.includes('401')) {
        handleLogout();
      }
    }
  }, []);

  // Charger les référentiels à la demande (écrans planning/réservation/maintenance)
  const loadAuxiliaryParcData = useCallback(
    async ({
      includeClients = false,
      includeDrivers = false,
      includeGarages = false,
      force = false,
    } = {}) => {
      const needClients = includeClients && (force || !auxLoaded.clients);
      const needDrivers = includeDrivers && (force || !auxLoaded.drivers);
      const needGarages = includeGarages && (force || !auxLoaded.garages);

      if (!needClients && !needDrivers && !needGarages) return;

      setAuxDataLoading(true);
      try {
        const tasks = [];
        if (needClients) {
          tasks.push(
            api.getClients().then((data) => {
              setClients(data);
            }),
          );
        }
        if (needDrivers) {
          tasks.push(
            api.getDrivers().then((data) => {
              setDrivers(data);
            }),
          );
        }
        if (needGarages) {
          tasks.push(
            api.getGarages().then((data) => {
              setGarages(data);
            }),
          );
        }

        await Promise.all(tasks);

        setAuxLoaded((prev) => ({
          clients: prev.clients || needClients,
          drivers: prev.drivers || needDrivers,
          garages: prev.garages || needGarages,
        }));
      } catch (error) {
        console.error('Erreur lors du chargement des référentiels:', error);
        if (error.message.includes('authentification') || error.message.includes('401')) {
          handleLogout();
        }
      } finally {
        setAuxDataLoading(false);
      }
    },
    [auxLoaded],
  );

  // Refresh complet demandé par certains écrans
  const loadParcData = useCallback(async () => {
    await Promise.all([
      loadCoreParcData(),
      loadAuxiliaryParcData({
        includeClients: true,
        includeDrivers: true,
        includeGarages: true,
        force: true,
      }),
    ]);
  }, [loadCoreParcData, loadAuxiliaryParcData]);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    loadCoreParcData();
  }, [isAuthenticated, isLoading, loadCoreParcData]);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    if (currentScreen === 'planning' || currentScreen === 'reservations') {
      loadAuxiliaryParcData({ includeClients: true, includeDrivers: true });
      return;
    }

    if (currentScreen === 'maintenances') {
      loadAuxiliaryParcData({ includeGarages: true });
    }
  }, [currentScreen, isAuthenticated, isLoading, loadAuxiliaryParcData]);

  // Sync currentScreen ref
  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  // Sync QR UID depuis le router hash
  useEffect(() => {
    if (routerQrUid) setQrEquipmentUid(routerQrUid);
  }, [routerQrUid]);

  // Sync QR Référence depuis le router hash (plaques flight-case)
  useEffect(() => {
    if (routerQrRef) setQrEquipmentRef(routerQrRef);
  }, [routerQrRef]);

  // Polling notifications messages non lus — remplacé par SSE (useMessagingSSE)

  const handleLogin = (user) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
  };

  const handleReservationCreated = (newReservation) => {
    setReservations([...reservations, newReservation]);
    setCurrentScreen('home');
  };

  const handleMaintenanceCreated = (newMaintenance) => {
    setMaintenances([...maintenances, newMaintenance]);
    setCurrentScreen('home');
  };

  const handleCreateReservation = () => {
    reservationFormRef.current?.openForm();
  };

  const handleCreateMaintenance = () => {
    maintenanceFormRef.current?.openForm();
  };

  const planningDepsReady = auxLoaded.clients && auxLoaded.drivers;
  const reservationsDepsReady = auxLoaded.clients && auxLoaded.drivers;
  const maintenancesDepsReady = auxLoaded.garages;

  if (isLoading) {
    return (
      <div className="mobile-app">
        <div className="mobile-loading">
          <Skeleton width="60%" height={28} style={{ marginBottom: 16 }} />
          <Skeleton count={3} width="100%" height={64} gap={12} style={{ borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <MobileLogin onLogin={handleLogin} />;
  }

  // Écran d'atterrissage QR — plein écran, sans header/menu
  if (currentScreen === 'qr-landing' && qrEquipmentUid) {
    return (
      <MobileQRLanding
        uid={qrEquipmentUid}
        onGoToEquipment={() => setCurrentScreen('equipment-qr')}
        onGoHome={() => {
          setQrEquipmentUid(null);
          navigate('home');
        }}
      />
    );
  }

  // Écran d'atterrissage QR par référence — plaques flight-case
  if (currentScreen === 'qr-ref-landing' && qrEquipmentRef) {
    return (
      <MobileQRRefLanding
        reference={qrEquipmentRef}
        onSelectUid={(uid) => {
          setQrEquipmentUid(uid);
          setCurrentScreen('equipment-qr');
        }}
        onGoHome={() => {
          setQrEquipmentRef(null);
          navigate('home');
        }}
      />
    );
  }

  return (
    <div className="mobile-app">
      {/* Header unifié */}
      <MobileHeader
        currentScreen={currentScreen}
        onBack={goBack}
        onHome={() => navigate('home')}
        onMessaging={() => {
          setCurrentScreen('messaging');
          currentScreenRef.current = 'messaging';
        }}
        unreadMsgCount={unreadMsgCount}
        currentUser={currentUser}
        onUserMenu={() => setShowUserMenu(!showUserMenu)}
      />

      {/* User menu bottom-sheet (+ thème + actions) */}
      <BottomSheet open={showUserMenu} onClose={() => setShowUserMenu(false)} title="">
        <div className="mobile-sheet-user">
          <div className="mobile-sheet-avatar">{currentUser?.name?.charAt(0)}</div>
          <div>
            <div className="mobile-sheet-name">{currentUser?.name}</div>
            <div className="mobile-sheet-email">{currentUser?.email}</div>
          </div>
        </div>
        <div className="mobile-sheet-actions">
          {/* Thème */}
          <div className="mobile-sheet-theme">
            <Button variant="ghost" onClick={toggleTheme}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
              {isDark ? 'Mode clair' : 'Mode sombre'}
            </Button>
            <div className="mobile-sheet-palette-grid">
              {PALETTES.map((p) => {
                const colors = isDark ? p.darkColors : p.colors;
                return (
                  <Button
                    type="button"
                    key={p.id}
                    className={`mobile-sheet-palette-btn ${palette === p.id ? 'active' : ''}`}
                    onClick={() => setPalette(p.id)}
                    title={p.name}
                  >
                    <span
                      className="mobile-sheet-palette-dot"
                      style={{
                        background: `linear-gradient(135deg, ${colors.primary} 50%, ${colors.accent} 50%)`,
                      }}
                    />
                  </Button>
                );
              })}
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setShowUserMenu(false);
              window.location.reload();
            }}
          >
            <LayoutGrid size={18} />
            Changer d&apos;utilisateur
          </Button>
          {onSwitchToDesktop && (
            <Button
              variant="ghost"
              onClick={() => {
                setShowUserMenu(false);
                onSwitchToDesktop();
              }}
            >
              <Monitor size={18} />
              Version bureau
            </Button>
          )}
          <Button
            variant="ghost"
            className="danger"
            onClick={() => {
              setShowUserMenu(false);
              handleLogout();
            }}
          >
            <LogOut size={18} />
            Se déconnecter
          </Button>
        </div>
      </BottomSheet>

      {/* Contenu principal */}
      <main className="mobile-content" {...swipeBackProps}>
        {swipeProgress > 0 && (
          <div
            className="swipe-back-indicator"
            style={{
              opacity: swipeProgress,
              transform: `translateX(${swipeProgress * 20 - 20}px)`,
            }}
          >
            ‹
          </div>
        )}
        {currentScreen === 'home' && (
          <MobileHome
            vehicles={vehicles}
            reservations={reservations}
            maintenances={maintenances}
            onNavigate={setCurrentScreen}
            currentUser={currentUser}
          />
        )}

        {currentScreen === 'parc-dashboard' && (
          <MobileParcDashboard
            vehicles={vehicles}
            reservations={reservations}
            maintenances={maintenances}
            onNavigate={setCurrentScreen}
            onBack={() => setCurrentScreen('home')}
            onCreateReservation={handleCreateReservation}
            onCreateMaintenance={handleCreateMaintenance}
          />
        )}

        {currentScreen === 'planning' &&
          (!planningDepsReady || auxDataLoading ? (
            <MobileScreenFallback />
          ) : (
            <Suspense fallback={<MobileScreenFallback />}>
              <MobilePlanning
                vehicles={vehicles}
                reservations={reservations}
                maintenances={maintenances}
                currentDate={new Date()}
                onClose={() => setCurrentScreen('parc-dashboard')}
                clients={clients}
                drivers={drivers}
                onRefresh={loadParcData}
              />
            </Suspense>
          ))}

        {currentScreen === 'availability' && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobileAvailability
              vehicles={vehicles}
              reservations={reservations}
              maintenances={maintenances}
              onClose={() => setCurrentScreen('parc-dashboard')}
              onCreateReservation={(_vehicleId, _date) => {
                setCurrentScreen('reservations');
              }}
            />
          </Suspense>
        )}

        {currentScreen === 'reservations' &&
          (!reservationsDepsReady || auxDataLoading ? (
            <MobileScreenFallback />
          ) : (
            <Suspense fallback={<MobileScreenFallback />}>
              <MobileReservations
                ref={reservationFormRef}
                vehicles={vehicles}
                reservations={reservations}
                clients={clients}
                drivers={drivers}
                currentUser={currentUser}
                onReservationCreated={handleReservationCreated}
                onBack={() => setCurrentScreen('parc-dashboard')}
                onRefresh={loadParcData}
              />
            </Suspense>
          ))}

        {currentScreen === 'maintenances' &&
          (!maintenancesDepsReady || auxDataLoading ? (
            <MobileScreenFallback />
          ) : (
            <Suspense fallback={<MobileScreenFallback />}>
              <MobileMaintenances
                ref={maintenanceFormRef}
                vehicles={vehicles}
                maintenances={maintenances}
                garages={garages}
                currentUser={currentUser}
                onMaintenanceCreated={handleMaintenanceCreated}
                onBack={() => setCurrentScreen('parc-dashboard')}
                onRefresh={loadParcData}
              />
            </Suspense>
          ))}

        {currentScreen === 'affaires' && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobileAffaires onBack={() => setCurrentScreen('home')} />
          </Suspense>
        )}

        {currentScreen === 'tasks' && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobileTasks
              currentUser={currentUser}
              onBack={() => setCurrentScreen('home')}
              initialDate={routerParams?.date || null}
            />
          </Suspense>
        )}

        {currentScreen === 'personnel' && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobilePersonnel onBack={() => setCurrentScreen('home')} currentUser={currentUser} />
          </Suspense>
        )}

        {currentScreen === 'messaging' && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobileMessaging currentUser={currentUser} onBack={() => setCurrentScreen('home')} />
          </Suspense>
        )}

        {currentScreen === 'equipment' && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobileEquipment
              onBack={() => setCurrentScreen('home')}
              initialTab="inventory"
              currentUser={currentUser}
            />
          </Suspense>
        )}

        {currentScreen === 'sav' && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobileEquipment
              onBack={() => setCurrentScreen('home')}
              initialTab="sav"
              currentUser={currentUser}
            />
          </Suspense>
        )}

        {currentScreen === 'equipment-qr' && qrEquipmentUid && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobileEquipmentQR
              uid={qrEquipmentUid}
              currentUser={currentUser}
              onBack={() => {
                setQrEquipmentUid(null);
                navigate('equipment');
              }}
              onNavigateHome={() => {
                setQrEquipmentUid(null);
                navigate('home');
              }}
            />
          </Suspense>
        )}

        {currentScreen === 'orders' && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobileOrders onBack={() => setCurrentScreen('home')} currentUser={currentUser} />
          </Suspense>
        )}

        {currentScreen === 'leaves' && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobileLeaves currentUser={currentUser} onBack={() => setCurrentScreen('home')} />
          </Suspense>
        )}

        {currentScreen === 'inventory' && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobileInventory onBack={() => setCurrentScreen('home')} />
          </Suspense>
        )}

        {currentScreen === 'location' && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobileLocation onBack={() => setCurrentScreen('home')} />
          </Suspense>
        )}

        {currentScreen === 'sonos' && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobileSonos currentUser={currentUser} onBack={() => setCurrentScreen('home')} />
          </Suspense>
        )}

        {currentScreen === 'suivi' && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobileSuivi
              currentUser={currentUser}
              onBack={() => setCurrentScreen('home')}
              initialDate={routerParams?.date || null}
              initialPersonId={routerParams?.person || null}
            />
          </Suspense>
        )}

        {currentScreen === 'dashboard-admin' && isAdmin && (
          <Suspense fallback={<MobileScreenFallback />}>
            <MobileDashboardAdmin
              currentUser={currentUser}
              onBack={() => setCurrentScreen('home')}
            />
          </Suspense>
        )}
      </main>

      {/* Toast notification messages */}
      {msgToast && (
        <div
          className="mobile-msg-toast"
          role="button"
          tabIndex={0}
          onClick={() => {
            setMsgToast(null);
            setCurrentScreen('messaging');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setMsgToast(null);
              setCurrentScreen('messaging');
            }
          }}
        >
          <MessageSquare size={16} />
          <span>{msgToast}</span>
        </div>
      )}
    </div>
  );
}

export default MobileApp;
