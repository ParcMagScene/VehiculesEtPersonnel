/**
 * ImportsHubModal — Point d'entree centralise pour tous les imports
 * (PDF + CSV) de l'application : Affaires, Catalogues, Stocks, Controles,
 * Vehicules, Personnel.
 *
 * Architecture :
 *   - Le hub n'embarque AUCUNE logique de parsing ; il se contente de lancer
 *     les modals d'import existants (lazy-loades) ou d'afficher "Bientot
 *     disponible" pour les categories non encore implementees.
 *   - Une seule modale d'import est active a la fois.
 *
 * Lots futurs :
 *   - L5 : brancher AffaireImportModal, BLImportLocPrestaModal
 *   - L6 : creer modale catalogues fournisseurs / interne (CSV)
 *   - L7 : brancher EquipmentImportModal, LocmatImportModal (stocks)
 *   - L8 : brancher PvImportPanel (PV controles)
 *   - L9 : creer modale CT vehicules (PDF)
 */
import './ImportsHubModal.css';

import {
  Briefcase,
  ClipboardCheck,
  FileText,
  Layers,
  Package,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';

import { Button, Modal, ModalBody, ModalHeader } from '@/design-system';

const BLMultiImportModal = lazy(() => import('../affaires/BLMultiImportModal'));
const PersonnelImportModal = lazy(() => import('../personnel/PersonnelImportModal'));

/**
 * Definition declarative des categories. Chaque entree definit :
 *   - id : cle unique
 *   - label / description / icon
 *   - items : sous-imports avec un handler `launch` (renvoie un id de modal)
 *     ou `comingSoon: true`.
 */
function buildSections() {
  return [
    {
      id: 'affaires',
      label: 'Affaires',
      icon: Briefcase,
      description: 'Bons de livraison, bons de preparation, commandes fournisseurs.',
      items: [
        { id: 'bl-bp', label: 'Import BL / BP (PDF)', target: 'bl-multi' },
        { id: 'cmd-fourn', label: 'Commandes fournisseurs (PDF)', comingSoon: true },
        { id: 'demandes', label: 'Demandes clients (CSV)', comingSoon: true },
      ],
    },
    {
      id: 'catalogues',
      label: 'Catalogues',
      icon: Layers,
      description: 'References produits fournisseurs et internes.',
      items: [
        { id: 'cat-fourn', label: 'Catalogue fournisseurs (CSV)', comingSoon: true },
        { id: 'cat-interne', label: 'Catalogue interne (CSV)', comingSoon: true },
      ],
    },
    {
      id: 'stocks',
      label: 'Stocks',
      icon: Package,
      description: 'Inventaires et fiches equipements (UID, QR codes).',
      items: [
        { id: 'inventaires', label: 'Inventaires (CSV)', comingSoon: true },
        { id: 'equipements', label: 'Equipements (CSV)', comingSoon: true },
      ],
    },
    {
      id: 'controles',
      label: 'Controles',
      icon: ShieldCheck,
      description: 'PV de controle (elingues, EPI, levage, electrique).',
      items: [{ id: 'pv-controles', label: 'PV de controle (PDF)', comingSoon: true }],
    },
    {
      id: 'vehicules',
      label: 'Vehicules',
      icon: Truck,
      description: 'Controles techniques et maintenance.',
      items: [{ id: 'ct-vehicules', label: 'Controle technique (PDF)', comingSoon: true }],
    },
    {
      id: 'personnel',
      label: 'Personnel',
      icon: Users,
      description: 'Fiches personnel et donnees RH.',
      items: [{ id: 'personnel-csv', label: 'Personnel (CSV)', target: 'personnel' }],
    },
  ];
}

function ImportsHubModal({ onClose, onImported }) {
  const [activeImport, setActiveImport] = useState(null);
  const sections = useMemo(() => buildSections(), []);

  const closeChild = () => setActiveImport(null);
  const handleChildImported = (...args) => {
    closeChild();
    onImported?.(...args);
  };

  // Quand une modale enfant est ouverte, on masque visuellement le hub
  // (mais on le garde monte pour conserver l'etat). Une seule modale active
  // a la fois pour ne pas empiler les overlays.
  return (
    <>
      <Modal open={!activeImport} onClose={onClose} size="lg" className="imports-hub-modal">
        <ModalHeader onClose={onClose}>
          <div className="imports-hub-title">
            <FileText size={20} />
            <span>Imports &amp; Documents</span>
          </div>
        </ModalHeader>
        <ModalBody>
          <p className="imports-hub-intro">
            Selectionnez le type d&apos;import a effectuer. Les categories grisees seront
            disponibles dans une prochaine version.
          </p>
          <div className="imports-hub-grid">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <div key={section.id} className="imports-hub-section">
                  <div className="imports-hub-section-header">
                    <Icon size={18} />
                    <div>
                      <h3>{section.label}</h3>
                      <p>{section.description}</p>
                    </div>
                  </div>
                  <ul className="imports-hub-items">
                    {section.items.map((item) => {
                      const disabled = !!item.comingSoon;
                      return (
                        <li key={item.id}>
                          <Button
                            variant={disabled ? 'ghost' : 'secondary'}
                            disabled={disabled}
                            className="imports-hub-item-btn"
                            onClick={() => !disabled && setActiveImport(item.target)}
                            title={disabled ? 'Bientot disponible' : item.label}
                          >
                            <ClipboardCheck size={14} />
                            <span>{item.label}</span>
                            {disabled && <span className="imports-hub-soon">Bientot</span>}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </ModalBody>
      </Modal>

      {activeImport === 'bl-multi' && (
        <Suspense fallback={null}>
          <BLMultiImportModal onClose={closeChild} onImported={handleChildImported} />
        </Suspense>
      )}
      {activeImport === 'personnel' && (
        <Suspense fallback={null}>
          <PersonnelImportModal onClose={closeChild} onImportDone={handleChildImported} />
        </Suspense>
      )}
    </>
  );
}

export default ImportsHubModal;
