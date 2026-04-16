import './MobileListSkeleton.css';
import './MobileModuleWrapper.css';

import { ArrowLeft } from 'lucide-react';
import { lazy, Suspense } from 'react';

import { Button } from '@/design-system';

import MobileListSkeleton from './MobileListSkeleton';
const InventoryPanel = lazy(() => import('../inventory/InventoryPanel'));

function MobileInventory({ onBack }) {
  return (
    <div className="mobile-module-wrapper">
      <div className="mobile-module-header">
        <Button variant="ghost" className="mobile-back-btn" onClick={onBack} aria-label="Retour">
          <ArrowLeft size={20} />
        </Button>
        <h2>Inventaire</h2>
      </div>
      <div className="mobile-module-content">
        <Suspense fallback={<MobileListSkeleton rows={6} variant="cards" />}>
          <InventoryPanel />
        </Suspense>
      </div>
    </div>
  );
}

export default MobileInventory;
