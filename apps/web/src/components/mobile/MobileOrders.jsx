import React, { Suspense, lazy } from 'react';
import { ArrowLeft } from 'lucide-react';

const OrdersPanel = lazy(() => import('../orders/OrdersPanel'));

function MobileOrders({ onBack, currentUser }) {
  return (
    <div className="mobile-module-wrapper">
      <div className="mobile-module-header">
        <button className="mobile-back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
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
