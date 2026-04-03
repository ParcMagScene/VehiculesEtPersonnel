import React, { useState, useEffect } from 'react';
import { Package, Home, ArrowRight } from 'lucide-react';
import api from '../../utils/api';
import { Spinner, InlineAlert } from '@/design-system';
import './MobileQRLanding.css';

// ═══ PAGE D'ATTERRISSAGE QR — CHOIX MATÉRIEL OU ACCUEIL ═══
// Affiché quand un utilisateur scanne le QR code d'un équipement
// Propose : "Aller au matériel" ou "Accueil eM@g"

const EQUIPMENT_STATUS = {
  available: { label: 'Disponible', color: '#10b981', icon: '✅' },
  in_use: { label: 'En service', color: '#3b82f6', icon: '🔄' },
  maintenance: { label: 'En maintenance', color: '#f59e0b', icon: '🔧' },
  retired: { label: 'Réformé', color: 'var(--theme-text-gray)', icon: '⛔' },
};

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
          <button
            className="qr-landing-btn qr-landing-btn-equipment"
            onClick={onGoToEquipment}
            disabled={loading || !!error}
          >
            <Package size={22} />
            <span>Aller au matériel</span>
            <ArrowRight size={18} />
          </button>

          <button
            className="qr-landing-btn qr-landing-btn-home"
            onClick={onGoHome}
          >
            <Home size={22} />
            <span>Accueil eM@g</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobileQRLanding;
