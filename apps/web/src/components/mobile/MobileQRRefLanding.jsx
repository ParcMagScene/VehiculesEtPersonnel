import './MobileQRLanding.css';
import './MobileQRRefLanding.css';

import { ArrowRight, Home, Package } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, InlineAlert, Spinner } from '@/design-system';

import { EQUIPMENT_STATUS } from '../../constants';
import api from '../../utils/api';

// ═══ PAGE D'ATTERRISSAGE QR PAR RÉFÉRENCE — CHOIX D'UNE UNITÉ ═══
// Affichée quand l'utilisateur scanne un QR collé sur une plaque flight-case.
// Liste les unités partageant la référence et permet d'ouvrir une fiche
// (sérialisée ou non) ou de retourner à l'accueil eM@g.

function MobileQRRefLanding({ reference, onSelectUid, onGoHome }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await api.getEquipmentByReference(reference);
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (err) {
        setError(err.message || 'Référence introuvable');
      } finally {
        setLoading(false);
      }
    };
    if (reference) load();
  }, [reference]);

  const renderItem = (eq) => {
    const status = EQUIPMENT_STATUS[eq.status] || EQUIPMENT_STATUS.available;
    const subtitle = [eq.serial_number ? 'S/N ' + eq.serial_number : null, eq.numero_mag]
      .filter(Boolean)
      .join(' — ');
    return (
      <button type="button" key={eq.id} className="qr-ref-item" onClick={() => onSelectUid(eq.uid)}>
        <div className="qr-ref-item-main">
          <div className="qr-ref-item-name">{eq.name || eq.reference}</div>
          {subtitle ? <div className="qr-ref-item-sub">{subtitle}</div> : null}
          {status ? (
            <div className="qr-ref-item-status" style={{ color: status.color }}>
              {status.icon} {status.label}
            </div>
          ) : null}
        </div>
        <ArrowRight size={18} />
      </button>
    );
  };

  return (
    <div className="qr-landing">
      <div className="qr-landing-card qr-ref-card">
        <div className="qr-landing-header">
          <div className="qr-landing-logo">
            <Package size={36} />
          </div>
          <h1>eM@g</h1>
          <p className="qr-landing-subtitle">QR Plaque flight-case</p>
        </div>

        <div className="qr-landing-info">
          <div className="qr-landing-uid">Réf : {reference}</div>
          {loading ? (
            <div className="qr-landing-loading">
              <Spinner size="md" />
              <span>Chargement...</span>
            </div>
          ) : error ? (
            <InlineAlert>{error}</InlineAlert>
          ) : items.length === 0 ? (
            <InlineAlert>Aucun équipement avec cette référence.</InlineAlert>
          ) : (
            <div className="qr-ref-count">
              {items.length} unité{items.length > 1 ? 's' : ''} disponible
              {items.length > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {!loading && !error && items.length > 0 ? (
          <div className="qr-ref-list">{items.map(renderItem)}</div>
        ) : null}

        <div className="qr-landing-actions">
          <Button variant="ghost" className="qr-landing-btn qr-landing-btn-home" onClick={onGoHome}>
            <Home size={22} />
            <span>Accueil eM@g</span>
            <ArrowRight size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MobileQRRefLanding;
