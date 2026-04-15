import { Suspense, lazy } from 'react';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/design-system';
import './MobileModuleWrapper.css';
const OrdersPanel = lazy(() => import('../orders/OrdersPanel'));

function MobileOrders({ onBack, currentUser }) {
  return (
    <div className="mobile-module-wrapper">
      <div className="mobile-module-header">
        <Button variant="ghost" className="mobile-back-btn" onClick={onBack} aria-label="Retour">
          <ArrowLeft size={20} />
        </Button>
        <h2>{currentUser?.isAdmin ? 'Commandes & Devis' : 'Demandes de matériel'}</h2>
      </div>
      <div className="mobile-module-content">
        <Suspense fallback={<div className="mobile-module-loading">Chargement...</div>}>
          <OrdersPanel currentUser={currentUser} isMobile />
        </Suspense>
      </div>
    </div>
  );
}

export default MobileOrders;
