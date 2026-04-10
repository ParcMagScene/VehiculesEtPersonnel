import { useState, useEffect } from 'react';
import { Package, Home, ArrowRight } from 'lucide-react';
import api from '../../utils/api';
import { Button, InlineAlert, Spinner } from '@/design-system';
import { EQUIPMENT_STATUS } from '../../constants';
import './MobileQRLanding.css';

// ═══ PAGE D'ATTERRISSAGE QR — CHOIX MATÉRIEL OU ACCUEIL ═══
// Affiché quand un utilisateur scanne le QR code d'un équipement
// Propose : "Aller au matériel" ou "Accueil eM@g"

function MobileQRLanding({ uid, onGoToEquipment, onGoHome }) {
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await api.getEquipmentByUid(uid);
        setEquipment(data);
      } catch (err) {
        setError(err.message || 'Équipement introuvable');
      } finally {
        setLoading(false);
      }
    };
    if (uid) load();
  }, [uid]);

  const status = equipment ? EQUIPMENT_STATUS[equipment.status] || EQUIPMENT_STATUS.available : null;

  return (
    <div className="qr-landing">
      <div className="qr-landing-card">
        {/* Header */}
        <div className="qr-landing-header">
          <div className="qr-landing-logo">
            <Package size={36} />
          </div>
          <h1>eM@g</h1>
          <p className="qr-landing-subtitle">QR Code scanné</p>
        </div>

        {/* Equipment info */}
        <div className="qr-landing-info">
          {loading ? (
            <div className="qr-landing-loading">
              <Spinner size="md" />
              <span>Chargement...</span>
            </div>
          ) : error ? (
            <InlineAlert>{error}</InlineAlert>
          ) : equipment ? (
            <>
              <div className="qr-landing-uid">{uid}</div>
              <div className="qr-landing-name">{equipment.name}</div>
              {equipment.brand && (
                <div className="qr-landing-detail">{equipment.brand}{equipment.model ? ` — ${equipment.model}` : ''}</div>
              )}
              {status && (
                <div className="qr-landing-status" style={{ color: status.color }}>
                  {status.icon} {status.label}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Action buttons */}
        <div className="qr-landing-actions">
          <Button variant="ghost"             className="qr-landing-btn qr-landing-btn-equipment"
            onClick={onGoToEquipment}
            disabled={loading || !!error}
          >
            <Package size={22} />
            <span>Aller au matériel</span>
            <ArrowRight size={18} />
          </Button>

          <Button variant="ghost"             className="qr-landing-btn qr-landing-btn-home"
            onClick={onGoHome}
          >
            <Home size={22} />
            <span>Accueil eM@g</span>
            <ArrowRight size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MobileQRLanding;
