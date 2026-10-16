import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import VehicleMaintenanceModal from './VehicleMaintenanceModal.jsx';

describe('VehicleMaintenanceModal', () => {
  it('permet de fermer après la sauvegarde réussie d’un contrôle technique', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <VehicleMaintenanceModal
        vehicle={{ id: 1, name: 'Camion', type: 'VL', controlesTechniques: [] }}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText('Type de contrôle'), {
      target: { value: 'VL' },
    });
    fireEvent.change(screen.getByLabelText('Date du dernier contrôle'), {
      target: { value: '2026-10-15' },
    });
    await waitFor(() =>
      expect(screen.getByLabelText('Prochaine échéance')).toHaveValue('2028-10-15'),
    );
    fireEvent.click(screen.getByRole('button', { name: /Ajouter ce contrôle/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText(/Sauvegardé avec succès/i)).toBeInTheDocument();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        controlesTechniques: JSON.stringify([
          { type: 'VL', date: '2026-10-15', deadline: '2028-10-15' },
        ]),
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Modifications non sauvegardées/i)).not.toBeInTheDocument();
  });
});
