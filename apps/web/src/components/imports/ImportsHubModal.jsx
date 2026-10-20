/**
 * ImportsHubModal — Point d'entree centralise pour tous les imports
 * (PDF + CSV) de l'application. Le hub n'embarque AUCUNE logique de
 * parsing : il se contente de lancer les modals d'import existants
 * (lazy-loades). Une seule modale enfant active a la fois.
 *
 * Reste en "Bientot" :
 *   - Catalogues fournisseurs : la modale d'import vit a l'interieur du
 *     panneau Commandes (state local de SupplierCatalogPanel), pas un
 *     composant autonome. Ouvrir le module Commandes pour l'instant.
 *   - CT vehicules : pas de parser PDF dedie a ce jour.
 *   - Commandes fournisseurs / demandes clients : non implemente.
 */
import './ImportsHubModal.css';

import {
  Briefcase,
  ClipboardCheck,
  Contact,
  File,
  FileText,
  Folder,
  FolderOpen,
  Layers,
  Package,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';

import { Button, Modal, ModalBody, ModalHeader } from '@/design-system';

import api, { getApiUrl } from '../../utils/api';

const BLImportModal = lazy(() => import('../affaires/BLImportModal'));
const PersonnelImportModal = lazy(() => import('../personnel/PersonnelImportModal'));
const LocmatImportModal = lazy(() => import('../equipment/import/LocmatImportModal'));
const PvImportPanel = lazy(() => import('../pv-import/PvImportPanel'));
const ContactsCSVImportDialog = lazy(() => import('../annuaire/ContactsCSVImportDialog'));
const SAVManagerModal = lazy(() => import('../sav/SAVManagerModal'));

/**
 * Definition declarative des categories. Chaque entree :
 *   - id, label, description, icon (visuel)
 *   - items[] : { id, label, target | comingSoon }
 * `target` est l'id de la modale enfant a monter.
 */
function buildSections() {
  return [
    {
      id: 'affaires',
      label: 'Affaires',
      icon: Briefcase,
      description: 'Bons de livraison, bons de preparation, locations, prestations.',
      items: [
        {
          id: 'bl-bp',
          label: 'BL / BP — Location, Prestation, Vente (PDF)',
          target: 'bl-import',
        },
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
        { id: 'cat-fourn', label: 'Catalogue fournisseurs (PDF)', comingSoon: true },
        { id: 'cat-interne', label: 'Catalogue interne (CSV)', comingSoon: true },
      ],
    },
    {
      id: 'stocks',
      label: 'Stocks',
      icon: Package,
      description: 'Equipements (UID, QR codes), locations / serialise.',
      items: [{ id: 'locmat', label: 'Locations + Serialise (CSV)', target: 'locmat' }],
    },
    {
      id: 'sav',
      label: 'SAV',
      icon: Wrench,
      description: 'Interventions et tickets SAV (synchronisation LocMat).',
      items: [{ id: 'sav-csv', label: 'Interventions SAV (CSV)', target: 'sav' }],
    },
    {
      id: 'controles',
      label: 'Controles',
      icon: ShieldCheck,
      description: 'PV de controle (elingues, EPI, levage, electrique).',
      items: [{ id: 'pv-controles', label: 'PV de controle (PDF)', target: 'pv' }],
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
    {
      id: 'annuaire',
      label: 'Annuaire',
      icon: Contact,
      description: 'Contacts (clients, fournisseurs, prestataires).',
      items: [{ id: 'contacts-csv', label: 'Contacts (CSV)', target: 'contacts' }],
    },
  ];
}

function ImportsHubModal({ onClose, onImported }) {
  const [activeImport, setActiveImport] = useState(null);
  const [activeFolder, setActiveFolder] = useState(null);
  const [folderPath, setFolderPath] = useState('');
  const [folderEntries, setFolderEntries] = useState([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState('');
  const sections = useMemo(() => buildSections(), []);

  useEffect(() => {
    if (!activeFolder) return undefined;

    let cancelled = false;
    setFolderLoading(true);
    setFolderError('');
    api
      .listImportFolder(activeFolder.id, folderPath)
      .then((result) => {
        if (!cancelled) setFolderEntries(result.entries || []);
      })
      .catch((error) => {
        if (!cancelled) setFolderError(error.message || 'Impossible de charger le dossier.');
      })
      .finally(() => {
        if (!cancelled) setFolderLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFolder, folderPath]);

  const closeChild = () => setActiveImport(null);
  const handleChildImported = (...args) => {
    closeChild();
    onImported?.(...args);
  };

  return (
    <>
      <Modal
        open={!activeImport && !activeFolder}
        onClose={onClose}
        size="lg"
        className="imports-hub-modal"
      >
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
                  <div className="imports-hub-section-top">
                    <div className="imports-hub-section-header">
                      <Icon size={18} />
                      <div>
                        <h3>{section.label}</h3>
                        <p>{section.description}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      className="imports-hub-folder-btn"
                      onClick={() => {
                        setFolderPath('');
                        setActiveFolder(section);
                      }}
                      title={`Ouvrir le dossier ${section.label}`}
                    >
                      <Folder size={14} />
                      <span>Dossier</span>
                    </Button>
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

      <Modal
        open={!!activeFolder}
        onClose={() => setActiveFolder(null)}
        size="lg"
        className="imports-hub-modal imports-hub-folder-modal"
      >
        <ModalHeader onClose={() => setActiveFolder(null)}>
          <div className="imports-hub-title">
            <FolderOpen size={20} />
            <span>Dossier — {activeFolder?.label}</span>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="imports-hub-folder-location">
            {folderPath && (
              <Button
                variant="secondary"
                onClick={() => {
                  const parentPath = folderPath.split('/').slice(0, -1).join('/');
                  setFolderPath(parentPath);
                }}
              >
                Retour
              </Button>
            )}
            <span>{folderPath || 'Dossiers disponibles'}</span>
          </div>
          {folderLoading && <p className="imports-hub-folder-message">Chargement du dossier…</p>}
          {folderError && <p className="imports-hub-folder-error">{folderError}</p>}
          {!folderLoading && !folderError && folderEntries.length === 0 && (
            <p className="imports-hub-folder-message">Ce dossier ne contient aucun fichier.</p>
          )}
          {!folderLoading && !folderError && folderEntries.length > 0 && (
            <ul className="imports-hub-folder-list">
              {folderEntries.map((entry) => {
                const isDirectory = entry.type === 'directory';
                const fileUrl = `${getApiUrl()}/import-folders/${encodeURIComponent(
                  activeFolder.id,
                )}/file?path=${encodeURIComponent(entry.path)}`;
                return (
                  <li key={entry.path}>
                    {isDirectory ? (
                      <Button
                        variant="ghost"
                        className="imports-hub-folder-entry"
                        onClick={() => setFolderPath(entry.path)}
                      >
                        <Folder size={16} />
                        <span>{entry.name}</span>
                      </Button>
                    ) : (
                      <a
                        className="imports-hub-folder-entry"
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <File size={16} />
                        <span>{entry.name}</span>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ModalBody>
      </Modal>

      {activeImport === 'bl-import' && (
        <Suspense fallback={null}>
          <BLImportModal onClose={closeChild} onImported={handleChildImported} />
        </Suspense>
      )}
      {activeImport === 'personnel' && (
        <Suspense fallback={null}>
          <PersonnelImportModal onClose={closeChild} onImportDone={handleChildImported} />
        </Suspense>
      )}
      {activeImport === 'locmat' && (
        <Suspense fallback={null}>
          <LocmatImportModal onClose={closeChild} onDone={handleChildImported} />
        </Suspense>
      )}
      {activeImport === 'pv' && (
        <Suspense fallback={null}>
          <PvImportPanel open onClose={closeChild} />
        </Suspense>
      )}
      {activeImport === 'contacts' && (
        <Suspense fallback={null}>
          <ContactsCSVImportDialog onClose={closeChild} onSuccess={handleChildImported} />
        </Suspense>
      )}
      {activeImport === 'sav' && (
        <Suspense fallback={null}>
          <SAVManagerModal
            onClose={closeChild}
            onImportDone={handleChildImported}
            defaultTab="import"
          />
        </Suspense>
      )}
    </>
  );
}

export default ImportsHubModal;
