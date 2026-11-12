import './EquipmentReports.css';

import { CheckSquare, FileText, Printer, Square } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button, Checkbox, InlineAlert, Input, Spinner } from '@/design-system';

import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { usePrintPreview } from '../ui/PrintPreviewProvider';
import { buildEquipmentReportHtml, groupEquipmentForReport } from './equipmentReport';

const getQuantity = (item) => Math.max(1, Number(item.stockQuantity ?? item.stock_quantity) || 1);
const equipmentLabel = (item) =>
  [item.uid, item.serialNumber || item.serial_number, item.numeroMag || item.numero_mag]
    .filter(Boolean)
    .join(' · ') || `Équipement #${item.id}`;

export default function EquipmentReports({ equipment }) {
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();
  const printPreview = usePrintPreview();

  const groups = useMemo(() => {
    const searchText = search.trim().toLocaleLowerCase('fr');
    return groupEquipmentForReport(equipment).filter((group) => {
      if (!searchText) return true;
      return [group.reference, group.brand, group.name, ...group.items.map(equipmentLabel)]
        .join(' ')
        .toLocaleLowerCase('fr')
        .includes(searchText);
    });
  }, [equipment, search]);

  const toggleItem = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (items) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = items.every((item) => next.has(item.id));
      for (const item of items) {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  };

  const generateReport = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.getEquipmentReportData([...selectedIds]);
      if (!response?.success)
        throw new Error(response?.error || 'Impossible de générer le rapport');
      if (!response.data?.length) throw new Error('Aucun équipement trouvé dans la sélection');
      const html = buildEquipmentReportHtml(response.data);
      printPreview.showHtml(html, {
        title: 'Rapport des équipements',
        filename: 'rapport-equipements.html',
      });
    } catch (reportError) {
      setError(reportError.message);
      toast.error(`Erreur de génération du rapport : ${reportError.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedQuantity = equipment
    .filter((item) => selectedIds.has(item.id))
    .reduce((sum, item) => sum + getQuantity(item), 0);

  return (
    <section className="eq-reports">
      <header className="eq-reports-header">
        <div>
          <h2>
            <FileText size={20} /> Rapports équipements
          </h2>
          <p>
            Sélectionnez des équipements individuellement ou toute une référence. Le rapport
            regroupe les matériels par référence, marque et nom, avec les relevés et interventions
            de chaque équipement.
          </p>
        </div>
        <div className="eq-reports-actions">
          <Button
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedIds.size === 0 || loading}
          >
            Tout désélectionner
          </Button>
          <Button
            variant="primary"
            onClick={generateReport}
            disabled={selectedIds.size === 0 || loading}
          >
            {loading ? <Spinner size="sm" /> : <Printer size={15} />}
            {loading
              ? 'Préparation…'
              : `Exporter / Imprimer (${selectedIds.size} équipement(s), ${selectedQuantity} unité(s))`}
          </Button>
        </div>
      </header>

      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      <div className="eq-reports-toolbar">
        <Input
          size="sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher une référence, marque, nom, UID…"
          aria-label="Rechercher des équipements pour le rapport"
        />
        <span>{selectedIds.size} équipement(s) sélectionné(s)</span>
      </div>

      {groups.length === 0 ? (
        <p className="eq-reports-empty">Aucun équipement ne correspond à la recherche.</p>
      ) : (
        <div className="eq-report-groups">
          {groups.map((group) => {
            const selectedCount = group.items.filter((item) => selectedIds.has(item.id)).length;
            const isSelected = selectedCount === group.items.length;
            return (
              <section
                className="eq-report-group"
                key={JSON.stringify([group.reference, group.brand, group.name])}
              >
                <header>
                  <Checkbox
                    checked={isSelected}
                    onChange={() => toggleGroup(group.items)}
                    aria-label={`Sélectionner tous les équipements ${group.reference || group.name}`}
                  />
                  <div className="eq-report-group-title">
                    <strong>{group.reference || 'Sans référence'}</strong>
                    <span>
                      {group.brand || 'Marque non renseignée'} · {group.name} ·{' '}
                      {group.items.reduce((sum, item) => sum + getQuantity(item), 0)} unité(s)
                    </span>
                  </div>
                  <Button variant="ghost" onClick={() => toggleGroup(group.items)}>
                    {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                    {isSelected ? 'Désélectionner' : 'Sélectionner la référence'}
                  </Button>
                </header>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleItem(item.id)}
                        aria-label={`Sélectionner ${equipmentLabel(item)}`}
                      />
                      <span>{equipmentLabel(item)}</span>
                      {getQuantity(item) > 1 && <small>Quantité : {getQuantity(item)}</small>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
