import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Drawer from '../components/ui/Drawer';

describe('Drawer', () => {
  it('ne rend rien si open=false', () => {
    const { container } = render(
      <Drawer open={false} onClose={() => {}}>
        Contenu
      </Drawer>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('rend le contenu quand open=true', async () => {
    render(
      <Drawer open={true} onClose={() => {}}>
        Contenu drawer
      </Drawer>,
    );
    expect(await screen.findByText('Contenu drawer')).toBeInTheDocument();
  });

  it('affiche le titre et le bouton fermer', async () => {
    render(
      <Drawer open={true} onClose={() => {}} title="Détail">
        body
      </Drawer>,
    );
    expect(await screen.findByText('Détail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
  });

  it('appelle onClose au clic sur le bouton fermer', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Drawer open={true} onClose={onClose} title="Détail">
        body
      </Drawer>,
    );
    await user.click(await screen.findByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('affiche le footer', async () => {
    render(
      <Drawer open={true} onClose={() => {}} footer={<span>Pied</span>}>
        body
      </Drawer>,
    );
    expect(await screen.findByText('Pied')).toBeInTheDocument();
  });

  it('côté right par défaut', async () => {
    render(
      <Drawer open={true} onClose={() => {}}>
        body
      </Drawer>,
    );
    const aside = document.querySelector('aside.ui-drawer');
    expect(aside).toHaveClass('ui-drawer--right');
  });

  it('côté left', async () => {
    render(
      <Drawer open={true} onClose={() => {}} side="left">
        body
      </Drawer>,
    );
    const aside = document.querySelector('aside.ui-drawer');
    expect(aside).toHaveClass('ui-drawer--left');
  });

  it('role="dialog" sur l\'aside modal par défaut', async () => {
    render(
      <Drawer open={true} onClose={() => {}}>
        body
      </Drawer>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('role="complementary" en mode inline', async () => {
    render(
      <Drawer open={true} inline={true} onClose={() => {}}>
        body
      </Drawer>,
    );
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });
});
