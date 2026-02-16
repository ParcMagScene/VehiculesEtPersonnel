import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Car, Calendar, Settings, LogOut, Home, AlertCircle, Menu, X, LayoutGrid, Monitor, Users, MessageSquare, Truck, ChevronLeft, Bell, Package, ShoppingCart } from 'lucide-react';
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
import MobileLogin from './MobileLogin';
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
        <h1>eM@g</h1>
        <div className="user-info" style={{ position: 'relative' }}>
          <button 
            className="user-initial"
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
          >
            {currentUser?.name?.charAt(0)}
          </button>

          {showUserMenu && (
            <>
              <div 
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 999
                }}
                onClick={() => setShowUserMenu(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50px',
                  right: 0,
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                  overflow: 'hidden',
                  minWidth: '200px',
                  zIndex: 1000
                }}
              >
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #e5e7eb',
                  background: '#f9fafb'
                }}>
                  <div style={{ fontWeight: 600, color: '#1f2937' }}>{currentUser?.name}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                    {currentUser?.email}
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    window.location.reload();
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#374151',
                    transition: 'background 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                  onTouchStart={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onTouchEnd={(e) => e.currentTarget.style.background = 'white'}
                >
                  <LayoutGrid size={16} />
                  Changer d'utilisateur
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    handleLogout();
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#dc2626',
                    transition: 'background 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontWeight: 500
                  }}
                  onTouchStart={(e) => e.currentTarget.style.background = '#fef2f2'}
                  onTouchEnd={(e) => e.currentTarget.style.background = 'white'}
                >
                  <LogOut size={16} />
                  Se déconnecter
                </button>

                <button
                  onClick={() => setShowUserMenu(false)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    borderTop: '1px solid #e5e7eb',
                    background: '#f9fafb',
                    textAlign: 'center',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#6b7280',
                    transition: 'background 0.2s'
                  }}
                  onTouchStart={(e) => e.currentTarget.style.background = '#f3f4f6'}
                  onTouchEnd={(e) => e.currentTarget.style.background = '#f9fafb'}
                >
                  Annuler
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Menu latéral */}
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        <div className="menu-overlay" onClick={() => setMenuOpen(false)}></div>
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
              className={currentScreen === 'orders' ? 'active' : ''}
              onClick={() => { setCurrentScreen('orders'); setMenuOpen(false); }}
            >
              <ShoppingCart size={20} />
              <span>Commandes</span>
            </button>
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
