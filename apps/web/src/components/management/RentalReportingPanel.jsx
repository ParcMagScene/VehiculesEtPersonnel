import './RentalReportingPanel.css';

import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Input, SectionHeader, Select } from '@/design-system';

import { useRefreshSubscription } from '../../hooks/useRefreshSubscription';
import api from '../../utils/api';

const RentalReportingPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('month'); // month, quarter, year, custom
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'custom' && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    const end = format(now, 'yyyy-MM-dd');
    let start;
    if (period === 'month') {
      start = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
    } else if (period === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = format(new Date(now.getFullYear(), qMonth, 1), 'yyyy-MM-dd');
    } else if (period === 'year') {
      start = format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd');
    } else {
      return {};
    }
    return { startDate: start, endDate: end };
  }, [period, customStart, customEnd]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getRentalReporting(dateRange);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    load();
  }, [load]);

  // Reporting réactif aux mutations de commandes/réservations effectuées ailleurs
  useRefreshSubscription('orders', load);
  useRefreshSubscription('reservations', load);

  if (loading && !data) {
    return <div className="rental-reporting-loading">Chargement du reporting...</div>;
  }

  if (!data) {
    return <div className="rental-reporting-empty">Aucune donnée de location disponible.</div>;
  }

  return (
    <div className="rental-reporting-panel">
      {/* Filtres */}
      <div className="rental-reporting-filters">
        <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="month">Ce mois</option>
          <option value="quarter">Ce trimestre</option>
          <option value="year">Cette année</option>
          <option value="custom">Personnalisé</option>
        </Select>
        {period === 'custom' && (
          <div className="rental-reporting-custom-dates">
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span>→</span>
            <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        )}
      </div>

      {/* KPI */}
      <div className="rental-reporting-kpis">
        <div className="rental-kpi">
          <div className="rental-kpi-value">
            {data.totals?.totalRevenue?.toFixed(2) || '0.00'} €
          </div>
          <div className="rental-kpi-label">Chiffre d'affaires</div>
        </div>
        <div className="rental-kpi">
          <div className="rental-kpi-value">{data.totals?.totalReservations || 0}</div>
          <div className="rental-kpi-label">Réservations</div>
        </div>
        <div className="rental-kpi">
          <div className="rental-kpi-value">
            {data.totals?.totalReservations > 0
              ? (data.totals.totalRevenue / data.totals.totalReservations).toFixed(2)
              : '0.00'}{' '}
            €
          </div>
          <div className="rental-kpi-label">Prix moyen</div>
        </div>
        <div className="rental-kpi">
          <div className="rental-kpi-value">{data.totals?.vehicleCount || 0}</div>
          <div className="rental-kpi-label">Véhicules en location</div>
        </div>
      </div>

      {/* CA par véhicule */}
      {data.revenueByVehicle?.length > 0 && (
        <div className="rental-reporting-section">
          <SectionHeader title="💰 CA par véhicule" />
          <table className="rental-reporting-table">
            <thead>
              <tr>
                <th>Véhicule</th>
                <th>Réservations</th>
                <th>CA Total</th>
              </tr>
            </thead>
            <tbody>
              {data.revenueByVehicle.map((rv) => (
                <tr key={rv.id}>
                  <td>
                    <strong>{rv.name}</strong>
                    {rv.registration && <span className="rental-reg"> ({rv.registration})</span>}
                  </td>
                  <td>{rv.reservationCount}</td>
                  <td className="rental-amount">{rv.totalRevenue?.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top clients */}
      {data.topClients?.length > 0 && (
        <div className="rental-reporting-section">
          <SectionHeader title="👥 Top clients" />
          <table className="rental-reporting-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Réservations</th>
                <th>CA Total</th>
              </tr>
            </thead>
            <tbody>
              {data.topClients.map((c, i) => (
                <tr key={i}>
                  <td>{c.clientName || 'Non renseigné'}</td>
                  <td>{c.reservationCount}</td>
                  <td className="rental-amount">{c.totalSpent?.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Taux d'occupation */}
      {data.occupancy && (
        <div className="rental-reporting-section">
          <SectionHeader title="📊 Taux d'occupation" />
          <div className="rental-occupancy-grid">
            {data.occupancy.map((o) => (
              <div key={o.vehicleId} className="rental-occupancy-card">
                <div className="rental-occupancy-name">{o.vehicleName}</div>
                <div className="rental-occupancy-bar-wrap">
                  <div
                    className="rental-occupancy-bar"
                    style={{ width: `${Math.min(o.occupancyRate || 0, 100)}%` }}
                  />
                </div>
                <div className="rental-occupancy-rate">{(o.occupancyRate || 0).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RentalReportingPanel;
