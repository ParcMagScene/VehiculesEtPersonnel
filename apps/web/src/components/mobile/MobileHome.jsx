import { Truck, Users, Package, ShoppingCart, Palmtree, Map, Wrench, Briefcase, ClipboardList } from 'lucide-react';
import { Button } from '@/design-system';
import './MobileHome.css';

function MobileHome({ onNavigate }) {
  return (
    <div className="mobile-home">
      {/* Grille d'icônes modules */}
      <div className="home-grid">
        <Button variant="ghost" className="home-grid-item parc" onClick={() => onNavigate('parc-dashboard')}>
          <Truck size={28} />
          <span>Parc</span>
        </Button>
        <Button variant="ghost" className="home-grid-item affaires" onClick={() => onNavigate('affaires')}>
          <Briefcase size={28} />
          <span>Affaires</span>
        </Button>
        <Button variant="ghost" className="home-grid-item tasks" onClick={() => onNavigate('tasks')}>
          <ClipboardList size={28} />
          <span>Tâches</span>
        </Button>
        <Button variant="ghost" className="home-grid-item personnel" onClick={() => onNavigate('personnel')}>
          <Users size={28} />
          <span>Personnel</span>
        </Button>
        <Button variant="ghost" className="home-grid-item equipment" onClick={() => onNavigate('equipment')}>
          <Package size={28} />
          <span>Équipements</span>
        </Button>
        <Button variant="ghost" className="home-grid-item sav" onClick={() => onNavigate('sav')}>
          <Wrench size={28} />
          <span>SAV</span>
        </Button>
        <Button variant="ghost" className="home-grid-item orders" onClick={() => onNavigate('orders')}>
          <ShoppingCart size={28} />
          <span>Commandes</span>
        </Button>
        <Button variant="ghost" className="home-grid-item leaves" onClick={() => onNavigate('leaves')}>
          <Palmtree size={28} />
          <span>Congés</span>
        </Button>
        <Button variant="ghost" className="home-grid-item location" onClick={() => onNavigate('location')}>
          <Map size={28} />
          <span>Plan</span>
        </Button>
      </div>
    </div>
  );
}

export default MobileHome;
