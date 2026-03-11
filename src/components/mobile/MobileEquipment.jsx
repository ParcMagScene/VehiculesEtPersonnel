import React, { Suspense, lazy } from 'react';
import { ArrowLeft } from 'lucide-react';

const EquipmentPanel = lazy(() => import('../equipment/EquipmentPanel'));

function MobileEquipment({ onBack }) {
  return (
    <div className="mobile-module-wrapper">
      <div className="mobile-module-header">
        <button className="mobile-back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h2>Matériel & SAV</h2>
      </div>
      <div className="mobile-module-content">
        <Suspense fallback={<div className="mobile-module-loading">Chargement...</div>}>
          <EquipmentPanel />
        </Suspense>
      </div>
    </div>
  );
}

export default MobileEquipment;
