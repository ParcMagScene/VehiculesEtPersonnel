import { Eye, MapPin, Package, Star } from 'lucide-react';

import { EmptyState, Table, Tooltip } from '@/design-system';

import { ACCENT_COLORS } from '../../constants/colors';
import { resolveGenericImage } from '../../utils/genericImages';
import { cleanName, EQUIPMENT_STATUS } from './equipmentConstants';
import { findZone, getCategoryHierarchy, matchPhotoToEquipment } from './equipmentUtils';

const EquipmentGrid = ({
  equipment,
  depotZones,
  allDepotZones,
  selectedId,
  photosList,
  _logosList,
  favoriteIds,
  watchIds,
  _onToggleList,
  onSelect,
  onDoubleClick,
  onOpenDepotMap,
  categories,
}) => {
  if (equipment.length === 0) {
    return (
      <EmptyState
        icon={<Package size={48} strokeWidth={1} />}
        title="Aucun matériel trouvé"
        description="Ajoutez votre premier équipement avec le bouton +"
      />
    );
  }

  return (
    <div className="eq-table-wrap">
      <Table className="eq-table">
        <thead>
          <tr>
            <th className="eq-table-th-check"></th>
            <th>Nom</th>
            <th>UID</th>
            <th>Référence</th>
            <th>Catégorie</th>
            <th>Marque</th>
            <th>N° Série</th>
            <th>Qté</th>
            <th>Zone</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {equipment.map((eq) => {
            const st = EQUIPMENT_STATUS[eq.status] || EQUIPMENT_STATUS.available;
            const photo = matchPhotoToEquipment(photosList, eq);
            const hierarchy = categories ? getCategoryHierarchy(eq, categories) : null;
            const genericImg = !photo ? resolveGenericImage(eq, hierarchy) : null;
            const isFav = favoriteIds.has(eq.id);
            const isWatch = watchIds.has(eq.id);
            return (
              <tr
                key={eq.id}
                className={`eq-table-row${selectedId === eq.id ? ' selected' : ''}`}
                onClick={() => onSelect(eq)}
                onDoubleClick={() => onDoubleClick && onDoubleClick(eq)}
              >
                <td className="eq-table-thumb">
                  {photo || genericImg ? (
                    <img
                      src={photo || genericImg}
                      alt=""
                      loading="lazy"
                      className={`eq-table-photo${!photo && genericImg ? ' eq-generic' : ''}`}
                    />
                  ) : (
                    <span className="eq-table-photo-placeholder">
                      {eq.categoryIcon || eq.category_icon || '📦'}
                    </span>
                  )}
                </td>
                <td className="eq-table-name">
                  <div className="eq-table-name-cell">
                    <span>{cleanName(eq.name)}</span>
                    <div className="eq-table-list-icons">
                      {isFav && <Star size={12} className="eq-list-star active" />}
                      {isWatch && <Eye size={12} className="eq-list-eye active" />}
                    </div>
                  </div>
                </td>
                <td className="eq-table-uid">
                  <code>{eq.uid || '—'}</code>
                </td>
                <td className="eq-table-ref">{eq.reference || '—'}</td>
                <td>
                  <span
                    className="eq-table-cat"
                    style={{ background: eq.categoryColor || ACCENT_COLORS.indigo }}
                  >
                    {eq.categoryIcon || '📦'} {eq.categoryName || '—'}
                  </span>
                </td>
                <td>{eq.brand_canonical || eq.brand || '—'}</td>
                <td className="eq-table-serial">{eq.serialNumber || '—'}</td>
                <td className="eq-table-qty">{eq.stockQuantity || 1}</td>
                <td>
                  {(() => {
                    const zoneId = eq.location_zone || eq.locationZone;
                    if (zoneId) {
                      let z = null;
                      if (depotZones?.zones) z = findZone(depotZones.zones, zoneId);
                      if (!z && allDepotZones?.depots) {
                        for (const depot of allDepotZones.depots) {
                          z = findZone(depot.zones, zoneId);
                          if (z) break;
                        }
                      }
                      if (z)
                        return (
                          <Tooltip content="Voir sur le plan" position="bottom">
                            <span
                              className="eq-zone-badge eq-zone-clickable"
                              role="button"
                              tabIndex={0}
                              style={{ background: z.color, color: z.textColor || '#fff' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenDepotMap && onOpenDepotMap(zoneId, eq.name);
                              }}
                            >
                              <MapPin size={11} />
                              {z.label}
                              {(eq.location_code || eq.locationCode) && (
                                <span className="eq-zone-code">
                                  {eq.location_code || eq.locationCode}
                                </span>
                              )}
                            </span>
                          </Tooltip>
                        );
                      return (
                        <Tooltip content="Voir sur le plan" position="bottom">
                          <span
                            className="eq-zone-badge eq-zone-clickable"
                            role="button"
                            tabIndex={0}
                            style={{
                              background: 'var(--theme-text-secondary)',
                              color: 'var(--theme-text-inverse)',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDepotMap && onOpenDepotMap(zoneId, eq.name);
                            }}
                          >
                            <MapPin size={11} />
                            {zoneId}
                          </span>
                        </Tooltip>
                      );
                    }
                    return eq.location || '—';
                  })()}
                </td>
                <td>
                  <span className="eq-table-status" style={{ color: st.color }}>
                    {st.icon} {st.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
};

export default EquipmentGrid;
