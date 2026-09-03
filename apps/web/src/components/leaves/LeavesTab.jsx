// ═══════════════════════════════════════════════════════════════
// ONGLET CONGÉS & ABSENCES — Module complet
// Vue salarié: solde + historique + nouvelle demande
// Vue admin: validations en attente + team overview + stats + soldes
// Conforme Code du travail, IDCC 3252
// ═══════════════════════════════════════════════════════════════

import './LeavesTab.css';

import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BarChart3,
  Calendar,
  CalendarOff,
  CheckCircle,
  Clock,
  Eye,
  Plus,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button, Card, InlineAlert, SectionHeader, Tooltip } from '@/design-system';

import { STATUS } from '../../constants';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useRefreshSubscription } from '../../hooks/useRefreshSubscription';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import { sanitizePrintHtml } from '../../utils/safePrintWindow';
import { usePrintPreview } from '../ui/PrintPreviewProvider';
import LeaveAdminOverview from './LeaveAdminOverview';
import LeaveRequestForm from './LeaveRequestForm';
import LeaveRequestsList from './LeaveRequestsList';
import LeaveRequestsPanel from './LeaveRequestsPanel';
import LeaveValidationPanel from './LeaveValidationPanel';

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

const _fmtDate = (d) => {
  if (!d) return '—';
  try {
    return format(parseISO(d), 'd MMM yyyy', { locale: fr });
  } catch {
    return d;
  }
};

const fmtShortDate = (d) => {
  if (!d) return '—';
  try {
    return format(parseISO(d), 'd MMM', { locale: fr });
  } catch {
    return d;
  }
};

// ═══════════════════════════════════════
// Composant principal
// ═══════════════════════════════════════

const LeavesTab = ({ persons = [], currentUser }) => {
  const isAdmin = !!currentUser?.isAdmin;
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const printPreview = usePrintPreview();

  // Data state
  const [myRequests, setMyRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [myBalance, setMyBalance] = useState(null);
  const [stats, setStats] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI state
  const [adminView, setAdminView] = useState(isAdmin ? 'overview' : 'mine');
  const [requestFilter, setRequestFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  // Modal state
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(null); // { personId }

  // ═══════════════════════════════════════
  // Chargement des données
  // ═══════════════════════════════════════

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const promises = [
        api.getMyLeaves().catch(() => []),
        api.getPublicHolidays(new Date().getFullYear()).catch(() => []),
      ];

      if (isAdmin) {
        promises.push(
          api.getPendingLeaves().catch(() => []),
          api.getAllLeaves().catch(() => []),
          api.getLeaveBalances({ year: new Date().getFullYear() }).catch(() => []),
          api.getLeaveStats(new Date().getFullYear()).catch(() => null),
        );
      }

      const results = await Promise.all(promises);
      setMyRequests(results[0] || []);
      setHolidays(results[1] || []);

      if (isAdmin) {
        setPendingRequests(results[2] || []);
        setAllRequests(results[3] || []);
        const balancesData = results[4];
        setBalances(Array.isArray(balancesData) ? balancesData : []);
        setStats(results[5]);
      }

      // Charger le solde perso
      if (currentUser?.personId) {
        try {
          const bal = await api.getLeaveBalances({
            personId: currentUser.personId,
            year: new Date().getFullYear(),
          });
          setMyBalance(Array.isArray(bal) ? bal[0] : bal);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.error('[LeavesTab] Erreur chargement:', err);
      setError('Impossible de charger les données.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh quand les congés changent ailleurs (validation, mobile, etc.)
  useRefreshSubscription('leaves', loadData);

  // ═══════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════

  const myStats = useMemo(
    () => ({
      total: myRequests.length,
      pending: myRequests.filter((r) => r.status === STATUS.PENDING).length,
      accepted: myRequests.filter((r) => r.status === STATUS.ACCEPTED || r.status === 'modified')
        .length,
      refused: myRequests.filter((r) => r.status === STATUS.REFUSED).length,
    }),
    [myRequests],
  );

  const filteredRequests = useMemo(() => {
    const source = adminView === 'all' ? allRequests : myRequests;
    if (requestFilter === 'all') return source;
    return source.filter((r) => r.status === requestFilter);
  }, [adminView, allRequests, myRequests, requestFilter]);

  // Qui est en congé ce mois-ci ? (admin)
  const teamCalendar = useMemo(() => {
    if (!isAdmin || !allRequests.length) return [];
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    return allRequests
      .filter((r) => {
        if (r.status !== STATUS.ACCEPTED && r.status !== 'modified') return false;
        const start = parseISO(r.start_date || r.startDate);
        const end = parseISO(r.end_date || r.endDate);
        return start <= monthEnd && end >= monthStart;
      })
      .sort((a, b) => (a.start_date || a.startDate).localeCompare(b.start_date || b.startDate));
  }, [isAdmin, allRequests]);

  // ═══════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════

  const handleCancel = (id) => {
    confirm({
      title: 'Annuler la demande',
      message: 'Annuler cette demande de congé ?',
      variant: 'danger',
      confirmLabel: 'Annuler le congé',
      onConfirm: async () => {
        try {
          await api.cancelLeave(id);
          refreshBus.publish('leaves');
          setCancellingId(null);
          loadData();
          toast.success('Demande annulée.');
        } catch (err) {
          const message = err.error || err.message || "Impossible d'annuler la demande.";
          setError(message);
          toast.error(message);
        }
      },
    });
  };

  const handleDownloadPdf = async (id) => {
    try {
      const data = await api.getLeavePdf(id);
      if (data.html) {
        printPreview.showHtml(sanitizePrintHtml(data.html), {
          title: 'Demande de congés',
          filename: `conge-${id}.html`,
        });
      }
    } catch {
      setError('Impossible de générer le PDF.');
      toast.error('Impossible de générer le PDF.');
    }
  };

  // ═══════════════════════════════════════
  // Render
  // ═══════════════════════════════════════

  if (loading) {
    return (
      <div className="lt-loading">
        <Clock size={24} />
        <span>Chargement du module congés…</span>
      </div>
    );
  }

  return (
    <div className="lt-container">
      {/* En-tête */}
      <div className="lt-header">
        <div className="lt-header-left">
          <CalendarOff size={20} />
          <h2>Congés & Absences</h2>
          {isAdmin && pendingRequests.length > 0 && (
            <span className="lt-pending-badge">{pendingRequests.length}</span>
          )}
        </div>
        <div className="lt-header-actions">
          <Tooltip content="Rafraîchir">
            <Button variant="ghost" className="lt-btn lt-btn-refresh" onClick={loadData}>
              <RefreshCw size={16} />
            </Button>
          </Tooltip>
          <Button variant="primary" onClick={() => setShowRequestForm(true)}>
            <Plus size={16} /> Nouvelle demande
          </Button>
        </div>
      </div>

      {error && (
        <InlineAlert dismissible onDismiss={() => setError('')}>
          {error}
        </InlineAlert>
      )}

      {/* KPI Cards */}
      <div className="lt-kpi-row">
        {/* Solde personnel */}
        <Card className="lt-kpi-card balance">
          <div className="lt-kpi-icon">🏖️</div>
          <div className="lt-kpi-data">
            <span className="lt-kpi-value">
              {myBalance
                ? (myBalance.daysEntitled || myBalance.days_entitled || 25) -
                  (myBalance.daysTaken || myBalance.days_taken || 0)
                : '—'}
            </span>
            <span className="lt-kpi-label">jours restants</span>
          </div>
          {myBalance && (
            <div className="lt-kpi-detail">
              {myBalance.daysEntitled || myBalance.days_entitled || 25} acquis ·{' '}
              {myBalance.daysTaken || myBalance.days_taken || 0} pris
            </div>
          )}
        </Card>

        {/* En attente */}
        <Card className="lt-kpi-card pending">
          <div className="lt-kpi-icon">
            <Clock size={20} />
          </div>
          <div className="lt-kpi-data">
            <span className="lt-kpi-value">{myStats.pending}</span>
            <span className="lt-kpi-label">en attente</span>
          </div>
        </Card>

        {/* Acceptées */}
        <Card className="lt-kpi-card accepted">
          <div className="lt-kpi-icon">
            <CheckCircle size={20} />
          </div>
          <div className="lt-kpi-data">
            <span className="lt-kpi-value">{myStats.accepted}</span>
            <span className="lt-kpi-label">acceptées</span>
          </div>
        </Card>

        {/* Admin : En attente de validation */}
        {isAdmin && (
          <Card className="lt-kpi-card admin-pending" onClick={() => setShowValidationPanel(true)}>
            <div className="lt-kpi-icon">
              <Shield size={20} />
            </div>
            <div className="lt-kpi-data">
              <span className="lt-kpi-value">{pendingRequests.length}</span>
              <span className="lt-kpi-label">à valider</span>
            </div>
            <div className="lt-kpi-action">
              <Eye size={14} /> Traiter
            </div>
          </Card>
        )}
      </div>

      {/* Navigation admin */}
      {isAdmin && (
        <div className="lt-admin-nav">
          <Button
            variant="ghost"
            className={`lt-nav-btn ${adminView === 'overview' ? 'active' : ''}`}
            onClick={() => setAdminView('overview')}
          >
            <BarChart3 size={14} /> Vue d'ensemble
          </Button>
          <Button
            variant="ghost"
            className={`lt-nav-btn ${adminView === 'mine' ? 'active' : ''}`}
            onClick={() => setAdminView('mine')}
          >
            <Calendar size={14} /> Mes congés
          </Button>
          <Button
            variant="ghost"
            className={`lt-nav-btn ${adminView === 'all' ? 'active' : ''}`}
            onClick={() => setAdminView('all')}
          >
            <Users size={14} /> Toutes les demandes
          </Button>
        </div>
      )}

      {/* ═══ Vue Admin: Overview ═══ */}
      {isAdmin && adminView === 'overview' && (
        <LeaveAdminOverview
          pendingRequests={pendingRequests}
          teamCalendar={teamCalendar}
          stats={stats}
          balances={balances}
          persons={persons}
          setShowValidationPanel={setShowValidationPanel}
        />
      )}

      {/* ═══ Vue Mes congés / Toutes les demandes ═══ */}
      {(adminView === 'mine' || adminView === 'all' || !isAdmin) && (
        <LeaveRequestsList
          filteredRequests={filteredRequests}
          adminView={adminView}
          requestFilter={requestFilter}
          onFilterChange={setRequestFilter}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          cancellingId={cancellingId}
          setCancellingId={setCancellingId}
          onDownloadPdf={handleDownloadPdf}
          onCancel={handleCancel}
          onNewRequest={() => setShowRequestForm(true)}
        />
      )}

      {/* Jours fériés */}
      {holidays.length > 0 && (adminView === 'mine' || !isAdmin) && (
        <div className="lt-section lt-holidays">
          <SectionHeader
            className="lt-section-header"
            icon={<Calendar size={16} />}
            title={`Jours fériés ${new Date().getFullYear()}`}
          />
          <div className="lt-holidays-list">
            {holidays.map((h, i) => (
              <span key={i} className="lt-holiday-chip">
                {fmtShortDate(h.date)} — {h.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Modales existantes ═══ */}

      {showRequestForm && (
        <LeaveRequestForm
          person={null}
          persons={persons.filter((p) => p.status === STATUS.ACTIVE)}
          isAdmin={isAdmin}
          currentUser={currentUser}
          onClose={() => setShowRequestForm(false)}
          onCreated={() => {
            setShowRequestForm(false);
            loadData();
          }}
        />
      )}

      {showValidationPanel && (
        <LeaveValidationPanel
          onClose={() => setShowValidationPanel(false)}
          onRefresh={() => loadData()}
        />
      )}

      {ConfirmDialogRenderer}
      {showHistoryPanel && (
        <LeaveRequestsPanel
          personId={showHistoryPanel.personId}
          isAdmin={isAdmin}
          onClose={() => setShowHistoryPanel(null)}
          onNewRequest={() => {
            setShowHistoryPanel(null);
            setShowRequestForm(true);
          }}
          onRefresh={() => loadData()}
        />
      )}
    </div>
  );
};

export default LeavesTab;
