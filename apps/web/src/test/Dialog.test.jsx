import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Dialog from '../components/ui/Dialog';

describe('Dialog', () => {
  const base = { open: true, onClose: vi.fn(), onConfirm: vi.fn() };

  it('affiche le titre et le message', () => {
    render(
      <Dialog {...base} title="Supprimer ?">
        Êtes-vous sûr ?
      </Dialog>,
    );
    expect(screen.getByText('Supprimer ?')).toBeInTheDocument();
    expect(screen.getByText('Êtes-vous sûr ?')).toBeInTheDocument();
  });

  it('affiche les boutons Confirmer / Annuler par défaut', () => {
    render(
      <Dialog {...base} title="OK ?">
        msg
      </Dialog>,
    );
    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
  });

  it('labels personnalisés', () => {
    render(
      <Dialog {...base} confirmLabel="Oui" cancelLabel="Non">
        msg
      </Dialog>,
    );
    expect(screen.getByRole('button', { name: 'Oui' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Non' })).toBeInTheDocument();
  });

  it('appelle onConfirm au clic', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog {...base} onConfirm={onConfirm}>
        msg
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('appelle onClose au clic Annuler', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog {...base} onClose={onClose}>
        msg
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('hideCancel masque le bouton Annuler', () => {
    render(
      <Dialog {...base} hideCancel>
        msg
      </Dialog>,
    );
    expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument();
  });

  it('variant danger rend le bouton danger', () => {
    render(
      <Dialog {...base} variant="danger">
        msg
      </Dialog>,
    );
    const btn = screen.getByRole('button', { name: 'Confirmer' });
    expect(btn.className).toMatch(/danger/);
  });

  it('loading désactive le bouton Annuler', () => {
    render(
      <Dialog {...base} loading>
        msg
      </Dialog>,
    );
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled();
  });

  it('extraAction affiche un bouton supplémentaire', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog {...base} extraAction={{ label: 'Archiver', onClick }}>
        msg
      </Dialog>,
    );
    const btn = screen.getByRole('button', { name: 'Archiver' });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('ne rend rien si open=false', () => {
    const { container } = render(
      <Dialog {...base} open={false}>
        msg
      </Dialog>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
