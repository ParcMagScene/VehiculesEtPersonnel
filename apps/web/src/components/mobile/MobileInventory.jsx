import { Suspense, lazy } from 'react';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/design-system';
const InventoryPanel = lazy(() => import('../inventory/InventoryPanel'));

function MobileInventory({ onBack }) {
  return (
    <div className="mobile-module-wrapper">
      <div className="mobile-module-header">
        <Button variant="ghost" className="mobile-back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
        </Button>
        <h2>Inventaire</h2>
      </div>
      <div className="mobile-module-content">
        <Suspense fallback={<div className="mobile-module-loading">Chargement...</div>}>
          <InventoryPanel />
        </Suspense>
      </div>
    </div>
  );
}

export default MobileInventory;
