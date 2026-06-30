import { Calendar, Clock, Shield, TrendingUp, Users, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Button, Card, SectionHeader, Tooltip } from '@/design-system';

import { LEAVE_TYPE_LABELS } from './leaveConstants';

// ═══════════════════════════════════════
// Admin Overview View
// Displays: pending validations, team calendar, statistics, team balances
// ═══════════════════════════════════════

const fmtShortDate = (d) => {
  if (!d) return '—';
  try {
    return format(new Date(d), 'd MMM', { locale: fr });
  } catch {
    return d;
  }
};

export const LeaveAdminOverview = ({
  pendingRequests = [],
  teamCalendar = [],
  stats = null,
  balances = [],
  persons = [],
  setShowValidationPanel,
}) => {
  return (
    <div className="lt-overview">
      {/* Demandes en attente de validation */}
      {pendingRequests.length > 0 && (
        <div className="lt-section">
          <SectionHeader
            className="lt-section-header"
            icon={<Clock size={16} />}
            title={`Demandes en attente (${pendingRequests.length})`}
            actions={
              <Button variant="secondary" size="sm" onClick={() => setShowValidationPanel(true)}>
                Ouvrir panneau complet
              </Button>
            }
          />
          <div className="lt-pending-list">
            {pendingRequests.slice(0, 5).map((req) => {
              const typeCfg =
                LEAVE_TYPE_LABELS[req.leave_type || req.leaveType] || LEAVE_TYPE_LABELS.conge_paye;
              return (
                <div key={req.id} className="lt-pending-card">
                  <div className="lt-pending-person">
                    {req.first_name || req.firstName} {req.last_name || req.lastName}
                  </div>
                  <div className="lt-pending-info">
                    <span className="lt-pending-type" style={{ color: typeCfg.color }}>
                      {typeCfg.icon} {typeCfg.label}
                    </span>
                    <span className="lt-pending-dates">
                      {fmtShortDate(req.start_date || req.startDate)} →{' '}
                      {fmtShortDate(req.end_date || req.endDate)}
                    </span>
                    <span className="lt-pending-days">{req.working_days || req.workingDays}j</span>
                  </div>
                  {req.priority_score > 0 && (
                    <Tooltip content="Priorité" position="bottom">
                      <span className="lt-priority-badge">P{req.priority_score}</span>
                    </Tooltip>
                  )}
                </div>
              );
            })}
            {pendingRequests.length > 5 && (
              <Button
                variant="ghost"
                className="lt-btn lt-btn-link"
                onClick={() => setShowValidationPanel(true)}
              >
                Voir les {pendingRequests.length - 5} autres…
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Absences du mois */}
      <div className="lt-section">
        <SectionHeader
          className="lt-section-header"
          icon={<Calendar size={16} />}
          title={`Absences du mois — ${format(new Date(), 'MMMM yyyy', { locale: fr })}`}
        />
        {teamCalendar.length === 0 ? (
          <div className="lt-empty-section">
            <span>✓ Aucune absence prévue ce mois-ci</span>
          </div>
        ) : (
          <div className="lt-team-calendar">
            {teamCalendar.map((req) => {
              const typeCfg =
                LEAVE_TYPE_LABELS[req.leave_type || req.leaveType] || LEAVE_TYPE_LABELS.conge_paye;
              return (
                <div key={req.id} className="lt-team-row">
                  <div className="lt-team-person">
                    {req.first_name || req.firstName} {req.last_name || req.lastName}
                  </div>
                  <div className="lt-team-type" style={{ color: typeCfg.color }}>
                    {typeCfg.icon} {typeCfg.label}
                  </div>
                  <div className="lt-team-dates">
                    {fmtShortDate(req.start_date || req.startDate)} →{' '}
                    {fmtShortDate(req.end_date || req.endDate)}
                  </div>
                  <div className="lt-team-days">
                    {req.working_days || req.workingDays} jour
                    {(req.working_days || req.workingDays) > 1 ? 's' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="lt-section">
          <SectionHeader
            className="lt-section-header"
            icon={<TrendingUp size={16} />}
            title={`Statistiques ${new Date().getFullYear()}`}
          />
          <div className="lt-stats-grid">
            {stats.byType &&
              Object.entries(stats.byType).map(([type, count]) => {
                const cfg = LEAVE_TYPE_LABELS[type] || {
                  label: type,
                  icon: '📋',
                  color: 'var(--theme-text-gray)',
                };
                return (
                  <div key={type} className="lt-stat-card">
                    <span className="lt-stat-icon">{cfg.icon}</span>
                    <span className="lt-stat-count">{count}</span>
                    <span className="lt-stat-label">{cfg.label}</span>
                  </div>
                );
              })}
          </div>
          {stats.byMonth && (
            <div className="lt-stats-months">
              <div className="lt-month-chart">
                {Object.entries(stats.byMonth).map(([month, count]) => {
                  const maxCount = Math.max(...Object.values(stats.byMonth), 1);
                  const height = (count / maxCount) * 100;
                  return (
                    <div
                      key={month}
                      className="lt-month-bar"
                      title={`${month}: ${count} demande${count > 1 ? 's' : ''}`}
                    >
                      <div className="lt-month-bar-fill" style={{ height: `${height}%` }} />
                      <span className="lt-month-label">{month.slice(0, 3)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Soldes de l'équipe */}
      {balances.length > 0 && (
        <div className="lt-section">
          <SectionHeader
            className="lt-section-header"
            icon={<Users size={16} />}
            title="Soldes de l'équipe"
          />
          <div className="lt-balances-table">
            <div className="lt-balances-header">
              <span>Collaborateur</span>
              <span>Acquis</span>
              <span>Pris</span>
              <span>Restant</span>
            </div>
            {balances.map((b, i) => {
              const entitled = b.daysEntitled || b.days_entitled || 25;
              const taken = b.daysTaken || b.days_taken || 0;
              const remaining = entitled - taken;
              const person = persons.find((p) => p.id === (b.personId || b.person_id));
              return (
                <div key={i} className={`lt-balances-row ${remaining <= 5 ? 'low' : ''}`}>
                  <span className="lt-balance-name">
                    {person
                      ? `${person.firstName} ${person.lastName}`
                      : `#${b.personId || b.person_id}`}
                  </span>
                  <span className="lt-balance-num">{entitled}</span>
                  <span className="lt-balance-num">{taken}</span>
                  <span className={`lt-balance-num remaining ${remaining <= 5 ? 'warning' : ''}`}>
                    {remaining}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveAdminOverview;
