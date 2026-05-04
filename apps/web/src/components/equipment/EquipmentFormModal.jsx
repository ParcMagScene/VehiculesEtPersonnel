import { Camera, Map, MapPin, Search, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { Button, Input, ModalLayout, Select, Textarea, Tooltip } from '@/design-system';

import { useToast } from '../../hooks/useToast';
import {
  GENERIC_IMAGES,
  getAllGenericImages,
  resolveGenericImage,
} from '../../utils/genericImages';
import DepotMap from '../vehicles/DepotMap';
import LocationSelector from '../vehicles/LocationSelector';
import CategoryCascadePicker from './CategoryCascadePicker';
import { EQUIPMENT_STATUS } from './equipmentConstants';
import { getCategoryHierarchy, matchPhotoToEquipment } from './equipmentUtils';

const EquipmentFormModal = ({
  equipment: eq,
  categories,
  brandsList = [],
  depotZones,
  allDepotZones,
  photosList = [],
  onSave,
  onClose,
}) => {
  const toast = useToast();
  const [showMap, setShowMap] = useState(false);
  const [mapSelection, setMapSelection] = useState('');
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [photoSearch, setPhotoSearch] = useState('');
  const [pickerTab, setPickerTab] = useState('photos');
  const [mapDepotIdx, setMapDepotIdx] = useState(0);

  const families = useMemo(() => categories.filter((c) => c.level === 'family'), [categories]);
  const subfamilies = useMemo(
    () => categories.filter((c) => c.level === 'subfamily'),
    [categories],
  );
  const leafCategories = useMemo(
    () => categories.filter((c) => c.level === 'category'),
    [categories],
  );

  const findParents = useCallback(
    (catId) => {
      if (!catId) return { familyId: '', subfamilyId: '', categoryId: '' };
      const cat = categories.find((c) => c.id === catId);
      if (!cat) return { familyId: '', subfamilyId: '', categoryId: '' };
      if (cat.level === 'family')
        return { familyId: String(cat.id), subfamilyId: '', categoryId: '' };
      const catParent = cat.parentId || cat.parent_id;
      if (cat.level === 'subfamily')
        return { familyId: String(catParent || ''), subfamilyId: String(cat.id), categoryId: '' };
      const sf = categories.find((c) => c.id === catParent);
      const sfParent = sf?.parentId || sf?.parent_id;
      return {
        familyId: String(sfParent || ''),
        subfamilyId: String(catParent || ''),
        categoryId: String(cat.id),
      };
    },
    [categories],
  );

  const parents = findParents(eq?.categoryId || eq?.category_id);

  const [form, setForm] = useState({
    name: eq?.name || '',
    reference: eq?.reference || '',
    serial_number: eq?.serialNumber || eq?.serial_number || '',
    family_id: parents.familyId,
    subfamily_id: parents.subfamilyId,
    category_id:
      parents.categoryId ||
      (eq?.categoryId || eq?.category_id ? String(eq.categoryId || eq.category_id) : ''),
    status: eq?.status || 'available',
    location: eq?.location || '',
    location_depot: eq?.location_depot || eq?.locationDepot || '',
    location_zone: eq?.location_zone || eq?.locationZone || '',
    location_code: eq?.location_code || eq?.locationCode || '',
    location_floor: eq?.location_floor || eq?.locationFloor || '',
    purchase_date: eq?.purchaseDate || eq?.purchase_date || '',
    purchase_price: eq?.purchasePrice || eq?.purchase_price || '',
    warranty_end: eq?.warrantyEnd || eq?.warranty_end || '',
    notes: eq?.notes || '',
    brand: eq?.brand || '',
    stock_quantity: eq?.stockQuantity || eq?.stock_quantity || 1,
    photo: eq?.photo || '',
    numero_mag: eq?.numeroMag || eq?.numero_mag || '',
  });

  const _currentSubfamilies = useMemo(() => {
    if (!form.family_id) return [];
    const fid = parseInt(form.family_id);
    return subfamilies.filter((sf) => (sf.parentId || sf.parent_id) === fid);
  }, [form.family_id, subfamilies]);

  const _currentLeafCategories = useMemo(() => {
    if (!form.subfamily_id) return [];
    const sid = parseInt(form.subfamily_id);
    return leafCategories.filter((c) => (c.parentId || c.parent_id) === sid);
  }, [form.subfamily_id, leafCategories]);

  const resolvedCategoryId = form.category_id || form.subfamily_id || form.family_id || '';

  const autoMatchedPhoto = useMemo(() => {
    if (!photosList.length) return null;
    const fakeEq = { name: form.name, reference: form.reference };
    return matchPhotoToEquipment(photosList, fakeEq);
  }, [photosList, form.name, form.reference]);

  const currentPhotoUrl = useMemo(() => {
    if (!form.photo) return autoMatchedPhoto;
    if (form.photo.startsWith('generic:')) {
      const [groupKey, key] = form.photo.slice(8).split('/');
      return GENERIC_IMAGES[groupKey]?.[key] || null;
    }
    return `/Photos/Matériel/${form.photo}`;
  }, [form.photo, autoMatchedPhoto]);

  const resolvedCat = useMemo(() => {
    const cid = parseInt(resolvedCategoryId);
    return cid ? categories.find((c) => c.id === cid) : null;
  }, [resolvedCategoryId, categories]);
  const defaultIcon = resolvedCat?.icon || '📦';

  const filteredPickerPhotos = useMemo(() => {
    if (!photoSearch.trim()) return photosList;
    const q = photoSearch.toLowerCase();
    return photosList.filter((p) => p.toLowerCase().includes(q));
  }, [photosList, photoSearch]);

  const allGenerics = useMemo(() => getAllGenericImages(), []);
  const filteredGenerics = useMemo(() => {
    if (!photoSearch.trim()) return allGenerics;
    const q = photoSearch.toLowerCase();
    return allGenerics.filter(
      (g) => g.label.toLowerCase().includes(q) || g.group.toLowerCase().includes(q),
    );
  }, [allGenerics, photoSearch]);

  const genericImageUrl = useMemo(() => {
    if (currentPhotoUrl) return null;
    const fakeEq = { name: form.name, reference: form.reference };
    const hierarchy = getCategoryHierarchy(
      { categoryId: parseInt(resolvedCategoryId) || 0 },
      categories,
    );
    return resolveGenericImage(fakeEq, hierarchy);
  }, [form.name, form.reference, resolvedCategoryId, categories, currentPhotoUrl]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.warning('Nom requis');
    const data = {
      ...form,
      category_id: resolvedCategoryId ? parseInt(resolvedCategoryId) : null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      stock_quantity: form.stock_quantity ? parseInt(form.stock_quantity) : 1,
      location_depot: form.location_depot || null,
      location_zone: form.location_zone || null,
      location_code: form.location_code || null,
      location_floor: form.location_floor || null,
      photo: form.photo || null,
    };
    onSave(data);
  };

  return (
    <ModalLayout
      open
      onClose={onClose}
      title={eq ? "✏️ Modifier l'équipement" : '➕ Nouveau matériel'}
      size="lg"
      className="eq-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="equipment-form">
            {eq ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <form id="equipment-form" onSubmit={handleSubmit} className="eq-modal-body">
        <div className="eq-form-grid">
          <div className="eq-form-field eq-form-full">
            <label>Nom *</label>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Enceinte 2 voies 8XT"
              autoFocus
            />
          </div>

          {/* Photo picker */}
          <div className="eq-form-field eq-form-full">
            <label>Photo</label>
            <div className="eq-photo-picker">
              <div
                className="eq-photo-picker-preview"
                role="button"
                tabIndex={0}
                onClick={() => setShowPhotoPicker(!showPhotoPicker)}
              >
                {currentPhotoUrl ? (
                  <img src={currentPhotoUrl} alt="Photo de l'équipement" loading="lazy" />
                ) : genericImageUrl ? (
                  <img
                    src={genericImageUrl}
                    alt="Image générique de la catégorie"
                    loading="lazy"
                    className="eq-generic-preview"
                  />
                ) : (
                  <span className="eq-photo-picker-icon">{defaultIcon}</span>
                )}
                <span className="eq-photo-picker-label">
                  {form.photo
                    ? form.photo
                    : autoMatchedPhoto
                      ? '(auto)'
                      : genericImageUrl
                        ? '(générique auto)'
                        : 'Choisir une photo'}
                </span>
                <Camera size={16} />
              </div>
              {form.photo && (
                <Tooltip content="Retirer la photo">
                  <Button
                    variant="ghost"
                    type="button"
                    className="eq-photo-picker-clear"
                    onClick={() => setForm((f) => ({ ...f, photo: '' }))}
                  >
                    <X size={14} />
                  </Button>
                </Tooltip>
              )}
            </div>
            {showPhotoPicker && (
              <div className="eq-photo-picker-dropdown">
                <div className="eq-photo-picker-search">
                  <Search size={14} />
                  <Input
                    type="text"
                    value={photoSearch}
                    onChange={(e) => setPhotoSearch(e.target.value)}
                    placeholder="Rechercher..."
                    autoFocus
                  />
                </div>
                <div className="eq-photo-picker-tabs">
                  <Button
                    variant="ghost"
                    type="button"
                    className={`eq-picker-tab${pickerTab === 'photos' ? ' active' : ''}`}
                    onClick={() => setPickerTab('photos')}
                  >
                    📸 Photos ({photosList.length})
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    className={`eq-picker-tab${pickerTab === 'generic' ? ' active' : ''}`}
                    onClick={() => setPickerTab('generic')}
                  >
                    🖼️ Génériques ({allGenerics.length})
                  </Button>
                </div>
                <div className="eq-photo-picker-grid">
                  <div
                    className={`eq-photo-picker-item${!form.photo ? ' selected' : ''}`}
                    onClick={() => {
                      setForm((f) => ({ ...f, photo: '' }));
                      setShowPhotoPicker(false);
                      setPhotoSearch('');
                    }}
                  >
                    <span className="eq-photo-picker-item-icon">{defaultIcon}</span>
                    <span className="eq-photo-picker-item-label">Aucune photo</span>
                  </div>
                  {pickerTab === 'photos' &&
                    filteredPickerPhotos.map((p) => (
                      <div
                        key={p}
                        className={`eq-photo-picker-item${form.photo === p ? ' selected' : ''}`}
                        onClick={() => {
                          setForm((f) => ({ ...f, photo: p }));
                          setShowPhotoPicker(false);
                          setPhotoSearch('');
                        }}
                        title={p}
                      >
                        <img src={`/Photos/Matériel/${p}`} alt={p} loading="lazy" />
                        <span className="eq-photo-picker-item-label">
                          {p.replace(/\.[^.]+$/, '')}
                        </span>
                      </div>
                    ))}
                  {pickerTab === 'generic' &&
                    (() => {
                      let lastGroup = '';
                      return filteredGenerics.map((g) => {
                        const showHeader = g.group !== lastGroup;
                        lastGroup = g.group;
                        return (
                          <React.Fragment key={g.key}>
                            {showHeader && (
                              <div className="eq-photo-picker-group-header">{g.group}</div>
                            )}
                            <div
                              className="eq-photo-picker-item eq-generic-item"
                              onClick={() => {
                                setForm((f) => ({ ...f, photo: `generic:${g.groupKey}/${g.key}` }));
                                setShowPhotoPicker(false);
                                setPhotoSearch('');
                              }}
                              title={g.label}
                            >
                              <img src={g.path} alt={g.label} loading="lazy" />
                              <span className="eq-photo-picker-item-label">{g.label}</span>
                            </div>
                          </React.Fragment>
                        );
                      });
                    })()}
                  {pickerTab === 'photos' && filteredPickerPhotos.length === 0 && (
                    <div className="eq-photo-picker-empty">Aucune photo trouvée</div>
                  )}
                  {pickerTab === 'generic' && filteredGenerics.length === 0 && (
                    <div className="eq-photo-picker-empty">Aucune image générique trouvée</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="eq-form-field">
            <label>Référence / Code</label>
            <Input
              type="text"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="Ex: MTD108-8XT"
            />
          </div>
          <div className="eq-form-field">
            <label>N° de série</label>
            <Input
              type="text"
              value={form.serial_number}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
            />
          </div>
          <div className="eq-form-field">
            <label>Numéro MAG</label>
            <Input
              type="text"
              value={form.numero_mag}
              onChange={(e) => setForm({ ...form, numero_mag: e.target.value })}
              placeholder="N° libre interne (ex: MAG-042)"
            />
          </div>
          <div className="eq-form-field">
            <label>Marque</label>
            <Input
              type="text"
              list="eq-brands-list"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              placeholder="Ex: L-Acoustics"
            />
            <datalist id="eq-brands-list">
              {brandsList.map((b) => (
                <option key={b.id} value={b.name} />
              ))}
            </datalist>
          </div>
          <div className="eq-form-field">
            <label>Quantité / Stock</label>
            <Input
              type="number"
              min="1"
              value={form.stock_quantity}
              onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
            />
          </div>
          <div className="eq-form-field eq-form-full">
            <label>Catégorie</label>
            <CategoryCascadePicker
              families={families}
              subfamilies={subfamilies}
              leafCategories={leafCategories}
              value={{
                family_id: form.family_id,
                subfamily_id: form.subfamily_id,
                category_id: form.category_id,
              }}
              onChange={({ family_id, subfamily_id, category_id }) =>
                setForm((f) => ({ ...f, family_id, subfamily_id, category_id }))
              }
            />
          </div>
          <div className="eq-form-field">
            <label>Statut</label>
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {Object.entries(EQUIPMENT_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </Select>
          </div>
          {(depotZones || allDepotZones) && (
            <div className="eq-form-field eq-form-full">
              <LocationSelector
                zones={depotZones}
                depots={allDepotZones}
                value={{
                  location_depot: form.location_depot,
                  location_zone: form.location_zone,
                  location_code: form.location_code,
                  location_floor: form.location_floor,
                }}
                onChange={(loc) =>
                  setForm((f) => ({
                    ...f,
                    location_depot: loc.location_depot || '',
                    location_zone: loc.location_zone || '',
                    location_code: loc.location_code || '',
                    location_floor: loc.location_floor || '',
                  }))
                }
              />
              <Button
                variant="ghost"
                type="button"
                className="eq-form-map-toggle"
                onClick={() => setShowMap(true)}
              >
                <Map size={14} /> Choisir sur le plan
              </Button>
              {showMap &&
                (() => {
                  const depotsList = allDepotZones?.depots || (depotZones ? [depotZones] : []);
                  const currentDepotData = depotsList[mapDepotIdx] || depotsList[0];
                  if (!currentDepotData) return null;
                  return (
                    <ModalLayout
                      open
                      onClose={() => setShowMap(false)}
                      title={
                        <>
                          <MapPin size={18} /> Choisir la localisation sur le plan
                          {depotsList.length > 1 && (
                            <div className="eq-form-map-tabs">
                              {depotsList.map((d, i) => (
                                <Button
                                  variant="ghost"
                                  key={d.id || i}
                                  type="button"
                                  className={`eq-form-map-tab${i === mapDepotIdx ? ' active' : ''}`}
                                  onClick={() => setMapDepotIdx(i)}
                                >
                                  {d.name || `Dépôt ${d.id || i + 1}`}
                                </Button>
                              ))}
                            </div>
                          )}
                        </>
                      }
                      size="xl"
                      className="eq-depot-map-modal"
                      footer={
                        <>
                          {mapSelection &&
                            (() => {
                              const z = currentDepotData.zones?.find((z) => z.id === mapSelection);
                              return (
                                <span
                                  className="eq-depot-map-modal-zone-label"
                                  style={{ borderLeftColor: z?.color || 'var(--theme-primary)' }}
                                >
                                  {z?.label || mapSelection}
                                </span>
                              );
                            })()}
                          <div className="eq-flex-spacer" />
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setMapSelection('');
                              setShowMap(false);
                            }}
                          >
                            Annuler
                          </Button>
                          <Button
                            variant="primary"
                            disabled={!mapSelection}
                            onClick={() => {
                              const zoneObj = currentDepotData.zones?.find(
                                (z) => z.id === mapSelection,
                              );
                              setForm((f) => ({
                                ...f,
                                location_depot:
                                  currentDepotData.id || currentDepotData.depotId || '',
                                location_zone: mapSelection,
                                location_code: '',
                                location_floor: zoneObj?.floor || '',
                              }));
                              setMapSelection('');
                              setShowMap(false);
                            }}
                          >
                            ✓ Valider
                          </Button>
                        </>
                      }
                    >
                      <div className="eq-depot-map-modal-body">
                        <DepotMap
                          zones={currentDepotData}
                          selectedZone={mapSelection || form.location_zone}
                          onZoneSelect={(zoneId) => {
                            setMapSelection(zoneId || '');
                          }}
                          onZoneFilter={() => {}}
                        />
                      </div>
                    </ModalLayout>
                  );
                })()}
            </div>
          )}
          {!depotZones && !allDepotZones && (
            <div className="eq-form-field">
              <label>Localisation / Zone</label>
              <Input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Ex: Dépôt A, Étagère 3"
              />
            </div>
          )}
          <div className="eq-form-field">
            <label>Date d'achat</label>
            <input
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            />
          </div>
          <div className="eq-form-field">
            <label>Prix d'achat (€)</label>
            <Input
              type="number"
              step="0.01"
              value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
            />
          </div>
          <div className="eq-form-field">
            <label>Fin de garantie</label>
            <input
              type="date"
              value={form.warranty_end}
              onChange={(e) => setForm({ ...form, warranty_end: e.target.value })}
            />
          </div>
          <div className="eq-form-field eq-form-full">
            <label>Notes</label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Remarques, accessoires inclus..."
            />
          </div>
        </div>
      </form>
    </ModalLayout>
  );
};

export default EquipmentFormModal;
