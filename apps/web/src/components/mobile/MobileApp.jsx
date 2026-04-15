import { useState, useEffect, useRef, useCallback } from 'react';
import { Car, Settings, LogOut, Home, Menu, X, LayoutGrid, Monitor, Users, MessageSquare, Truck, Package, ShoppingCart, MapPin, Palmtree, Sun, Moon, Palette, ClipboardCheck, Briefcase, ClipboardList, Music } from 'lucide-react';
import MobileHome from './MobileHome';
import MobileParcDashboard from './MobileParcDashboard';
import MobileReservations from './MobileReservations';
import MobileMaintenances from './MobileMaintenances';
import MobileAvailability from './MobileAvailability';
import MobilePlanning from './MobilePlanning';
import MobilePersonnel from './MobilePersonnel';
import MobileMessaging from './MobileMessaging';
import MobileEquipment from './MobileEquipment';
import MobileEquipmentQR from './MobileEquipmentQR';
import MobileQRLanding from './MobileQRLanding';
import MobileOrders from './MobileOrders';
import MobileLeaves from './MobileLeaves';
import MobileInventory from './MobileInventory';
import MobileLocation from './MobileLocation';
import MobileSonos from './MobileSonos';
import MobileAffaires from './MobileAffaires';
import MobileTasks from './MobileTasks';
import MobileLogin from './MobileLogin';
import { useTheme, PALETTES } from '../../hooks/useTheme';
import useSwipeBack from '../../hooks/useSwipeBack';
import useMobileRouter from '../../hooks/useMobileRouter';
import { useMessagingSSE } from '../../hooks/useMessagingSSE';
import api from '../../utils/api';
import './MobileApp.css';
import { Button, Spinner, BottomSheet, Skeleton } from '@/design-system';

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
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = !!currentUser?.isAdmin;
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [msgToast, setMsgToast] = useState(null);
  
  // Swipe-back : retour à l'écran précédent (goBack fourni par useMobileRouter)
  const { swipeBackProps, swipeProgress } = useSwipeBack(goBack, { disabled: currentScreen === 'home' });

  // Refs pour contrôler les formulaires
  const reservationFormRef = useRef(null);
  const maintenanceFormRef = useRef(null);
  const msgToastTimerRef = useRef(null);
  const currentScreenRef = useRef('home');

  // SSE messagerie temps réel (fallback polling auto)
  const handleNewMessage = useCallback((msg) => {
    if (currentScreenRef.current !== 'messaging') {
      if (msgToastTimerRef.current) clearTimeout(msgToastTimerRef.current);
      const label = msg.type === 'text'
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
        garagesData
      ] = await Promise.all([
        api.getVehicles(),
        api.getReservations(),
        api.getMaintenances(),
        api.getClients(),
        api.getDrivers(),
        api.getGarages()
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
  useEffect(() => { currentScreenRef.current = currentScreen; }, [currentScreen]);

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
        onGoHome={() => { setQrEquipmentUid(null); navigate('home'); }}
      />
    );
  }

  return (
    <div className="mobile-app">
      {/* Header */}
      <header className="mobile-header">
        <Button variant="ghost" className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-pressed={menuOpen} aria-expanded={menuOpen}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </Button>
        <img src="/Logos/LogoEmagTransp.png" alt="eM@g" className="mobile-header-logo" />
        <div className="user-info">
          <Button variant="ghost"             className="header-msg-btn"
            onClick={() => { setCurrentScreen('messaging'); currentScreenRef.current = 'messaging'; }}
            aria-label="Messagerie"
          >
            <MessageSquare size={20} />
            {unreadMsgCount > 0 && (
              <span className="header-msg-badge">{unreadMsgCount > 9 ? '9+' : unreadMsgCount}</span>
            )}
          </Button>
          <Button variant="ghost" 
            className="user-initial"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="Menu utilisateur"
          >
            {currentUser?.name?.charAt(0)}
          </Button>
        </div>
      </header>

      {/* User menu bottom-sheet */}
      <BottomSheet open={showUserMenu} onClose={() => setShowUserMenu(false)} title="">
        <div className="mobile-sheet-user">
          <div className="mobile-sheet-avatar">{currentUser?.name?.charAt(0)}</div>
          <div>
            <div className="mobile-sheet-name">{currentUser?.name}</div>
            <div className="mobile-sheet-email">{currentUser?.email}</div>
          </div>
        </div>
        <div className="mobile-sheet-actions">
          <Button variant="ghost" onClick={() => { setShowUserMenu(false); window.location.reload(); }}>
            <LayoutGrid size={18} />
            Changer d'utilisateur
          </Button>
          <Button variant="ghost" className="danger" onClick={() => { setShowUserMenu(false); handleLogout(); }}>
            <LogOut size={18} />
            Se déconnecter
          </Button>
        </div>
      </BottomSheet>

      {/* Menu latéral */}
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        <div className="menu-overlay" onMouseDown={() => setMenuOpen(false)} onKeyDown={(e) => { if (e.key === 'Escape') setMenuOpen(false); }}></div>
        <div className="menu-content">
          <div className="menu-user">
            <div className="menu-avatar">{currentUser?.name?.charAt(0)}</div>
            <div className="menu-user-details">
              <p className="menu-user-name">{currentUser?.name}</p>
              <p className="menu-user-email">{currentUser?.email}</p>
            </div>
          </div>
          
          <nav className="menu-nav" role="navigation" aria-label="Menu principal">
            <Button variant="ghost"               className={currentScreen === 'home' ? 'active' : ''}
              onClick={() => { setCurrentScreen('home'); setMenuOpen(false); }}
            >
              <Home size={20} />
              <span>Accueil</span>
            </Button>

            <div className="menu-section-label">Parc</div>
            <Button variant="ghost"               className={currentScreen === 'parc-dashboard' ? 'active' : ''}
              onClick={() => { setCurrentScreen('parc-dashboard'); setMenuOpen(false); }}
            >
              <Truck size={20} />
              <span>Tableau de bord</span>
            </Button>
            <Button variant="ghost"               className={currentScreen === 'planning' ? 'active' : ''}
              onClick={() => { setCurrentScreen('planning'); setMenuOpen(false); }}
            >
              <LayoutGrid size={20} />
              <span>Planning</span>
            </Button>
            <Button variant="ghost"               className={currentScreen === 'reservations' ? 'active' : ''}
              onClick={() => { setCurrentScreen('reservations'); setMenuOpen(false); }}
            >
              <Car size={20} />
              <span>Réservations</span>
            </Button>
            <Button variant="ghost"               className={currentScreen === 'maintenances' ? 'active' : ''}
              onClick={() => { setCurrentScreen('maintenances'); setMenuOpen(false); }}
            >
              <Settings size={20} />
              <span>Interventions</span>
            </Button>

            <Button variant="ghost"               className={currentScreen === 'affaires' ? 'active' : ''}
              onClick={() => { setCurrentScreen('affaires'); setMenuOpen(false); }}
            >
              <Briefcase size={20} />
              <span>Affaires</span>
            </Button>
            <Button variant="ghost"               className={currentScreen === 'tasks' ? 'active' : ''}
              onClick={() => { setCurrentScreen('tasks'); setMenuOpen(false); }}
            >
              <ClipboardList size={20} />
              <span>Tâches du jour</span>
            </Button>

            <div className="menu-section-label">Équipe</div>
            <Button variant="ghost"               className={currentScreen === 'personnel' ? 'active' : ''}
              onClick={() => { setCurrentScreen('personnel'); setMenuOpen(false); }}
            >
              <Users size={20} />
              <span>Personnel</span>
            </Button>
            <Button variant="ghost"               className={currentScreen === 'messaging' ? 'active' : ''}
              onClick={() => { setCurrentScreen('messaging'); setMenuOpen(false); }}
            >
              <MessageSquare size={20} />
              <span>Messagerie</span>
              {unreadMsgCount > 0 && <span className="menu-badge">{unreadMsgCount}</span>}
            </Button>

            <div className="menu-section-label">Gestion</div>
            {(isAdmin || currentUser?.permissions?.canManageEquipmentMaintenance) && (
            <Button variant="ghost"               className={currentScreen === 'equipment' ? 'active' : ''}
              onClick={() => { setCurrentScreen('equipment'); setMenuOpen(false); }}
            >
              <Package size={20} />
              <span>Matériel & SAV</span>
            </Button>
            )}
            <Button variant="ghost"               className={currentScreen === 'location' ? 'active' : ''}
              onClick={() => { setCurrentScreen('location'); setMenuOpen(false); }}
            >
              <MapPin size={20} />
              <span>Localisation</span>
            </Button>
            {(isAdmin || currentUser?.permissions?.canManageCatalog) && (
            <Button variant="ghost"               className={currentScreen === 'orders' ? 'active' : ''}
              onClick={() => { setCurrentScreen('orders'); setMenuOpen(false); }}
            >
              <ShoppingCart size={20} />
              <span>Commandes</span>
            </Button>
            )}
            <Button variant="ghost"               className={currentScreen === 'leaves' ? 'active' : ''}
              onClick={() => { setCurrentScreen('leaves'); setMenuOpen(false); }}
            >
              <Palmtree size={20} />
              <span>Congés</span>
            </Button>
            {(isAdmin || currentUser?.permissions?.canManageEquipmentMaintenance) && (
            <Button variant="ghost"               className={currentScreen === 'inventory' ? 'active' : ''}
              onClick={() => { setCurrentScreen('inventory'); setMenuOpen(false); }}
            >
              <ClipboardCheck size={20} />
              <span>Inventaire</span>
            </Button>
            )}

            {/* ── Multimédia ── */}
            <div className="menu-section-label">Multimédia</div>
            <Button variant="ghost"               className={currentScreen === 'sonos' ? 'active' : ''}
              onClick={() => { setCurrentScreen('sonos'); setMenuOpen(false); }}
            >
              <Music size={20} />
              <span>Sonos</span>
            </Button>

            {/* ── Thème ── */}
            <div className="menu-section-label">Apparence</div>
            <Button variant="ghost" onClick={() => setShowThemePanel(!showThemePanel)}>
              <Palette size={20} />
              <span>Thème & couleurs</span>
              <span className="menu-theme-indicator">
                {isDark ? '🌙' : '☀️'}
              </span>
            </Button>
            {showThemePanel && (
              <div className="menu-theme-panel">
                <div className="menu-theme-mode">
                  <Button variant="ghost" 
                    className={`menu-theme-mode-btn ${!isDark ? 'active' : ''}`} 
                    onClick={() => { if (isDark) toggleTheme(); }}
                  >
                    <Sun size={16} /> Clair
                  </Button>
                  <Button variant="ghost" 
                    className={`menu-theme-mode-btn ${isDark ? 'active' : ''}`}
                    onClick={() => { if (!isDark) toggleTheme(); }}
                  >
                    <Moon size={16} /> Sombre
                  </Button>
                </div>
                <div className="menu-palette-grid">
                  {PALETTES.map(p => {
                    const colors = isDark ? p.darkColors : p.colors;
                    return (
                      <Button variant="ghost"                         key={p.id}
                        className={`menu-palette-btn ${palette === p.id ? 'active' : ''}`}
                        onClick={() => setPalette(p.id)}
                        title={p.name}
                      >
                        <div className="menu-palette-preview">
                          <div className="menu-palette-left" style={{ background: colors.primary }} />
                          <div className="menu-palette-right" style={{ background: colors.accent }} />
                        </div>
                        <span>{p.name.replace('Flat ', '')}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          <Button variant="ghost" className="menu-logout" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Se déconnecter</span>
          </Button>
          {onSwitchToDesktop && (
            <Button variant="ghost" className="menu-desktop" onClick={onSwitchToDesktop}>
              <Monitor size={20} />
              <span>Version bureau</span>
            </Button>
          )}
        </div>
      </div>

      {/* Contenu principal */}
      <main className="mobile-content" {...swipeBackProps}>
        {swipeProgress > 0 && (
          <div className="swipe-back-indicator" style={{ opacity: swipeProgress, transform: `translateX(${swipeProgress * 20 - 20}px)` }}>
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

        {currentScreen === 'affaires' && (
          <MobileAffaires
            onBack={() => setCurrentScreen('home')}
          />
        )}

        {currentScreen === 'tasks' && (
          <MobileTasks
            currentUser={currentUser}
            onBack={() => setCurrentScreen('home')}
          />
        )}

        {currentScreen === 'personnel' && (
          <MobilePersonnel
            onBack={() => setCurrentScreen('home')}
            currentUser={currentUser}
          />
        )}

        {currentScreen === 'messaging' && (
          <MobileMessaging
            currentUser={currentUser}
            onBack={() => setCurrentScreen('home')}
          />
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
            onBack={() => { setQrEquipmentUid(null); navigate('equipment'); }}
            onNavigateHome={() => { setQrEquipmentUid(null); navigate('home'); }}
          />
        )}

        {currentScreen === 'orders' && (
          <MobileOrders
            onBack={() => setCurrentScreen('home')}
            currentUser={currentUser}
          />
        )}

        {currentScreen === 'leaves' && (
          <MobileLeaves
            currentUser={currentUser}
            onBack={() => setCurrentScreen('home')}
          />
        )}

        {currentScreen === 'inventory' && (
          <MobileInventory
            onBack={() => setCurrentScreen('home')}
          />
        )}

        {currentScreen === 'location' && (
          <MobileLocation
            onBack={() => setCurrentScreen('home')}
          />
        )}

        {currentScreen === 'sonos' && (
          <MobileSonos
            currentUser={currentUser}
            onBack={() => setCurrentScreen('home')}
          />
        )}
      </main>

      {/* Toast notification messages */}
      {msgToast && (
        <div className="mobile-msg-toast" role="button" tabIndex={0} onClick={() => { setMsgToast(null); setCurrentScreen('messaging'); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMsgToast(null); setCurrentScreen('messaging'); } }}>
          <MessageSquare size={16} />
          <span>{msgToast}</span>
        </div>
      )}
    </div>
  );
}

export default MobileApp;
