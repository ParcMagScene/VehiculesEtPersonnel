import './DashboardPanel.css';

import { addDays, endOfWeek, format, isPast, isToday, startOfDay, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button, Card, SectionHeader, Spinner } from '@/design-system';

import { ROLES, STATUS } from '../../constants';
import api from '../../utils/api';
import logger from '../../utils/logger';

// ═══════════════════════════════════════════════════
// Point 1 — Dashboard global desktop
// Tableau de bord synthétique avec KPIs + activité récente
// ═══════════════════════════════════════════════════

const DashboardPanel = ({
  vehicles = [],
  reservations = [],
  maintenances = [],
  persons = [],
  currentUser,
  onNavigateToModule,
}) => {
  const [stockAlerts, setStockAlerts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [ordersCount, setOrdersCount] = useState({ pending: 0, total: 0 });
  const [affairesCount, setAffairesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const today = useMemo(() => startOfDay(new Date()), []);
  const weekStart = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), [today]);
  const weekEnd = useMemo(() => endOfWeek(today, { weekStartsOn: 1 }), [today]);
  const isAdmin = currentUser?.role === ROLES.ADMIN;

  // Charger les données complémentaires
  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        const results = await Promise.allSettled([
          api.request('/stock/articles?low_stock=true').catch(() => []),
          isAdmin
            ? api.getPendingRequestsCount().catch(() => ({ count: 0 }))
            : Promise.resolve(null),
          api.getOrdersStats().catch(() => null),
          api.request('/affaires').catch(() => []),
        ]);

        // Stock alerts
        const stockData = results[0].status === 'fulfilled' ? results[0].value : [];
        if (Array.isArray(stockData)) {
          setStockAlerts(
            stockData.filter((a) => a.quantity <= (a.alert_threshold || 5)).slice(0, 5),
          );
        }

        // Pending requests
        if (isAdmin) {
          const pendingData = results[1].status === 'fulfilled' ? results[1].value : { count: 0 };
          setPendingRequests(pendingData?.count || pendingData?.total || 0);
        }

        // Orders
        const ordersStatsData = results[2].status === 'fulfilled' ? results[2].value : null;
        const ordersStats = ordersStatsData?.orders;
        if (ordersStats && typeof ordersStats === 'object') {
          const draft = Number(ordersStats.draft || 0);
          const sent = Number(ordersStats.sent || 0);
          const confirmed = Number(ordersStats.confirmed || 0);
          const explicitPending = Number(ordersStats.pending || ordersStats.en_attente || 0);
          setOrdersCount({
            pending: explicitPending || draft + sent + confirmed,
            total: Number(ordersStats.total || 0),
          });
        }

        // Affaires count
        const affairesData = results[3].status === 'fulfilled' ? results[3].value : [];
        if (Array.isArray(affairesData)) {
          setAffairesCount(affairesData.length);
        }
      } catch (err) {
        logger.log('Dashboard: erreur chargement données complémentaires', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [isAdmin]);

  // ─── KPIs calculés ───

  const vehicleStats = useMemo(() => {
    const total = vehicles.length;
    const inMaintenance = maintenances.filter(
      (m) => m.status === 'in_progress' || m.status === STATUS.SCHEDULED,
    ).length;
    const immobilized = maintenances.filter((m) => m.isImmobilized).length;

    // Réservations aujourd'hui
    const todayStr = format(today, 'yyyy-MM-dd');
    const reservedToday = reservations.filter((r) => {
      const start = r.startDate || r.date;
      const end = r.endDate || r.date;
      return start <= todayStr && end >= todayStr;
    }).length;

    return {
      total,
      inMaintenance,
      immobilized,
      reservedToday,
      available: total - reservedToday - immobilized,
    };
  }, [vehicles, maintenances, reservations, today]);

  const maintenanceStats = useMemo(() => {
    const overdue = maintenances.filter((m) => {
      if (m.status === STATUS.COMPLETED || m.status === STATUS.CANCELLED) return false;
      const dueDate = m.scheduledDate || m.dueDate;
      return dueDate && isPast(new Date(dueDate)) && !isToday(new Date(dueDate));
    }).length;

    const upcoming7d = maintenances.filter((m) => {
      if (m.status === STATUS.COMPLETED || m.status === STATUS.CANCELLED) return false;
      const dueDate = m.scheduledDate || m.dueDate;
      if (!dueDate) return false;
      const d = new Date(dueDate);
      return d >= today && d <= addDays(today, 7);
    }).length;

    const reported = maintenances.filter((m) => m.status === 'reported').length;

    return { overdue, upcoming7d, reported, total: maintenances.length };
  }, [maintenances, today]);

  const personnelStats = useMemo(() => {
    return {
      total: persons.length,
      active: persons.filter((p) => p.status === STATUS.ACTIVE || !p.status).length,
    };
  }, [persons]);

  const reservationStats = useMemo(() => {
    const todayStr = format(today, 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

    const todayCount = reservations.filter((r) => {
      const start = r.startDate || r.date;
      const end = r.endDate || r.date;
      return start <= todayStr && end >= todayStr;
    }).length;

    const tomorrowCount = reservations.filter((r) => {
      const start = r.startDate || r.date;
      const end = r.endDate || r.date;
      return start <= tomorrowStr && end >= tomorrowStr;
    }).length;

    const weekCount = reservations.filter((r) => {
      const start = r.startDate || r.date;
      const end = r.endDate || r.date;
      return start <= weekEndStr && end >= format(weekStart, 'yyyy-MM-dd');
    }).length;

    return { todayCount, tomorrowCount, weekCount };
  }, [reservations, today, weekStart, weekEnd]);

  // ─── Activité récente (prochaines réservations + prochaines maintenances) ───

  const upcomingReservations = useMemo(() => {
    const todayStr = format(today, 'yyyy-MM-dd');
    return reservations
      .filter((r) => {
        const end = r.endDate || r.date;
        return end >= todayStr;
      })
      .sort((a, b) => (a.startDate || a.date || '').localeCompare(b.startDate || b.date || ''))
      .slice(0, 6);
  }, [reservations, today]);

  const upcomingMaintenances = useMemo(() => {
    return maintenances
      .filter((m) => m.status !== STATUS.COMPLETED && m.status !== STATUS.CANCELLED)
      .sort((a, b) => {
        const da = a.scheduledDate || a.dueDate || '9999';
        const db = b.scheduledDate || b.dueDate || '9999';
        return da.localeCompare(db);
      })
      .slice(0, 5);
  }, [maintenances]);

  const getVehicleName = useCallback(
    (vehicleId) => {
      const v = vehicles.find((v) => v.id === vehicleId);
      return v ? v.name || `${v.brand} ${v.model}` : `Véhicule #${vehicleId}`;
    },
    [vehicles],
  );

  const getStatusLabel = (status) => {
    const map = {
      reported: 'Signalé',
      scheduled: 'Planifié',
      in_progress: 'En cours',
      completed: 'Terminé',
      cancelled: 'Annulé',
    };
    return map[status] || status;
  };

  const getStatusClass = (status) => {
    const map = {
      reported: 'status-reported',
      scheduled: 'status-scheduled',
      in_progress: 'status-progress',
      completed: 'status-completed',
    };
    return map[status] || '';
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'dd MMM', { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const name = currentUser?.name?.split(' ')[0] || '';
    if (hour < 12) return `Bonjour${name ? ` ${name}` : ''} 👋`;
    if (hour < 18) return `Bon après-midi${name ? ` ${name}` : ''} ☀️`;
    return `Bonsoir${name ? ` ${name}` : ''} 🌙`;
  }, [currentUser]);

  return (
    <div className="dashboard-panel">
      <div className="dashboard-header">
        <div className="dashboard-greeting">
          <h1>{greeting}</h1>
          <p className="dashboard-date">{format(today, 'EEEE d MMMM yyyy', { locale: fr })}</p>
        </div>
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="dashboard-kpi-grid">
        {/* Véhicules */}
        <Card className="kpi-card kpi-vehicles" onClick={() => onNavigateToModule?.('vehicles')}>
          <div className="kpi-icon">🚛</div>
          <div className="kpi-body">
            <div className="kpi-value">{vehicleStats.total}</div>
            <div className="kpi-label">Véhicules</div>
            <div className="kpi-details">
              <span className="kpi-detail good">{vehicleStats.available} dispo</span>
              <span className="kpi-detail info">
                {vehicleStats.reservedToday} réservé{vehicleStats.reservedToday > 1 ? 's' : ''}
              </span>
              {vehicleStats.immobilized > 0 && (
                <span className="kpi-detail danger">{vehicleStats.immobilized} immob.</span>
              )}
            </div>
          </div>
        </Card>

        {/* Réservations */}
        <Card
          className="kpi-card kpi-reservations"
          onClick={() => onNavigateToModule?.('vehicles')}
        >
          <div className="kpi-icon">📅</div>
          <div className="kpi-body">
            <div className="kpi-value">{reservationStats.todayCount}</div>
            <div className="kpi-label">Réservations aujourd'hui</div>
            <div className="kpi-details">
              <span className="kpi-detail info">{reservationStats.tomorrowCount} demain</span>
              <span className="kpi-detail">{reservationStats.weekCount} cette semaine</span>
            </div>
          </div>
        </Card>

        {/* Maintenances */}
        <Card className="kpi-card kpi-maintenance" onClick={() => onNavigateToModule?.('vehicles')}>
          <div className="kpi-icon">🔧</div>
          <div className="kpi-body">
            <div className="kpi-value">{maintenanceStats.upcoming7d}</div>
            <div className="kpi-label">Maintenances à venir (7j)</div>
            <div className="kpi-details">
              {maintenanceStats.overdue > 0 && (
                <span className="kpi-detail danger">{maintenanceStats.overdue} en retard</span>
              )}
              {maintenanceStats.reported > 0 && (
                <span className="kpi-detail warning">
                  {maintenanceStats.reported} signalé{maintenanceStats.reported > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Personnel */}
        <Card className="kpi-card kpi-personnel" onClick={() => onNavigateToModule?.('personnel')}>
          <div className="kpi-icon">👷</div>
          <div className="kpi-body">
            <div className="kpi-value">{personnelStats.total}</div>
            <div className="kpi-label">Personnel actif</div>
          </div>
        </Card>

        {/* Affaires */}
        <Card className="kpi-card kpi-affaires" onClick={() => onNavigateToModule?.('affaires')}>
          <div className="kpi-icon">📂</div>
          <div className="kpi-body">
            <div className="kpi-value">{affairesCount || '—'}</div>
            <div className="kpi-label">Affaires</div>
          </div>
        </Card>

        {/* Commandes */}
        <Card className="kpi-card kpi-orders" onClick={() => onNavigateToModule?.('orders')}>
          <div className="kpi-icon">🛒</div>
          <div className="kpi-body">
            <div className="kpi-value">{ordersCount.pending || 0}</div>
            <div className="kpi-label">Commandes en attente</div>
            <div className="kpi-details">
              <span className="kpi-detail">{ordersCount.total} total</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ═══ Sections détaillées ═══ */}
      <div className="dashboard-sections">
        {/* Prochaines réservations */}
        <div className="dashboard-section">
          <SectionHeader
            className="section-header"
            title="📅 Prochaines réservations"
            actions={
              <Button
                variant="ghost"
                className="section-link"
                onClick={() => onNavigateToModule?.('vehicles')}
              >
                Voir tout →
              </Button>
            }
          />
          <div className="section-body">
            {upcomingReservations.length === 0 ? (
              <p className="empty-text">Aucune réservation à venir</p>
            ) : (
              <div className="reservation-list">
                {upcomingReservations.map((r, i) => {
                  const startDate = r.startDate || r.date;
                  const isCurrentDay = startDate === format(today, 'yyyy-MM-dd');
                  const isTmrw = startDate === format(addDays(today, 1), 'yyyy-MM-dd');
                  return (
                    <div
                      key={r.id || i}
                      className={`reservation-item ${isCurrentDay ? 'today' : ''}`}
                    >
                      <div className="res-date">
                        {isCurrentDay
                          ? "Aujourd'hui"
                          : isTmrw
                            ? 'Demain'
                            : formatDateShort(startDate)}
                      </div>
                      <div className="res-vehicle">{getVehicleName(r.vehicleId)}</div>
                      <div className="res-client">{r.client || r.description || '—'}</div>
                      <div className="res-period">
                        {r.startPeriod === 'morning' ? 'AM' : 'PM'} →{' '}
                        {r.endPeriod === 'afternoon' ? 'PM' : 'AM'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Maintenances en cours / à venir */}
        <div className="dashboard-section">
          <SectionHeader
            className="section-header"
            title="🔧 Maintenances"
            actions={
              <Button
                variant="ghost"
                className="section-link"
                onClick={() => onNavigateToModule?.('vehicles')}
              >
                Voir tout →
              </Button>
            }
          />
          <div className="section-body">
            {upcomingMaintenances.length === 0 ? (
              <p className="empty-text">Aucune maintenance en attente</p>
            ) : (
              <div className="maintenance-list">
                {upcomingMaintenances.map((m, i) => {
                  const dueDate = m.scheduledDate || m.dueDate;
                  const isOverdue =
                    dueDate && isPast(new Date(dueDate)) && !isToday(new Date(dueDate));
                  return (
                    <div
                      key={m.id || i}
                      className={`maintenance-item ${isOverdue ? 'overdue' : ''}`}
                    >
                      <div className="maint-vehicle">{getVehicleName(m.vehicleId)}</div>
                      <div className="maint-type">{m.type || m.maintenanceType || '—'}</div>
                      <div className={`maint-status ${getStatusClass(m.status)}`}>
                        {getStatusLabel(m.status)}
                      </div>
                      <div className="maint-date">
                        {isOverdue && <span className="overdue-badge">⚠️</span>}
                        {formatDateShort(dueDate)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Alertes stock */}
        {stockAlerts.length > 0 && (
          <div className="dashboard-section section-alerts">
            <SectionHeader
              className="section-header"
              title="⚠️ Alertes stock bas"
              actions={
                <Button
                  variant="ghost"
                  className="section-link"
                  onClick={() => onNavigateToModule?.('stock')}
                >
                  Voir le stock →
                </Button>
              }
            />
            <div className="section-body">
              <div className="stock-alert-list">
                {stockAlerts.map((item, i) => (
                  <div key={item.id || i} className="stock-alert-item">
                    <span className="stock-alert-name">{item.name || item.label}</span>
                    <span className="stock-alert-qty danger">
                      {item.quantity} restant{item.quantity > 1 ? 's' : ''}
                    </span>
                    <span className="stock-alert-threshold">
                      seuil : {item.alert_threshold || 5}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Demandes en attente (admin) */}
        {currentUser?.role === ROLES.ADMIN && pendingRequests > 0 && (
          <div className="dashboard-section section-pending">
            <SectionHeader className="section-header" title="📬 Demandes en attente" />
            <div className="section-body">
              <div className="pending-banner">
                <span className="pending-count">{pendingRequests}</span>
                <span>demande{pendingRequests > 1 ? 's' : ''} en attente de validation</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="dashboard-loading-overlay">
          <Spinner size="lg" />
        </div>
      )}
    </div>
  );
};

export default DashboardPanel;
