import './AffaireDashboard.css';

import { AlertCircle, ArrowRight, Calendar, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Spinner } from '@/design-system';

import { AFFAIRE_STATUS_MAP } from '../../utils/affaireWorkflow';
import api from '../../utils/api';

export default function AffaireDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getAffaireDashboard()
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading)
    return (
      <div className="ad-loading">
        <Spinner size="sm" /> Chargement KPIs...
      </div>
    );
  if (!data) return null;

  const statusEntries = Object.entries(data.byStatus || {});

  return (
    <div className="affaire-dashboard">
      {/* KPI cards */}
      <div className="ad-cards">
        <div className="ad-card">
          <span className="ad-card-value">{data.total}</span>
          <span className="ad-card-label">Total</span>
        </div>
        {statusEntries.map(([status, count]) => {
          const meta = AFFAIRE_STATUS_MAP[status];
          if (!meta) return null;
          return (
            <div key={status} className="ad-card" style={{ borderColor: meta.color }}>
              <span className="ad-card-value" style={{ color: meta.color }}>
                {meta.emoji} {count}
              </span>
              <span className="ad-card-label">{meta.label}</span>
            </div>
          );
        })}
        {data.overdue > 0 && (
          <div className="ad-card ad-card-alert">
            <span className="ad-card-value">
              <AlertCircle size={14} /> {data.overdue}
            </span>
            <span className="ad-card-label">En retard</span>
          </div>
        )}
        {data.upcoming > 0 && (
          <div className="ad-card" style={{ borderColor: '#3b82f6' }}>
            <span className="ad-card-value" style={{ color: '#3b82f6' }}>
              <Calendar size={14} /> {data.upcoming}
            </span>
            <span className="ad-card-label">7 prochains jours</span>
          </div>
        )}
        {data.avgDuration > 0 && (
          <div className="ad-card">
            <span className="ad-card-value">
              <Clock size={14} /> {data.avgDuration}j
            </span>
            <span className="ad-card-label">Durée moy.</span>
          </div>
        )}
      </div>

      {/* Dernières transitions */}
      {data.recentTransitions?.length > 0 && (
        <div className="ad-transitions">
          <h4 className="ad-transitions-title">Dernières transitions</h4>
          <div className="ad-transitions-list">
            {data.recentTransitions.slice(0, 6).map((t) => {
              const from = AFFAIRE_STATUS_MAP[t.from_status];
              const to = AFFAIRE_STATUS_MAP[t.to_status];
              return (
                <div key={t.id} className="ad-transition-item">
                  <span className="ad-t-num">{t.numero_affaire}</span>
                  {from && (
                    <span className="ad-t-badge" style={{ background: from.color, color: '#fff' }}>
                      {from.emoji}
                    </span>
                  )}
                  <ArrowRight size={10} style={{ color: '#999' }} />
                  {to && (
                    <span className="ad-t-badge" style={{ background: to.color, color: '#fff' }}>
                      {to.emoji}
                    </span>
                  )}
                  {t.changed_by_name && <span className="ad-t-user">{t.changed_by_name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
