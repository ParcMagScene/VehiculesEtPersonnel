import { ChevronDown, ChevronUp, Eye, MapPin, Package, Star } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState, Table, Tooltip } from '@/design-system';

import { ACCENT_COLORS } from '../../constants/colors';
import { resolveGenericImage } from '../../utils/genericImages';
import { cleanName, EQUIPMENT_STATUS } from './equipmentConstants';
import { findZone, getCategoryHierarchy, matchPhotoToEquipment } from './equipmentUtils';

const SortIcon = ({ col, sortCol, sortDir }) => {
  if (sortCol !== col) return <ChevronDown size={11} className="sort-icon" />;
  return sortDir === 'asc' ? (
    <ChevronUp size={11} className="sort-icon sort-icon-active" />
  ) : (
    <ChevronDown size={11} className="sort-icon sort-icon-active" />
  );
};

const Th = ({ col, children, className, onSort, sortCol, sortDir }) => (
  <th className={`eq-sort-th${className ? ' ' + className : ''}`} onClick={() => onSort(col)}>
    <span className="sort-th-inner">
      {children}
      <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
    </span>
  </th>
);

const getDepotsList = (depotZones, allDepotZones) => {
  if (allDepotZones?.depots?.length) return allDepotZones.depots;
  if (depotZones) return [depotZones];
  return [];
};

const formatDepotLabel = (depotName, depotId) => {
  if (!depotName) return depotId ? `D${depotId}` : '—';

  return depotName
    .replace(/^entreprise\s*[—-]\s*/i, '')
    .replace(/^entreprise\s+/i, '')
    .trim();
};

const formatFloorLabel = (floor) => {
  if (!floor) return '';

  const normalized = String(floor).trim().toUpperCase();
  if (normalized === 'MEZZ') return 'Mezzanine';
  if (normalized === 'RDC') return 'RDC';
  return String(floor).trim();
};

const DEPOT_BADGE_PALETTE = [
  { bg: 'rgba(59, 130, 246, 0.18)', border: 'rgba(59, 130, 246, 0.30)', text: '#1d4ed8' },
  { bg: 'rgba(16, 185, 129, 0.18)', border: 'rgba(16, 185, 129, 0.30)', text: '#047857' },
  { bg: 'rgba(249, 115, 22, 0.18)', border: 'rgba(249, 115, 22, 0.30)', text: '#c2410c' },
  { bg: 'rgba(139, 92, 246, 0.18)', border: 'rgba(139, 92, 246, 0.30)', text: '#6d28d9' },
  { bg: 'rgba(236, 72, 153, 0.18)', border: 'rgba(236, 72, 153, 0.30)', text: '#be185d' },
  { bg: 'rgba(234, 179, 8, 0.18)', border: 'rgba(234, 179, 8, 0.30)', text: '#a16207' },
  { bg: 'rgba(6, 182, 212, 0.18)', border: 'rgba(6, 182, 212, 0.30)', text: '#0f766e' },
];

const FLOOR_BADGE_COLORS = {
  RDC: { bg: 'rgba(14, 165, 233, 0.14)', border: 'rgba(14, 165, 233, 0.26)', text: '#0369a1' },
  Mezzanine: {
    bg: 'rgba(99, 102, 241, 0.14)',
    border: 'rgba(99, 102, 241, 0.26)',
    text: '#4338ca',
  },
};

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const getDepotBadgeStyle = (label) => {
  const palette = DEPOT_BADGE_PALETTE[hashString(label) % DEPOT_BADGE_PALETTE.length];
  return {
    background: palette.bg,
    borderColor: palette.border,
    color: palette.text,
  };
};

const getFloorBadgeStyle = (label) => {
  const palette = FLOOR_BADGE_COLORS[label] || {
    bg: 'rgba(100, 116, 139, 0.14)',
    border: 'rgba(100, 116, 139, 0.24)',
    text: '#475569',
  };

  return {
    background: palette.bg,
    borderColor: palette.border,
    color: palette.text,
  };
};

const resolveEquipmentLocation = (eq, depotZones, allDepotZones) => {
  const zoneId = eq.location_zone || eq.locationZone || '';
  const depotId = eq.location_depot || eq.locationDepot || '';
  const floor = eq.location_floor || eq.locationFloor || '';
  const depots = getDepotsList(depotZones, allDepotZones);

  let matchedDepot = null;
  let matchedZone = null;

  if (depotId) {
    matchedDepot = depots.find((depot) => String(depot.id) === String(depotId)) || null;
    if (matchedDepot && zoneId) matchedZone = findZone(matchedDepot.zones, zoneId);
  }

  if (!matchedZone && zoneId) {
    for (const depot of depots) {
      const zone = findZone(depot.zones, zoneId);
      if (zone) {
        matchedDepot = depot;
        matchedZone = zone;
        break;
      }
    }
  }

  const depotLabel = formatDepotLabel(matchedDepot?.name, depotId);
  const floorLabel = formatFloorLabel(floor || matchedZone?.floor || '');

  return {
    zoneId,
    zone: matchedZone,
    depotLabel,
    floorLabel,
    depotSortKey: `${depotLabel} ${floorLabel}`.trim(),
  };
};

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
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    const arr = [...equipment];
    arr.sort((a, b) => {
      let av, bv;
      switch (sortCol) {
        case 'name':
          av = a.name || '';
          bv = b.name || '';
          break;
        case 'uid':
          av = a.uid || '';
          bv = b.uid || '';
          break;
        case 'reference':
          av = a.reference || '';
          bv = b.reference || '';
          break;
        case 'categoryName':
          av = a.categoryName || '';
          bv = b.categoryName || '';
          break;
        case 'brand':
          av = a.brand_canonical || a.brand || '';
          bv = b.brand_canonical || b.brand || '';
          break;
        case 'serialNumber':
          av = a.serialNumber || a.serial_number || '';
          bv = b.serialNumber || b.serial_number || '';
          break;
        case 'numeroMag':
          av = a.numeroMag || a.numero_mag || '';
          bv = b.numeroMag || b.numero_mag || '';
          break;
        case 'stockQuantity':
          av = a.stockQuantity ?? 1;
          bv = b.stockQuantity ?? 1;
          break;
        case 'depot':
          av = resolveEquipmentLocation(a, depotZones, allDepotZones).depotSortKey;
          bv = resolveEquipmentLocation(b, depotZones, allDepotZones).depotSortKey;
          break;
        case 'zone':
          av = a.location_zone || a.locationZone || '';
          bv = b.location_zone || b.locationZone || '';
          break;
        case 'status':
          av = a.status || '';
          bv = b.status || '';
          break;
        default:
          av = '';
          bv = '';
      }
      if (typeof av === 'number' && typeof bv === 'number')
        return sortDir === 'asc' ? av - bv : bv - av;
      const cmp = String(av).localeCompare(String(bv), 'fr', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [equipment, sortCol, sortDir, depotZones, allDepotZones]);

  if (sorted.length === 0) {
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
            <Th col="name" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>
              Nom
            </Th>
            <Th col="uid" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>
              UID
            </Th>
            <Th col="reference" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>
              Référence
            </Th>
            <Th col="categoryName" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>
              Catégorie
            </Th>
            <Th col="brand" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>
              Marque
            </Th>
            <Th col="serialNumber" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>
              N° Série
            </Th>
            <Th col="numeroMag" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>
              N° MAG
            </Th>
            <Th col="stockQuantity" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>
              Qté
            </Th>
            <Th col="depot" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>
              Dépôt
            </Th>
            <Th col="zone" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>
              Zone
            </Th>
            <Th col="status" onSort={handleSort} sortCol={sortCol} sortDir={sortDir}>
              Statut
            </Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((eq) => {
            const st = EQUIPMENT_STATUS[eq.status] || EQUIPMENT_STATUS.available;
            const photo = matchPhotoToEquipment(photosList, eq);
            const hierarchy = categories ? getCategoryHierarchy(eq, categories) : null;
            const genericImg = !photo ? resolveGenericImage(eq, hierarchy) : null;
            const isFav = favoriteIds.has(eq.id);
            const isWatch = watchIds.has(eq.id);
            const location = resolveEquipmentLocation(eq, depotZones, allDepotZones);

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
                <td className="eq-table-mag">{eq.numeroMag || eq.numero_mag || '—'}</td>
                <td className="eq-table-qty">{eq.stockQuantity || 1}</td>
                <td className="eq-table-depot">
                  {location.depotLabel === '—' ? (
                    '—'
                  ) : (
                    <div className="eq-depot-badges">
                      <span
                        className="eq-depot-badge"
                        style={getDepotBadgeStyle(location.depotLabel)}
                      >
                        {location.depotLabel}
                      </span>
                      {location.floorLabel && (
                        <span
                          className="eq-depot-floor-badge"
                          style={getFloorBadgeStyle(location.floorLabel)}
                        >
                          {location.floorLabel}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  {(() => {
                    const zoneId = location.zoneId;
                    if (zoneId) {
                      const z = location.zone;

                      if (z) {
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
                      }

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
