import { render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { Modal, ModalBody, ModalHeader } from '../components/ui/Modal';
import { __resetForTests, MODAL_ROOT_ID } from '../utils/modalManager';

afterEach(() => {
  __resetForTests();
  document.getElementById(MODAL_ROOT_ID)?.remove();
  document.body.style.overflow = '';
});

describe('Modal (intégration ModalManager)', () => {
  it('rend le contenu dans #emag-modal-root quand open=true', () => {
    render(
      <Modal open onClose={() => {}}>
        <ModalHeader>Titre</ModalHeader>
        <ModalBody>Contenu</ModalBody>
      </Modal>,
    );
    const root = document.getElementById(MODAL_ROOT_ID);
    expect(root).not.toBeNull();
    expect(root.querySelector('[role="dialog"]')).not.toBeNull();
    expect(root.textContent).toContain('Contenu');
  });

  it("ne rend rien quand open=false (et n'occupe pas le portail)", () => {
    render(
      <Modal open={false} onClose={() => {}}>
        <ModalBody>Caché</ModalBody>
      </Modal>,
    );
    const root = document.getElementById(MODAL_ROOT_ID);
    // Si root absent, c'est OK ; sinon il doit être vide.
    expect(root?.querySelector('[role="dialog"]') ?? null).toBeNull();
  });

  it('verrouille le scroll body et le libère après unmount', () => {
    const { unmount } = render(
      <Modal open onClose={() => {}}>
        <ModalBody>x</ModalBody>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('superpose deux modaux avec des z-index croissants', () => {
    render(
      <>
        <Modal open onClose={() => {}}>
          <ModalBody>A</ModalBody>
        </Modal>
        <Modal open onClose={() => {}}>
          <ModalBody>B</ModalBody>
        </Modal>
      </>,
    );
    const overlays = document.querySelectorAll(`#${MODAL_ROOT_ID} .ui-modal-overlay`);
    expect(overlays.length).toBe(2);
    const z0 = parseInt(overlays[0].style.zIndex, 10);
    const z1 = parseInt(overlays[1].style.zIndex, 10);
    expect(z0).toBe(9000);
    expect(z1).toBe(9010);
  });

  it("appelle onClose quand on clique sur l'overlay", async () => {
    const user = userEvent.setup();
    let closed = false;
    render(
      <Modal
        open
        closeOnBackdrop
        onClose={() => {
          closed = true;
        }}
      >
        <ModalBody>contenu</ModalBody>
      </Modal>,
    );
    const overlay = document.querySelector(`#${MODAL_ROOT_ID} .ui-modal-overlay`);
    await user.click(overlay);
    expect(closed).toBe(true);
  });

  it('ne laisse aucun overlay résiduel après fermeture', () => {
    const { rerender } = render(
      <Modal open onClose={() => {}}>
        <ModalBody>x</ModalBody>
      </Modal>,
    );
    expect(document.querySelectorAll('.ui-modal-overlay').length).toBe(1);
    rerender(
      <Modal open={false} onClose={() => {}}>
        <ModalBody>x</ModalBody>
      </Modal>,
    );
    expect(document.querySelectorAll('.ui-modal-overlay').length).toBe(0);
    expect(document.body.style.overflow).toBe('');
  });
});
