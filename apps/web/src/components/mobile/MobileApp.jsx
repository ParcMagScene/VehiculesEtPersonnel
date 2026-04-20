import './MobileApp.css';

import { LayoutGrid, LogOut, MessageSquare, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BottomSheet, Button, Skeleton, Spinner } from '@/design-system';

import { useMessagingSSE } from '../../hooks/useMessagingSSE';
import useMobileRouter from '../../hooks/useMobileRouter';
import useSwipeBack from '../../hooks/useSwipeBack';
import { PALETTES, useTheme } from '../../hooks/useTheme';
import api from '../../utils/api';
import MobileAffaires from './MobileAffaires';
import MobileAvailability from './MobileAvailability';
import MobileDashboardAdmin from './MobileDashboardAdmin';
import MobileEquipment from './MobileEquipment';
import MobileEquipmentQR from './MobileEquipmentQR';
import MobileHeader from './MobileHeader';
import MobileHome from './MobileHome';
import MobileInventory from './MobileInventory';
import MobileLeaves from './MobileLeaves';
import MobileLocation from './MobileLocation';
import MobileLogin from './MobileLogin';
import MobileMaintenances from './MobileMaintenances';
import MobileMessaging from './MobileMessaging';
import MobileOrders from './MobileOrders';
import MobileParcDashboard from './MobileParcDashboard';
import MobilePersonnel from './MobilePersonnel';
import MobilePlanning from './MobilePlanning';
import MobileQRLanding from './MobileQRLanding';
import MobileReservations from './MobileReservations';
import MobileSonos from './MobileSonos';
import MobileSuivi from './MobileSuivi';
import MobileTasks from './MobileTasks';

function MobileApp({ onSwitchToDesktop }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const { currentScreen, qrUid: routerQrUid, navigate, goBack } = useMobileRouter();
  const setCurrentScreen = navigate; // Bridge — migration progressive
  const [qrEquipmentUid, setQrEquipmentUid] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [clients, setClients] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [garages, setGarages] = useState([]);
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

  // Charger les données
  const loadParcData = useCallback(async () => {
    try {
      const [
        vehiclesData,
        reservationsData,
        maintenancesData,
        clientsData,
        driversData,
        garagesData,
      ] = await Promise.all([
        api.getVehicles(),
        api.getReservations(),
        api.getMaintenances(),
        api.getClients(),
        api.getDrivers(),
        api.getGarages(),
      ]);

      setVehicles(vehiclesData.sort((a, b) => (a.order || 0) - (b.order || 0)));
      setReservations(reservationsData);
      setMaintenances(maintenancesData);
      setClients(clientsData);
      setDrivers(driversData);
      setGarages(garagesData);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      if (error.message.includes('authentification') || error.message.includes('401')) {
        handleLogout();
      }
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    loadParcData();
  }, [isAuthenticated, isLoading, loadParcData]);

  // Sync currentScreen ref
  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  // Sync QR UID depuis le router hash
  useEffect(() => {
    if (routerQrUid) setQrEquipmentUid(routerQrUid);
  }, [routerQrUid]);

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
                  <button
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
                  </button>
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

        {currentScreen === 'planning' && (
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
        )}

        {currentScreen === 'availability' && (
          <MobileAvailability
            vehicles={vehicles}
            reservations={reservations}
            maintenances={maintenances}
            onClose={() => setCurrentScreen('parc-dashboard')}
            onCreateReservation={(_vehicleId, _date) => {
              setCurrentScreen('reservations');
            }}
          />
        )}

        {currentScreen === 'reservations' && (
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
        )}

        {currentScreen === 'maintenances' && (
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
        )}

        {currentScreen === 'affaires' && <MobileAffaires onBack={() => setCurrentScreen('home')} />}

        {currentScreen === 'tasks' && (
          <MobileTasks currentUser={currentUser} onBack={() => setCurrentScreen('home')} />
        )}

        {currentScreen === 'personnel' && (
          <MobilePersonnel onBack={() => setCurrentScreen('home')} currentUser={currentUser} />
        )}

        {currentScreen === 'messaging' && (
          <MobileMessaging currentUser={currentUser} onBack={() => setCurrentScreen('home')} />
        )}

        {currentScreen === 'equipment' && (
          <MobileEquipment
            onBack={() => setCurrentScreen('home')}
            initialTab="inventory"
            currentUser={currentUser}
          />
        )}

        {currentScreen === 'sav' && (
          <MobileEquipment
            onBack={() => setCurrentScreen('home')}
            initialTab="sav"
            currentUser={currentUser}
          />
        )}

        {currentScreen === 'equipment-qr' && qrEquipmentUid && (
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
        )}

        {currentScreen === 'orders' && (
          <MobileOrders onBack={() => setCurrentScreen('home')} currentUser={currentUser} />
        )}

        {currentScreen === 'leaves' && (
          <MobileLeaves currentUser={currentUser} onBack={() => setCurrentScreen('home')} />
        )}

        {currentScreen === 'inventory' && (
          <MobileInventory onBack={() => setCurrentScreen('home')} />
        )}

        {currentScreen === 'location' && <MobileLocation onBack={() => setCurrentScreen('home')} />}

        {currentScreen === 'sonos' && (
          <MobileSonos currentUser={currentUser} onBack={() => setCurrentScreen('home')} />
        )}

        {currentScreen === 'suivi' && (
          <MobileSuivi currentUser={currentUser} onBack={() => setCurrentScreen('home')} />
        )}

        {currentScreen === 'dashboard-admin' && isAdmin && (
          <MobileDashboardAdmin currentUser={currentUser} onBack={() => setCurrentScreen('home')} />
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
