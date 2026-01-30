import React, { useState, useEffect, useRef } from 'react';
import { Car, Calendar, Settings, LogOut, Home, AlertCircle, Menu, X, LayoutGrid } from 'lucide-react';
import MobileHome from './MobileHome';
import MobileReservations from './MobileReservations';
import MobileMaintenances from './MobileMaintenances';
import MobileAvailability from './MobileAvailability';
import MobilePlanning from './MobilePlanning';
import MobileLogin from './MobileLogin';
import api from '../../utils/api';
import './MobileApp.css';

function MobileApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('home');
  const [vehicles, setVehicles] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [clients, setClients] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [garages, setGarages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Refs pour contrôler les formulaires
  const reservationFormRef = useRef(null);
  const maintenanceFormRef = useRef(null);

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

  const handleLogin = (user) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
  };

  const handleLogout = () => {
    api.logout();
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

  return (
    <div className="mobile-app">
      {/* Header */}
      <header className="mobile-header">
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <h1>Véhicules</h1>
        <div className="user-info">
          <span className="user-initial">{currentUser?.name?.charAt(0)}</span>
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
          </nav>

          <button className="menu-logout" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Se déconnecter</span>
          </button>
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
            onClose={() => setCurrentScreen('home')}
            clients={clients}
            drivers={drivers}
          />
        )}
        
        {currentScreen === 'availability' && (
          <MobileAvailability
            vehicles={vehicles}
            reservations={reservations}
            maintenances={maintenances}
            onClose={() => setCurrentScreen('home')}
            onCreateReservation={(vehicleId, date) => {
              // TODO: Pré-remplir la réservation avec le véhicule et la date
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
            onBack={() => setCurrentScreen('home')}
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
            onBack={() => setCurrentScreen('home')}
          />
        )}
      </main>
    </div>
  );
}

export default MobileApp;
