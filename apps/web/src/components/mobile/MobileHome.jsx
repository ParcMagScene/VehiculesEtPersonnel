import React from 'react';
import { Truck, Users, Package, ShoppingCart, Palmtree, Map, Wrench, Briefcase, ClipboardList } from 'lucide-react';
import './MobileHome.css';

function MobileHome({ onNavigate }) {
  return (
    <div className="mobile-home">
      {/* Grille d'icônes modules */}
      <div className="home-grid">
        <button className="home-grid-item parc" onClick={() => onNavigate('parc-dashboard')}>
          <Truck size={28} />
          <span>Parc</span>
        </button>
        <button className="home-grid-item affaires" onClick={() => onNavigate('affaires')}>
          <Briefcase size={28} />
          <span>Affaires</span>
        </button>
        <button className="home-grid-item tasks" onClick={() => onNavigate('tasks')}>
          <ClipboardList size={28} />
          <span>Tâches</span>
        </button>
        <button className="home-grid-item personnel" onClick={() => onNavigate('personnel')}>
          <Users size={28} />
          <span>Personnel</span>
        </button>
        <button className="home-grid-item equipment" onClick={() => onNavigate('equipment')}>
          <Package size={28} />
          <span>Équipements</span>
        </button>
        <button className="home-grid-item sav" onClick={() => onNavigate('sav')}>
          <Wrench size={28} />
          <span>SAV</span>
        </button>
        <button className="home-grid-item orders" onClick={() => onNavigate('orders')}>
          <ShoppingCart size={28} />
          <span>Commandes</span>
        </button>
        <button className="home-grid-item leaves" onClick={() => onNavigate('leaves')}>
          <Palmtree size={28} />
          <span>Congés</span>
        </button>
        <button className="home-grid-item location" onClick={() => onNavigate('location')}>
          <Map size={28} />
          <span>Plan</span>
        </button>
      </div>
    </div>
  );
}

export default MobileHome;
