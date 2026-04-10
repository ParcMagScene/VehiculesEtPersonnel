import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}}>
        <ModalBody>Contenu</ModalBody>
      </Modal>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders content when open', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <ModalBody>Contenu visible</ModalBody>
      </Modal>
    );
    expect(screen.getByText('Contenu visible')).toBeInTheDocument();
  });

  it('has role="dialog" and aria-modal', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <ModalBody>Test</ModalBody>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('applies size class', () => {
    render(
      <Modal open={true} onClose={() => {}} size="lg">
        <ModalBody>Large</ModalBody>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toHaveClass('ui-modal--lg');
  });

  it('calls onClose on Escape key', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose}>
        <ModalBody>Escape test</ModalBody>
      </Modal>
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('ModalHeader', () => {
  it('renders title text', () => {
    render(<ModalHeader>Mon titre</ModalHeader>);
    expect(screen.getByText('Mon titre')).toBeInTheDocument();
  });

  it('renders close button when onClose provided', () => {
    render(<ModalHeader onClose={() => {}}>Titre</ModalHeader>);
    expect(screen.getByLabelText('Fermer')).toBeInTheDocument();
  });

  it('does not render close button without onClose', () => {
    render(<ModalHeader>Titre</ModalHeader>);
    expect(screen.queryByLabelText('Fermer')).not.toBeInTheDocument();
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ModalHeader onClose={onClose}>Titre</ModalHeader>);
    await user.click(screen.getByLabelText('Fermer'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('ModalBody', () => {
  it('renders children', () => {
    render(<ModalBody>Corps du modal</ModalBody>);
    expect(screen.getByText('Corps du modal')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ModalBody className="custom">Test</ModalBody>);
    expect(container.firstChild).toHaveClass('ui-modal-body', 'custom');
  });
});

describe('ModalFooter', () => {
  it('renders children', () => {
    render(<ModalFooter><button>OK</button></ModalFooter>);
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('applies align class', () => {
    const { container } = render(<ModalFooter align="center">Test</ModalFooter>);
    expect(container.firstChild).toHaveClass('ui-modal-footer--center');
  });
});
