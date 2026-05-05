import './MobileListSkeleton.css';
import './MobileModuleWrapper.css';

import { ArrowLeft } from 'lucide-react';
import { lazy, Suspense } from 'react';

import { Button } from '@/design-system';

import MobileListSkeleton from './MobileListSkeleton';
const EquipmentPanel = lazy(() => import('../equipment/EquipmentPanel'));

function MobileEquipment({ onBack, initialTab = 'inventory', currentUser }) {
  const title = initialTab === 'sav' ? 'SAV' : 'Équipements';
  return (
    <div className="mobile-module-wrapper">
      <div className="mobile-module-header">
        <Button variant="ghost" className="mobile-back-btn" onClick={onBack} aria-label="Retour">
          <ArrowLeft size={20} />
        </Button>
        <h2>{title}</h2>
      </div>
      <div className="mobile-module-content">
        <Suspense fallback={<MobileListSkeleton rows={6} variant="cards" />}>
          <EquipmentPanel initialTab={initialTab} isMobile={true} currentUser={currentUser} />
        </Suspense>
      </div>
    </div>
  );
}

export default MobileEquipment;
