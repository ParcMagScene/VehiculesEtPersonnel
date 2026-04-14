import { Suspense, lazy } from 'react';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/design-system';
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
        <Suspense fallback={<div className="mobile-module-loading">Chargement...</div>}>
          <EquipmentPanel initialTab={initialTab} isMobile={true} currentUser={currentUser} />
        </Suspense>
      </div>
    </div>
  );
}

export default MobileEquipment;
