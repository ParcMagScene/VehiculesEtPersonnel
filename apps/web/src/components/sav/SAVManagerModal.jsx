/**
 * SAVManagerModal — Conteneur principal du module SAV unifié.
 *
 * Onglets :
 *  - "Import LocMat" : Upload CSV + Preview + Confirm + PDF
 *  - "Tickets"       : Liste filtrée + édition détaillée (modal imbriquée)
 *
 * Cette modal remplace l'ancien `SavImportModal` legacy.
 */
import { Folder, Upload } from 'lucide-react';
import { useState } from 'react';

import { ModalLayout } from '@/design-system';

import SAVImportPreview from './SAVImportPreview';
import SAVImportUpload from './SAVImportUpload';
import SAVTicketDetails from './SAVTicketDetails';
import SAVTicketList from './SAVTicketList';

export default function SAVManagerModal({ onClose, onImportDone, defaultTab = 'import' }) {
  const [tab, setTab] = useState(defaultTab);

  // état import
  const [pendingFile, setPendingFile] = useState(null);
  const [previewResp, setPreviewResp] = useState(null);

  // état liste/détails
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const resetImport = () => {
    setPendingFile(null);
    setPreviewResp(null);
  };

  const handleImportDone = () => {
    resetImport();
    setRefreshKey((k) => k + 1);
    if (onImportDone) onImportDone();
  };

  const tabBtn = (key, label, Icon) => {
    const active = tab === key;
    return (
      <button
        type="button"
        onClick={() => setTab(key)}
        style={{
          padding: '8px 16px',
          border: 'none',
          background: active ? '#fff' : 'transparent',
          borderBottom: '2px solid ' + (active ? '#3b82f6' : 'transparent'),
          color: active ? '#1e40af' : '#64748b',
          fontWeight: active ? 600 : 400,
          cursor: 'pointer',
          fontSize: 13,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Icon size={14} /> {label}
      </button>
    );
  };

  return (
    <>
      <ModalLayout
        open
        onClose={onClose}
        title="Module SAV — Synchronisation LocMat / eM@g"
        size="lg"
      >
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
          {tabBtn('import', 'Import LocMat', Upload)}
          {tabBtn('tickets', 'Tickets SAV', Folder)}
        </div>

        {tab === 'import' && (
          <>
            {!previewResp && (
              <SAVImportUpload
                onPreviewReady={(file, resp) => {
                  setPendingFile(file);
                  setPreviewResp(resp);
                }}
              />
            )}
            {previewResp && (
              <SAVImportPreview
                file={pendingFile}
                previewResp={previewResp}
                onCancel={resetImport}
                onDone={handleImportDone}
              />
            )}
          </>
        )}

        {tab === 'tickets' && (
          <SAVTicketList onSelect={(id) => setSelectedTicket(id)} refreshKey={refreshKey} />
        )}
      </ModalLayout>

      {selectedTicket && (
        <ModalLayout
          open
          onClose={() => setSelectedTicket(null)}
          title={`Ticket SAV #${selectedTicket}`}
          size="lg"
        >
          <SAVTicketDetails
            ticketId={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            onUpdated={() => setRefreshKey((k) => k + 1)}
          />
        </ModalLayout>
      )}
    </>
  );
}
