import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui';
import './ModalLayout.css';

/**
 * ModalLayout — Wrapper obligatoire pour tous les modaux.
 * Composé à partir de Modal + structure standardisée (header/body/footer).
 *
 * Usage :
 *   <ModalLayout
 *     open={isOpen}
 *     onClose={handleClose}
 *     title="Modifier véhicule"
 *     icon={<Car />}
 *     size="lg"
 *     footer={
 *       <>
 *         <Button variant="secondary" onClick={handleClose}>Annuler</Button>
 *         <Button onClick={handleSave}>Enregistrer</Button>
 *       </>
 *     }
 *   >
 *     ...formulaire...
 *   </ModalLayout>
 */
function ModalLayout({
  open,
  onClose,
  title,
  icon,
  size = 'md',
  footer,
  footerAlign = 'end',
  className = '',
  bodyClassName = '',
  children,
}) {
  const cls = ['ui-modal-layout', className].filter(Boolean).join(' ');

  return (
    <Modal open={open} onClose={onClose} size={size} className={cls}>
      {title && (
        <ModalHeader icon={icon} onClose={onClose}>
          {title}
        </ModalHeader>
      )}
      <ModalBody className={bodyClassName}>
        {children}
      </ModalBody>
      {footer && (
        <ModalFooter align={footerAlign}>
          {footer}
        </ModalFooter>
      )}
    </Modal>
  );
}

export default ModalLayout;
