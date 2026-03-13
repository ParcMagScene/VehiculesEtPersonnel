import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Car, Calendar, Settings, LogOut, Home, AlertCircle, Menu, X, LayoutGrid, Monitor, Users, MessageSquare, Truck, ChevronLeft, Bell, Package, ShoppingCart, MapPin, Palmtree, Sun, Moon, Palette } from 'lucide-react';
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
import MobileLocation from './MobileLocation';
import MobileLogin from './MobileLogin';
import { useTheme, PALETTES } from '../../hooks/useTheme';
import api from '../../utils/api';
import { playNotificationSound, requestNotificationPermission, showBrowserNotification } from '../../utils/notificationSound';
import './MobileApp.css';

function MobileApp({ onSwitchToDesktop }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('home');
  const [qrEquipmentUid, setQrEquipmentUid] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [clients, setClients] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [garages, setGarages] = useState([]);
  const { theme, isDark, toggleTheme, palette, setPalette } = useTheme();
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [msgToast, setMsgToast] = useState(null);
  
  // Refs pour contrôler les formulaires
  const reservationFormRef = useRef(null);
  const maintenanceFormRef = useRef(null);
  const prevUnreadRef = useRef(-1);
  const msgToastTimerRef = useRef(null);
  const currentScreenRef = useRef('home');

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

  // Charger les données
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    const loadData = async () => {
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
    };

    loadData();
  }, [isAuthenticated, isLoading]);

  // Sync currentScreen ref
  useEffect(() => { currentScreenRef.current = currentScreen; }, [currentScreen]);

  // Détection QR code dans le hash : #/mobile/equipment/EMAG-XXXXX
  useEffect(() => {
    const checkQrHash = () => {
      const hash = window.location.hash;
      const match = hash.match(/#\/mobile\/equipment\/(EMAG-\d+)/i);
      if (match) {
        setQrEquipmentUid(match[1]);
        setCurrentScreen('qr-landing');
      }
    };
    checkQrHash();
    window.addEventListener('hashchange', checkQrHash);
    return () => window.removeEventListener('hashchange', checkQrHash);
  }, []);

  // Polling notifications messages non lus
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    // Demander permission navigateur
    requestNotificationPermission();

    const fetchUnread = async () => {
      try {
        const data = await api.getUnreadCount();
        const newCount = data.unread || 0;
        const prevCount = prevUnreadRef.current;

        if (newCount > prevCount && prevCount !== -1) {
          const diff = newCount - prevCount;

          // Son
          playNotificationSound();

          // Toast in-app (sauf si on est déjà dans la messagerie)
          if (currentScreenRef.current !== 'messaging') {
            if (msgToastTimerRef.current) clearTimeout(msgToastTimerRef.current);
            setMsgToast(`${diff} nouveau${diff > 1 ? 'x' : ''} message${diff > 1 ? 's' : ''}`);
            msgToastTimerRef.current = setTimeout(() => setMsgToast(null), 6000);
          }

          // Notification navigateur
          if (currentScreenRef.current !== 'messaging') {
            showBrowserNotification(
              `${diff} nouveau${diff > 1 ? 'x' : ''} message${diff > 1 ? 's' : ''}`,
              { body: 'Cliquez pour ouvrir la messagerie eM@g' }
            );
          }
        }

        prevUnreadRef.current = newCount;
        setUnreadMsgCount(newCount);
      } catch (e) { /* silencieux */ }
    };

    prevUnreadRef.current = -1;
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => {
      clearInterval(interval);
      if (msgToastTimerRef.current) clearTimeout(msgToastTimerRef.current);
    };
  }, [isAuthenticated, currentUser]);

  const handleLogin = (user) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await api.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentScreen('home');
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
          <div className="spinner"></div>
          <p>Chargement...</p>
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
        onGoHome={() => { setQrEquipmentUid(null); setCurrentScreen('home'); window.location.hash = '#/mobile'; }}
      />
    );
  }

  return (
    <div className="mobile-app">
      {/* Header */}
      <header className="mobile-header">
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <img src="/Logos/LogoEmagTransp.png" alt="eM@g" className="mobile-header-logo" />
        <div className="user-info">
          <button
            className="header-msg-btn"
            onClick={() => { setCurrentScreen('messaging'); currentScreenRef.current = 'messaging'; }}
          >
            <MessageSquare size={20} />
            {unreadMsgCount > 0 && (
              <span className="header-msg-badge">{unreadMsgCount > 9 ? '9+' : unreadMsgCount}</span>
            )}
          </button>
          <button 
            className="user-initial"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            {currentUser?.name?.charAt(0)}
          </button>
        </div>
      </header>

      {/* User menu bottom-sheet */}
      {showUserMenu && (
        <div className="mobile-sheet-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowUserMenu(false); }}>
          <div className="mobile-sheet">
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-user">
              <div className="mobile-sheet-avatar">{currentUser?.name?.charAt(0)}</div>
              <div>
                <div className="mobile-sheet-name">{currentUser?.name}</div>
                <div className="mobile-sheet-email">{currentUser?.email}</div>
              </div>
            </div>
            <div className="mobile-sheet-actions">
              <button onClick={() => { setShowUserMenu(false); window.location.reload(); }}>
                <LayoutGrid size={18} />
                Changer d'utilisateur
              </button>
              <button className="danger" onClick={() => { setShowUserMenu(false); handleLogout(); }}>
                <LogOut size={18} />
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu latéral */}
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        <div className="menu-overlay" onMouseDown={() => setMenuOpen(false)}></div>
        <div className="menu-content">
          <div className="menu-user">
            <div className="menu-avatar">{currentUser?.name?.charAt(0)}</div>
            <div className="menu-user-details">
              <p className="menu-user-name">{currentUser?.name}</p>
              <p className="menu-user-email">{currentUser?.email}</p>
            </div>
          </div>
          
          <nav className="menu-nav">
            <button
              className={currentScreen === 'home' ? 'active' : ''}
              onClick={() => { setCurrentScreen('home'); setMenuOpen(false); }}
            >
              <Home size={20} />
              <span>Accueil</span>
            </button>

            <div className="menu-section-label">Parc</div>
            <button
              className={currentScreen === 'parc-dashboard' ? 'active' : ''}
              onClick={() => { setCurrentScreen('parc-dashboard'); setMenuOpen(false); }}
            >
              <Truck size={20} />
              <span>Tableau de bord</span>
            </button>
            <button
              className={currentScreen === 'planning' ? 'active' : ''}
              onClick={() => { setCurrentScreen('planning'); setMenuOpen(false); }}
            >
              <LayoutGrid size={20} />
              <span>Planning</span>
            </button>
            <button
              className={currentScreen === 'reservations' ? 'active' : ''}
              onClick={() => { setCurrentScreen('reservations'); setMenuOpen(false); }}
            >
              <Car size={20} />
              <span>Réservations</span>
            </button>
            <button
              className={currentScreen === 'maintenances' ? 'active' : ''}
              onClick={() => { setCurrentScreen('maintenances'); setMenuOpen(false); }}
            >
              <Settings size={20} />
              <span>Interventions</span>
            </button>

            <div className="menu-section-label">Équipe</div>
            <button
              className={currentScreen === 'personnel' ? 'active' : ''}
              onClick={() => { setCurrentScreen('personnel'); setMenuOpen(false); }}
            >
              <Users size={20} />
              <span>Personnel</span>
            </button>
            <button
              className={currentScreen === 'messaging' ? 'active' : ''}
              onClick={() => { setCurrentScreen('messaging'); setMenuOpen(false); }}
            >
              <MessageSquare size={20} />
              <span>Messagerie</span>
              {unreadMsgCount > 0 && <span className="menu-badge">{unreadMsgCount}</span>}
            </button>

            <div className="menu-section-label">Gestion</div>
            <button
              className={currentScreen === 'equipment' ? 'active' : ''}
              onClick={() => { setCurrentScreen('equipment'); setMenuOpen(false); }}
            >
              <Package size={20} />
              <span>Matériel & SAV</span>
            </button>
            <button
              className={currentScreen === 'location' ? 'active' : ''}
              onClick={() => { setCurrentScreen('location'); setMenuOpen(false); }}
            >
              <MapPin size={20} />
              <span>Localisation</span>
            </button>
            <button
              className={currentScreen === 'orders' ? 'active' : ''}
              onClick={() => { setCurrentScreen('orders'); setMenuOpen(false); }}
            >
              <ShoppingCart size={20} />
              <span>Commandes</span>
            </button>
            <button
              className={currentScreen === 'leaves' ? 'active' : ''}
              onClick={() => { setCurrentScreen('leaves'); setMenuOpen(false); }}
            >
              <Palmtree size={20} />
              <span>Congés</span>
            </button>

            {/* ── Thème ── */}
            <div className="menu-section-label">Apparence</div>
            <button onClick={() => setShowThemePanel(!showThemePanel)}>
              <Palette size={20} />
              <span>Thème & couleurs</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--theme-text-muted)' }}>
                {isDark ? '🌙' : '☀️'}
              </span>
            </button>
            {showThemePanel && (
              <div className="menu-theme-panel">
                <div className="menu-theme-mode">
                  <button 
                    className={`menu-theme-mode-btn ${!isDark ? 'active' : ''}`} 
                    onClick={() => { if (isDark) toggleTheme(); }}
                  >
                    <Sun size={16} /> Clair
                  </button>
                  <button 
                    className={`menu-theme-mode-btn ${isDark ? 'active' : ''}`}
                    onClick={() => { if (!isDark) toggleTheme(); }}
                  >
                    <Moon size={16} /> Sombre
                  </button>
                </div>
                <div className="menu-palette-grid">
                  {PALETTES.map(p => {
                    const colors = isDark ? p.darkColors : p.colors;
                    return (
                      <button
                        key={p.id}
                        className={`menu-palette-btn ${palette === p.id ? 'active' : ''}`}
                        onClick={() => setPalette(p.id)}
                        title={p.name}
                      >
                        <div className="menu-palette-preview">
                          <div style={{ background: colors.primary, width: '50%', height: '100%', borderRadius: '4px 0 0 4px' }} />
                          <div style={{ background: colors.accent, width: '50%', height: '100%', borderRadius: '0 4px 4px 0' }} />
                        </div>
                        <span>{p.name.replace('Flat ', '')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          <button className="menu-logout" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Se déconnecter</span>
          </button>
          {onSwitchToDesktop && (
            <button className="menu-desktop" onClick={onSwitchToDesktop}>
              <Monitor size={20} />
              <span>Version bureau</span>
            </button>
          )}
        </div>
      </div>

      {/* Contenu principal */}
      <main className="mobile-content">
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
          />
        )}
        
        {currentScreen === 'availability' && (
          <MobileAvailability
            vehicles={vehicles}
            reservations={reservations}
            maintenances={maintenances}
            onClose={() => setCurrentScreen('parc-dashboard')}
            onCreateReservation={(vehicleId, date) => {
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
          />
        )}

        {currentScreen === 'personnel' && (
          <MobilePersonnel
            onBack={() => setCurrentScreen('home')}
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
          />
        )}

        {currentScreen === 'sav' && (
          <MobileEquipment
            onBack={() => setCurrentScreen('home')}
            initialTab="sav"
          />
        )}

        {currentScreen === 'equipment-qr' && qrEquipmentUid && (
          <MobileEquipmentQR
            uid={qrEquipmentUid}
            currentUser={currentUser}
            onBack={() => { setQrEquipmentUid(null); setCurrentScreen('equipment'); window.location.hash = '#/mobile'; }}
            onNavigateHome={() => { setQrEquipmentUid(null); setCurrentScreen('home'); window.location.hash = '#/mobile'; }}
          />
        )}

        {currentScreen === 'orders' && (
          <MobileOrders
            onBack={() => setCurrentScreen('home')}
          />
        )}

        {currentScreen === 'leaves' && (
          <MobileLeaves
            currentUser={currentUser}
            onBack={() => setCurrentScreen('home')}
          />
        )}

        {currentScreen === 'location' && (
          <MobileLocation
            onBack={() => setCurrentScreen('home')}
          />
        )}
      </main>

      {/* Toast notification messages */}
      {msgToast && (
        <div className="mobile-msg-toast" onClick={() => { setMsgToast(null); setCurrentScreen('messaging'); }}>
          <MessageSquare size={16} />
          <span>{msgToast}</span>
        </div>
      )}
    </div>
  );
}

export default MobileApp;
