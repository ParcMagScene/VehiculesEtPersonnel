// Bandeau discret affiché quand un nouveau SW est prêt. En pratique, le reload
// automatique via `controllerchange` arrive dans la seconde ; ce composant sert
// de filet de sécurité si le user reste sur un onglet inactif ou si son
// navigateur bloque le reload auto.
import { useEffect, useState } from 'react';

import './UpdateAvailableBanner.css';

export default function UpdateAvailableBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onUpdate = () => setVisible(true);
    window.addEventListener('emag-sw-update-available', onUpdate);
    return () => window.removeEventListener('emag-sw-update-available', onUpdate);
  }, []);

  if (!visible) return null;

  const handleReload = () => {
    setVisible(false);
    window.location.reload();
  };

  return (
    <div className="emag-update-banner" role="status" aria-live="polite">
      <span>🚀 Nouvelle version disponible</span>
      <button type="button" onClick={handleReload}>
        Recharger
      </button>
    </div>
  );
}
