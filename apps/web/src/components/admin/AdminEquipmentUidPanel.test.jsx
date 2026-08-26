// apps/web/src/components/admin/AdminEquipmentUidPanel.test.jsx
// Ticket : T-P1-06c.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/equipmentUid/fetchEquipmentUidAudit.js', () => ({
  fetchEquipmentUidAuditUnified: vi.fn(),
  regenerateEquipmentUidUnified: vi.fn(),
}));

import {
  fetchEquipmentUidAuditUnified,
  regenerateEquipmentUidUnified,
} from '../../utils/equipmentUid/fetchEquipmentUidAudit.js';
import AdminEquipmentUidPanel from './AdminEquipmentUidPanel.jsx';

const okReport = {
  equipmentTotal: 100,
  equipmentWithUid: 100,
  equipmentWithoutUid: 0,
  equipmentWithSerial: 95,
  duplicateSerials: [],
  duplicateUids: [],
  verdict: 'OK — schema sain',
};

const dirtyReport = {
  equipmentTotal: 100,
  equipmentWithUid: 98,
  equipmentWithoutUid: 2,
  equipmentWithSerial: 95,
  duplicateSerials: [{ serialNumber: 'SN-1', uid: null, count: 2, ids: [1, 2] }],
  duplicateUids: [{ serialNumber: null, uid: 'EMAG-DUP', count: 2, ids: [3, 4] }],
  verdict: '1 doublons serial_number, 1 doublons uid — regenerate + investigation',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('AdminEquipmentUidPanel — flag off', () => {
  it('affiche invitation activation flag et n appelle pas l audit', () => {
    render(<AdminEquipmentUidPanel apiOverride={{}} flagOverride={false} />);
    expect(screen.getByTestId('admin-uid-panel-flag-off')).toBeInTheDocument();
    expect(screen.getByText(/VITE_FEATURE_V2_EQUIPMENT_UID/)).toBeInTheDocument();
    expect(fetchEquipmentUidAuditUnified).not.toHaveBeenCalled();
  });
});

describe('AdminEquipmentUidPanel — flag on, audit OK', () => {
  it('affiche le rapport avec verdict OK + zero doublons', async () => {
    fetchEquipmentUidAuditUnified.mockResolvedValue(okReport);
    render(<AdminEquipmentUidPanel apiOverride={{}} flagOverride />);
    await waitFor(() => expect(screen.getByTestId('admin-uid-panel-report')).toBeInTheDocument());
    // Total (100) et Avec UID (100) partagent la valeur
    expect(screen.getAllByText('100')).toHaveLength(2);
    // 2 occurrences de "OK" : badge (span) + prefix du verdict textuel
    expect(screen.getAllByText(/OK/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Aucun doublon detecte/i)).toHaveLength(2);
  });
});

describe('AdminEquipmentUidPanel — flag on, doublons detectes', () => {
  it('affiche les tables doublons serial + uid + boutons regen', async () => {
    fetchEquipmentUidAuditUnified.mockResolvedValue(dirtyReport);
    render(<AdminEquipmentUidPanel apiOverride={{}} flagOverride />);
    await waitFor(() => expect(screen.getByTestId('admin-uid-panel-report')).toBeInTheDocument());
    expect(screen.getByText('SN-1')).toBeInTheDocument();
    expect(screen.getByText('EMAG-DUP')).toBeInTheDocument();
    expect(screen.getByTestId('regen-btn-3')).toBeInTheDocument();
    expect(screen.getByTestId('regen-btn-4')).toBeInTheDocument();
    // A corriger badge
    expect(screen.getByText(/A corriger/)).toBeInTheDocument();
  });

  it('handleRegenerate: appelle helper puis recharge audit', async () => {
    fetchEquipmentUidAuditUnified.mockResolvedValueOnce(dirtyReport);
    fetchEquipmentUidAuditUnified.mockResolvedValueOnce(okReport);
    regenerateEquipmentUidUnified.mockResolvedValue({
      equipmentId: 3,
      previousUid: 'EMAG-DUP',
      newUid: 'EMAG-NEW',
      regeneratedBy: null,
      regeneratedAt: '2026-07-10T10:00:00Z',
    });
    render(<AdminEquipmentUidPanel apiOverride={{}} flagOverride />);
    await waitFor(() => expect(screen.getByTestId('regen-btn-3')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('regen-btn-3'));
    await waitFor(() =>
      expect(regenerateEquipmentUidUnified).toHaveBeenCalledWith({}, 3, {
        reason: 'admin-panel-regen',
        useV2: true,
      }),
    );
    // Audit recharge -> report devient OK -> les 2 "Aucun doublon detecte"
    await waitFor(() => expect(screen.getAllByText(/Aucun doublon detecte/i)).toHaveLength(2));
  });

  it('handleRegenerate: null -> affiche message erreur en dessous du bouton', async () => {
    fetchEquipmentUidAuditUnified.mockResolvedValue(dirtyReport);
    regenerateEquipmentUidUnified.mockResolvedValue(null);
    render(<AdminEquipmentUidPanel apiOverride={{}} flagOverride />);
    await waitFor(() => expect(screen.getByTestId('regen-btn-4')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('regen-btn-4'));
    await waitFor(() =>
      expect(screen.getByText(/Regeneration echouee \(#4\)/)).toBeInTheDocument(),
    );
  });
});

describe('AdminEquipmentUidPanel — audit indisponible', () => {
  it('affiche message erreur + bouton reessayer', async () => {
    fetchEquipmentUidAuditUnified.mockResolvedValue(null);
    render(<AdminEquipmentUidPanel apiOverride={{}} flagOverride />);
    await waitFor(() => expect(screen.getByTestId('admin-uid-panel-error')).toBeInTheDocument());
    expect(screen.getByText(/Audit UID indisponible/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reessayer/i })).toBeInTheDocument();
  });

  it('bouton Reessayer relance loadAudit', async () => {
    fetchEquipmentUidAuditUnified.mockResolvedValueOnce(null);
    fetchEquipmentUidAuditUnified.mockResolvedValueOnce(okReport);
    render(<AdminEquipmentUidPanel apiOverride={{}} flagOverride />);
    await waitFor(() => expect(screen.getByTestId('admin-uid-panel-error')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Reessayer/i }));
    await waitFor(() => expect(screen.getByTestId('admin-uid-panel-report')).toBeInTheDocument());
    expect(fetchEquipmentUidAuditUnified).toHaveBeenCalledTimes(2);
  });
});
