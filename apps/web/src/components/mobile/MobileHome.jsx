import './MobileHome.css';

import {
  Briefcase,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Map,
  Package,
  Palmtree,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';

function MobileHome({ onNavigate, currentUser }) {
  const isAdmin = !!currentUser?.isAdmin;
  const canManageEquipment = isAdmin || currentUser?.permissions?.canManageEquipmentMaintenance;
  const canManageCatalog = isAdmin || currentUser?.permissions?.canManageCatalog;

  return (
    <div className="mobile-home">
      {/* Grille d'icônes modules */}
      <div className="home-grid">
        <button
          type="button"
          className="home-grid-item parc"
          onClick={() => onNavigate('parc-dashboard')}
        >
          <Truck size={28} />
          <span>Parc</span>
        </button>
        <button
          type="button"
          className="home-grid-item affaires"
          onClick={() => onNavigate('affaires')}
        >
          <Briefcase size={28} />
          <span>Affaires</span>
        </button>
        <button type="button" className="home-grid-item tasks" onClick={() => onNavigate('tasks')}>
          <ClipboardList size={28} />
          <span>Tâches</span>
        </button>
        <button type="button" className="home-grid-item suivi" onClick={() => onNavigate('suivi')}>
          <FileText size={28} />
          <span>Suivi</span>
        </button>
        <button
          type="button"
          className="home-grid-item personnel"
          onClick={() => onNavigate('personnel')}
        >
          <Users size={28} />
          <span>Personnel</span>
        </button>
        {canManageEquipment && (
          <button
            type="button"
            className="home-grid-item equipment"
            onClick={() => onNavigate('equipment')}
          >
            <Package size={28} />
            <span>Équipements</span>
          </button>
        )}
        {canManageEquipment && (
          <button type="button" className="home-grid-item sav" onClick={() => onNavigate('sav')}>
            <Wrench size={28} />
            <span>SAV</span>
          </button>
        )}
        {canManageCatalog && (
          <button
            type="button"
            className="home-grid-item orders"
            onClick={() => onNavigate('orders')}
          >
            <ShoppingCart size={28} />
            <span>Commandes</span>
          </button>
        )}
        <button
          type="button"
          className="home-grid-item leaves"
          onClick={() => onNavigate('leaves')}
        >
          <Palmtree size={28} />
          <span>Congés</span>
        </button>
        <button
          type="button"
          className="home-grid-item location"
          onClick={() => onNavigate('location')}
        >
          <Map size={28} />
          <span>Plan</span>
        </button>
        {isAdmin && (
          <button
            type="button"
            className="home-grid-item dashboard-admin"
            onClick={() => onNavigate('dashboard-admin')}
          >
            <LayoutDashboard size={28} />
            <span>Dashboard</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default MobileHome;
