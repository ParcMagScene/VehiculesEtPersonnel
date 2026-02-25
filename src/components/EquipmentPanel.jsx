import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Package, Search, Plus, Filter, Wrench, AlertTriangle, CheckCircle, Clock, X, ChevronRight, Edit2, Trash2, RotateCcw, Tag, MapPin, Calendar, DollarSign, User, Clipboard, Upload, ExternalLink, Star, Eye, QrCode, Image as ImageIcon, Hash, Printer, FileText, Map } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../utils/api';
import EquipmentImportModal from './EquipmentImportModal';
import SavImportModal from './SavImportModal';
import EquipmentLabelPrint from './EquipmentLabelPrint';
import EquipmentBatchLabels from './EquipmentBatchLabels';
import { printEquipmentSheet } from './EquipmentSheetPrint';
import MaintenanceReportModal from './MaintenanceReportModal';
import LocationSelector from './LocationSelector';
import DepotMap from './DepotMap';
import './EquipmentPanel.css';
import { useToast } from '../hooks/useToast';

// ═══ CONSTANTES ═══
const safeDate = (d) => {
  if (!d) return '—';
  try {
    const s = String(d).trim();
    // Format yyyy-MM-dd ou yyyy-MM-dd HH:mm:ss
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    // Format dd/MM/yyyy
    const m2 = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m2) return `${m2[1]}/${m2[2]}/${m2[3]}`;
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('fr-FR');
  } catch { return '—'; }
};

const EQUIPMENT_STATUS = {
  available: { label: 'Disponible', color: '#10b981', icon: '✅' },
  in_use: { label: 'En service', color: '#3b82f6', icon: '🔄' },
  maintenance: { label: 'En maintenance', color: '#f59e0b', icon: '🔧' },
  retired: { label: 'Réformé', color: '#6b7280', icon: '⛔' },
};

const SAV_STATUS = {
  open: { label: 'Ouvert', color: '#ef4444' },
  in_progress: { label: 'En cours', color: '#f59e0b' },
  waiting_parts: { label: 'Attente pièces', color: '#8b5cf6' },
  resolved: { label: 'Résolu', color: '#10b981' },
  closed: { label: 'Clôturé', color: '#6b7280' },
};

const SAV_PRIORITY = {
  low: { label: 'Basse', color: '#6b7280' },
  medium: { label: 'Moyenne', color: '#f59e0b' },
  high: { label: 'Haute', color: '#ef4444' },
  urgent: { label: 'Urgente', color: '#dc2626' },
};

const SAV_TYPES = {
  panne: 'Panne',
  entretien: 'Entretien',
  reparation: 'Réparation',
  calibrage: 'Calibrage',
};

// Nettoyer les guillemets inutiles dans les noms
const cleanName = (s) => (s || '').replace(/^"+|"+$/g, '').replace(/"{2,}/g, '"');

// URL de base pour les QR codes — toujours utiliser l'URL production accessible depuis un mobile
const APP_BASE_URL = (() => {
  const origin = window.location.origin;
  // Si on est sur le domaine de production, utiliser directement
  if (origin.includes('magsav.duckdns.org')) return origin;
  // Sinon (dev/localhost), pointer vers l'URL de production pour que les QR soient scannables
  return 'http://magsav.duckdns.org:4173';
})();

// ═══ UTILITAIRES PHOTOS / LOGOS ═══
const normalizeStr = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const tokenize = (s) => (s || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);

const matchPhotoToEquipment = (photos, eq) => {
  if (!photos || photos.length === 0) return null;
  const ref = normalizeStr(eq.reference);
  const name = normalizeStr(eq.name);
  const refTokens = tokenize(eq.reference);
  const nameTokens = tokenize(eq.name);
  // Pré-calculer les noms de fichiers normalisés
  const photoEntries = photos.map(p => ({ file: p, norm: normalizeStr(p.replace(/\.[^.]+$/, '')) }));
  // 1) Match exact sur référence
  for (const { file, norm } of photoEntries) {
    if (ref && norm === ref) return `/Photos/Matériel/${file}`;
  }
  // 2) La référence est contenue dans le nom du fichier ou inversement
  for (const { file, norm } of photoEntries) {
    if (ref && ref.length > 2 && (norm.includes(ref) || ref.includes(norm))) return `/Photos/Matériel/${file}`;
  }
  // 3) Match par tokens de la référence (ex: "8XT" dans "8XT-L-ACOUSTICS.jpg")
  for (const { file, norm } of photoEntries) {
    for (const token of refTokens) {
      if (token.length > 2 && norm.includes(token)) return `/Photos/Matériel/${file}`;
    }
  }
  // 4) Match sur le nom de l'équipement
  for (const { file, norm } of photoEntries) {
    if (name && norm.length > 3 && (norm.includes(name) || name.includes(norm))) return `/Photos/Matériel/${file}`;
  }
  // 5) Match par tokens significatifs du nom (longueur >= 4 pour éviter faux positifs)
  for (const { file, norm } of photoEntries) {
    for (const token of nameTokens) {
      if (token.length >= 4 && norm.includes(token)) return `/Photos/Matériel/${file}`;
    }
  }
  return null;
};

const matchLogoToBrand = (logos, brand) => {
  if (!logos || !brand || logos.length === 0) return null;
  const b = normalizeStr(brand);
  if (!b) return null;
  for (const l of logos) {
    const ln = normalizeStr(l.replace(/\.[^.]+$/, ''));
    if (ln.includes(b) || b.includes(ln)) return `/Logos/${l}`;
  }
  return null;
};

// ═══ RÉSOLUTION HIÉRARCHIE CATÉGORIE ═══
const getCategoryHierarchy = (eq, categories) => {
  if (!eq || !categories || categories.length === 0) return null;
  const catId = eq.categoryId || eq.category_id;
  if (!catId) return null;
  const cat = categories.find(c => c.id === catId);
  if (!cat) return null;
  const result = { family: null, subfamily: null, category: null };
  if (cat.level === 'family') {
    result.family = cat;
  } else if (cat.level === 'subfamily') {
    result.subfamily = cat;
    result.family = categories.find(c => c.id === (cat.parentId || cat.parent_id));
  } else if (cat.level === 'category') {
    result.category = cat;
    const sub = categories.find(c => c.id === (cat.parentId || cat.parent_id));
    if (sub) {
      result.subfamily = sub;
      result.family = categories.find(c => c.id === (sub.parentId || sub.parent_id));
    }
  }
  return result;
};

// ═══ FILTRE CATÉGORIES EN CASCADE (hover) ═══
const CategoryCascadeFilter = ({ families, subfamilies, leafCategories, value, onChange }) => {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredFamily, setHoveredFamily] = useState(null);
  const [hoveredSub, setHoveredSub] = useState(null);
  const containerRef = useRef(null);
  const closeTimer = useRef(null);

  const startClose = () => { closeTimer.current = setTimeout(() => { setIsOpen(false); setHoveredFamily(null); setHoveredSub(null); }, 200); };
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false); setHoveredFamily(null); setHoveredSub(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLabel = () => {
    if (!value) return '🏷️ Toutes familles';
    const [type, idStr] = value.split(':');
    const id = parseInt(idStr);
    if (type === 'family') { const f = families.find(x => x.id === id); return f ? `${f.icon || '📦'} ${f.name}` : value; }
    if (type === 'subfamily') { const sf = subfamilies.find(x => x.id === id); return sf ? `├ ${sf.name}` : value; }
    if (type === 'category') { const c = leafCategories.find(x => x.id === id); return c ? `└ ${c.name}` : value; }
    return value;
  };

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false); setHoveredFamily(null); setHoveredSub(null);
  };

  return (
    <div className="eq-cascade-filter" ref={containerRef} onMouseLeave={startClose} onMouseEnter={cancelClose}>
      <button className={`eq-cascade-btn ${value ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)}>
        <Filter size={13} />
        <span>{getLabel()}</span>
        <ChevronRight size={12} className={`eq-cascade-arrow ${isOpen ? 'open' : ''}`} />
      </button>
      {isOpen && (
        <div className="eq-cascade-menu eq-cascade-l1">
          <div className="eq-cascade-item eq-cascade-all" onClick={() => handleSelect('')}>
            Toutes familles
          </div>
          {families.map(fam => {
            const subs = subfamilies.filter(s => (s.parentId || s.parent_id) === fam.id);
            const isHovered = hoveredFamily === fam.id;
            return (
              <div key={fam.id} className={`eq-cascade-item ${isHovered ? 'hovered' : ''} ${value === `family:${fam.id}` ? 'selected' : ''}`}
                onMouseEnter={() => { setHoveredFamily(fam.id); setHoveredSub(null); cancelClose(); }}
                onClick={() => handleSelect(`family:${fam.id}`)}>
                <span className="eq-cascade-icon" style={{ color: fam.color || '#6b7280' }}>{fam.icon || '📦'}</span>
                <span className="eq-cascade-label">{fam.name}</span>
                {subs.length > 0 && <ChevronRight size={12} className="eq-cascade-sub-arrow" />}
                {isHovered && subs.length > 0 && (
                  <div className="eq-cascade-menu eq-cascade-l2" onMouseEnter={cancelClose}>
                    {subs.map(sf => {
                      const cats = leafCategories.filter(c => (c.parentId || c.parent_id) === sf.id);
                      const isSubHovered = hoveredSub === sf.id;
                      return (
                        <div key={sf.id} className={`eq-cascade-item ${isSubHovered ? 'hovered' : ''} ${value === `subfamily:${sf.id}` ? 'selected' : ''}`}
                          onMouseEnter={() => { setHoveredSub(sf.id); cancelClose(); }}
                          onClick={(e) => { e.stopPropagation(); handleSelect(`subfamily:${sf.id}`); }}>
                          <span className="eq-cascade-label">{sf.name}</span>
                          {cats.length > 0 && <ChevronRight size={12} className="eq-cascade-sub-arrow" />}
                          {isSubHovered && cats.length > 0 && (
                            <div className="eq-cascade-menu eq-cascade-l3" onMouseEnter={cancelClose}>
                              {cats.map(cat => (
                                <div key={cat.id} className={`eq-cascade-item ${value === `category:${cat.id}` ? 'selected' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); handleSelect(`category:${cat.id}`); }}>
                                  <span className="eq-cascade-label">{cat.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══ ARBORESCENCE CATÉGORIES (accordéon 3 niveaux) ═══
const EquipmentCategoriesTree = ({ families, subfamilies, leafCategories, categories, equipment }) => {
  const [expandedFamilies, setExpandedFamilies] = useState({});
  const [expandedSubs, setExpandedSubs] = useState({});

  const toggleFamily = (id) => setExpandedFamilies(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleSub = (id) => setExpandedSubs(prev => ({ ...prev, [id]: !prev[id] }));

  const countEquipment = (familyId) => {
    return equipment.filter(e => {
      const cat = categories.find(c => c.id === e.category_id);
      if (!cat) return false;
      if (cat.id === familyId) return true;
      if (cat.parent_id === familyId) return true;
      const sub = categories.find(s => s.id === cat.parent_id);
      return sub?.parent_id === familyId;
    }).length;
  };

  const countSubEquipment = (subId) => {
    return equipment.filter(e => {
      const cat = categories.find(c => c.id === e.category_id);
      if (!cat) return false;
      return cat.id === subId || cat.parent_id === subId;
    }).length;
  };

  const countLeafEquipment = (catId) => equipment.filter(e => e.category_id === catId).length;

  if (families.length === 0) {
    return <p className="eq-cat-empty">Aucune catégorie définie. Importez un CSV pour créer la hiérarchie.</p>;
  }

  return (
    <div className="eq-cat-tree">
      {families.map(fam => {
        const isOpen = expandedFamilies[fam.id];
        const subs = subfamilies.filter(s => s.parent_id === fam.id);
        const famCount = countEquipment(fam.id);
        return (
          <div key={fam.id} className={`eq-cat-family ${isOpen ? 'open' : ''}`}>
            <button className="eq-cat-family-btn" onClick={() => toggleFamily(fam.id)}>
              <ChevronRight size={14} className={`eq-cat-chevron ${isOpen ? 'rotated' : ''}`} />
              <span className="eq-cat-family-icon" style={{ color: fam.color || '#6b7280' }}>{fam.icon || '📦'}</span>
              <span className="eq-cat-family-name">{fam.name}</span>
              <span className="eq-cat-badge-sub">{subs.length} sous-fam.</span>
              <span className="eq-cat-badge-count">{famCount} éq.</span>
            </button>
            {isOpen && (
              <div className="eq-cat-children">
                {subs.length === 0 && <span className="eq-cat-empty-child">Aucune sous-famille</span>}
                {subs.map(sub => {
                  const isSubOpen = expandedSubs[sub.id];
                  const leaves = leafCategories.filter(c => c.parent_id === sub.id);
                  const subCount = countSubEquipment(sub.id);
                  return (
                    <div key={sub.id} className={`eq-cat-sub ${isSubOpen ? 'open' : ''}`}>
                      <button className="eq-cat-sub-btn" onClick={() => toggleSub(sub.id)}>
                        <ChevronRight size={12} className={`eq-cat-chevron ${isSubOpen ? 'rotated' : ''}`} />
                        <span className="eq-cat-sub-name">{sub.name}</span>
                        <span className="eq-cat-badge-leaf">{leaves.length} cat.</span>
                        <span className="eq-cat-badge-count">{subCount} éq.</span>
                      </button>
                      {isSubOpen && (
                        <div className="eq-cat-leaves">
                          {leaves.length === 0 && <span className="eq-cat-empty-child">Aucune catégorie</span>}
                          {leaves.map(leaf => {
                            const leafCount = countLeafEquipment(leaf.id);
                            return (
                              <div key={leaf.id} className="eq-cat-leaf">
                                <span className="eq-cat-leaf-dot" />
                                <span className="eq-cat-leaf-name">{leaf.name}</span>
                                <span className="eq-cat-badge-count">{leafCount} éq.</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ═══ COMPOSANT PRINCIPAL ═══
const EquipmentPanel = ({ currentUser, showManagement, onCloseManagement }) => {
  const [subTab, setSubTab] = useState('inventory'); // inventory | sav
  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [savTickets, setSavTickets] = useState([]);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtres
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCatTree, setFilterCatTree] = useState('');
  const [savFilterStatus, setSavFilterStatus] = useState('_active');

  // Modals
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [showSavModal, setShowSavModal] = useState(false);
  const [editingSavTicket, setEditingSavTicket] = useState(null);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [dialogEquipment, setDialogEquipment] = useState(null);
  const clickTimerRef = useRef(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignEquipment, setAssignEquipment] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSavImportModal, setShowSavImportModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [labelPrintEquipment, setLabelPrintEquipment] = useState(null);
  const [mgmtTab, setMgmtTab] = useState('imports');


  // SAV volets
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [dialogTicket, setDialogTicket] = useState(null);
  const ticketClickTimerRef = useRef(null);

  // Photos, Logos & Listes
  const [photosList, setPhotosList] = useState([]);
  const [logosList, setLogosList] = useState([]);
  const [equipmentLists, setEquipmentLists] = useState([]);
  const [listFilter, setListFilter] = useState(''); // '' | 'favorite' | 'watch'
  const [depotZones, setDepotZones] = useState(null);
  const [locationStats, setLocationStats] = useState(null);
  const [filterZone, setFilterZone] = useState('');
  const [showDepotMap, setShowDepotMap] = useState(false);

  const isAdmin = currentUser?.isAdmin === true;
  const canManageEquipmentMaintenance = isAdmin || currentUser?.permissions?.can_manage_equipment_maintenance === true;

  // ═══ CHARGEMENT ═══
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [eqData, catData, ticketData, persData, photosData, listsData, zonesData, locStatsData] = await Promise.all([
        api.getEquipment(),
        api.getEquipmentCategories(),
        api.getSavTickets(),
        api.getPersons().catch(() => []),
        api.getEquipmentPhotos().catch(() => ({ photos: [], logos: [] })),
        api.getEquipmentLists().catch(() => []),
        api.getEquipmentDepotZones().catch(() => null),
        api.getEquipmentLocationStats().catch(() => null),
      ]);
      setEquipment(eqData);
      setCategories(catData);
      setSavTickets(ticketData);
      setPersons(persData);
      setPhotosList(photosData.photos || []);
      setLogosList(photosData.logos || []);
      setEquipmentLists(listsData);
      setDepotZones(zonesData);
      setLocationStats(locStatsData);
      setError(null);
    } catch (err) {
      console.error('Erreur chargement matériel:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Hiérarchie des catégories
  const families = useMemo(() => categories.filter(c => c.level === 'family'), [categories]);
  const subfamilies = useMemo(() => categories.filter(c => c.level === 'subfamily'), [categories]);
  const leafCategories = useMemo(() => categories.filter(c => c.level === 'category'), [categories]);

  // Parsing du filtre arborescent
  const parsedCatFilter = useMemo(() => {
    if (!filterCatTree) return { type: null, id: null };
    const [type, idStr] = filterCatTree.split(':');
    return { type, id: parseInt(idStr) };
  }, [filterCatTree]);

  // ═══ FILTRAGE ═══
  const favoriteIds = useMemo(() => new Set(equipmentLists.filter(l => l.list_type === 'favorite').map(l => l.equipment_id)), [equipmentLists]);
  const watchIds = useMemo(() => new Set(equipmentLists.filter(l => l.list_type === 'watch').map(l => l.equipment_id)), [equipmentLists]);

  const filteredEquipment = useMemo(() => {
    return equipment.filter(eq => {
      if (filterStatus && eq.status !== filterStatus) return false;
      if (filterZone) {
        if (filterZone === '_none') {
          if (eq.location_zone || eq.locationZone) return false;
        } else {
          if ((eq.location_zone || eq.locationZone) !== filterZone) return false;
        }
      }
      
      // Filtre liste (favoris / surveillance)
      if (listFilter === 'favorite' && !favoriteIds.has(eq.id)) return false;
      if (listFilter === 'watch' && !watchIds.has(eq.id)) return false;
      
      // Filtre hiérarchique — eq.categoryId (camelCase via API transform)
      const eqCatId = eq.categoryId || eq.category_id;
      if (parsedCatFilter.type === 'family') {
        const familyId = parsedCatFilter.id;
        const sfIds = subfamilies.filter(sf => sf.parentId === familyId || sf.parent_id === familyId).map(sf => sf.id);
        const catIds = leafCategories.filter(c => sfIds.includes(c.parentId || c.parent_id)).map(c => c.id);
        const allValidIds = [familyId, ...sfIds, ...catIds];
        if (!allValidIds.includes(eqCatId)) return false;
      }
      if (parsedCatFilter.type === 'subfamily') {
        const sfId = parsedCatFilter.id;
        const catIds = leafCategories.filter(c => (c.parentId || c.parent_id) === sfId).map(c => c.id);
        const allValidIds = [sfId, ...catIds];
        if (!allValidIds.includes(eqCatId)) return false;
      }
      if (parsedCatFilter.type === 'category' && eqCatId !== parsedCatFilter.id) return false;
      
      if (search) {
        const s = search.toLowerCase();
        if (!eq.name?.toLowerCase().includes(s) && !eq.reference?.toLowerCase().includes(s) && !(eq.serialNumber || eq.serial_number || '').toLowerCase().includes(s) && !eq.location?.toLowerCase().includes(s) && !eq.brand?.toLowerCase().includes(s) && !(eq.uid || '').toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [equipment, filterStatus, filterZone, parsedCatFilter, search, subfamilies, leafCategories, listFilter, favoriteIds, watchIds]);

  const filteredTickets = useMemo(() => {
    return savTickets.filter(t => {
      if (savFilterStatus === '_active') return t.status !== 'resolved' && t.status !== 'closed';
      if (savFilterStatus && t.status !== savFilterStatus) return false;
      return true;
    });
  }, [savTickets, savFilterStatus]);

  // ═══ STATS ═══
  const stats = useMemo(() => ({
    total: equipment.length,
    available: equipment.filter(e => e.status === 'available').length,
    in_use: equipment.filter(e => e.status === 'in_use').length,
    maintenance: equipment.filter(e => e.status === 'maintenance').length,
    openTickets: savTickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length,
  }), [equipment, savTickets]);

  // ═══ HANDLERS ═══
  const handleSaveEquipment = async (data) => {
    try {
      if (editingEquipment) {
        await api.updateEquipment(editingEquipment.id, data);
      } else {
        await api.createEquipment(data);
      }
      setShowEquipmentModal(false);
      setEditingEquipment(null);
      loadData();
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const handleDeleteEquipment = async (id) => {
    if (!confirm('Supprimer cet équipement et tout son historique ?')) return;
    try {
      await api.deleteEquipment(id);
      setSelectedEquipment(null);
      loadData();
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const handleSerializeEquipment = async (eq) => {
    const qty = eq.stockQuantity || eq.stock_quantity || 1;
    if (qty <= 1) return toast.warning('Cet équipement a déjà une quantité de 1.');
    if (!confirm(`Sérialiser "${eq.name}" en ${qty} entités individuelles ?\n\nChaque exemplaire recevra son propre UID (EMAG-XXXXX).\nL'article original sera remplacé par ${qty} fiches individuelles.`)) return;
    try {
      const result = await api.serializeEquipment(eq.id);
      toast.success(`${result.message} UID créés : ${result.created.map(c => c.uid).join(', ')}`);
      setSelectedEquipment(null);
      setDialogEquipment(null);
      loadData();
    } catch (err) {
      toast.error('Erreur sérialisation: ' + err.message);
    }
  };

  const handleSaveSavTicket = async (data) => {
    try {
      if (editingSavTicket) {
        await api.updateSavTicket(editingSavTicket.id, data);
      } else {
        await api.createSavTicket(data);
      }
      setShowSavModal(false);
      setEditingSavTicket(null);
      loadData();
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const handleAssign = async (data) => {
    try {
      await api.createEquipmentAssignment(data);
      setShowAssignModal(false);
      setAssignEquipment(null);
      loadData();
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const handleReturn = async (assignmentId) => {
    try {
      await api.returnEquipmentAssignment(assignmentId);
      loadData();
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const toggleList = async (equipmentId, listType) => {
    try {
      const set = listType === 'favorite' ? favoriteIds : watchIds;
      if (set.has(equipmentId)) {
        await api.removeFromEquipmentList(equipmentId, listType);
      } else {
        await api.addToEquipmentList(equipmentId, listType);
      }
      // Refresh lists only
      const listsData = await api.getEquipmentLists().catch(() => []);
      setEquipmentLists(listsData);
    } catch (err) {
      console.error('Erreur toggle liste:', err);
    }
  };

  // ═══ RENDU ═══
  if (loading && equipment.length === 0) {
    return <div className="eq-loading"><div className="eq-spinner" /> Chargement du parc matériel...</div>;
  }

  return (
    <div className="equipment-panel">
      {/* Toolbar unifiée : onglets + filtres + actions */}
      <div className="eq-toolbar">
        <div className="eq-toolbar-top">
          <div className="eq-tabs">
            <button className={`eq-tab ${subTab === 'inventory' ? 'active' : ''}`} onClick={() => setSubTab('inventory')}>
              <Package size={14} /> Inventaire
            </button>
            <button className={`eq-tab ${subTab === 'sav' ? 'active' : ''}`} onClick={() => setSubTab('sav')}>
              <Wrench size={14} /> SAV
              {stats.openTickets > 0 && <span className="eq-tab-badge">{stats.openTickets}</span>}
            </button>
          </div>
          <div className="eq-stats-row">
            <button className={`eq-stat-btn ${filterStatus === '' && subTab === 'inventory' && listFilter === '' ? 'active' : ''}`} onClick={() => { setFilterStatus(''); setListFilter(''); setSubTab('inventory'); }} title="Tous">
              <Package size={13} />
              <span className="eq-stat-value">{stats.total}</span>
            </button>
            <button className={`eq-stat-btn eq-stat-available ${filterStatus === 'available' ? 'active' : ''}`} onClick={() => { setFilterStatus('available'); setListFilter(''); setSubTab('inventory'); }} title="Disponibles">
              <CheckCircle size={13} />
              <span className="eq-stat-value">{stats.available}</span>
            </button>
            <button className={`eq-stat-btn eq-stat-inuse ${filterStatus === 'in_use' ? 'active' : ''}`} onClick={() => { setFilterStatus('in_use'); setListFilter(''); setSubTab('inventory'); }} title="En service">
              <Clock size={13} />
              <span className="eq-stat-value">{stats.in_use}</span>
            </button>
            <button className={`eq-stat-btn eq-stat-maint ${filterStatus === 'maintenance' ? 'active' : ''}`} onClick={() => { setFilterStatus('maintenance'); setListFilter(''); setSubTab('inventory'); }} title="Maintenance">
              <Wrench size={13} />
              <span className="eq-stat-value">{stats.maintenance}</span>
            </button>
            {stats.openTickets > 0 && (
              <button className={`eq-stat-btn eq-stat-tickets ${subTab === 'sav' ? 'active' : ''}`} onClick={() => { setSavFilterStatus('_active'); setSubTab('sav'); }} title="Tickets SAV">
                <AlertTriangle size={13} />
                <span className="eq-stat-value">{stats.openTickets}</span>
              </button>
            )}
            {favoriteIds.size > 0 && (
              <button className={`eq-stat-btn eq-stat-fav ${listFilter === 'favorite' ? 'active' : ''}`} onClick={() => { setListFilter(listFilter === 'favorite' ? '' : 'favorite'); setSubTab('inventory'); }} title="Favoris">
                <Star size={13} />
                <span className="eq-stat-value">{favoriteIds.size}</span>
              </button>
            )}
            {watchIds.size > 0 && (
              <button className={`eq-stat-btn eq-stat-watch ${listFilter === 'watch' ? 'active' : ''}`} onClick={() => { setListFilter(listFilter === 'watch' ? '' : 'watch'); setSubTab('inventory'); }} title="Surveillance">
                <Eye size={13} />
                <span className="eq-stat-value">{watchIds.size}</span>
              </button>
            )}
          </div>
        </div>

        <div className="eq-toolbar-actions">
          {subTab === 'inventory' && (
            <>
              <div className="eq-search">
                <Search size={14} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                />
                {search && <button className="eq-search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
              </div>
              <CategoryCascadeFilter
                families={families}
                subfamilies={subfamilies}
                leafCategories={leafCategories}
                value={filterCatTree}
                onChange={setFilterCatTree}
              />
              {depotZones && (
                <select className="eq-filter eq-zone-filter" value={filterZone} onChange={(e) => setFilterZone(e.target.value)} title="Filtrer par zone dépôt">
                  <option value="">Toutes zones</option>
                  <option value="_none">📍 Sans zone</option>
                  {depotZones.zones.map(z => <option key={z.id} value={z.id}>📍 {z.label}</option>)}
                </select>
              )}
              {depotZones && (
                <button className={`eq-btn-secondary${showDepotMap ? ' active' : ''}`} onClick={() => setShowDepotMap(!showDepotMap)} title="Plan du dépôt">
                  <Map size={14} />
                </button>
              )}
              <button className="eq-btn-add" onClick={() => { setEditingEquipment(null); setShowEquipmentModal(true); }}>
                <Plus size={14} /> Matériel
              </button>
            </>
          )}
          {subTab === 'sav' && (
            <>
              {isAdmin && (
                <button className="eq-btn-secondary" onClick={() => setShowSavImportModal(true)} title="Importer interventions SAV">
                  <Upload size={14} /> Import SAV
                </button>
              )}
              <button className="eq-btn-secondary" onClick={() => setShowReportModal(true)} title="Rapport maintenance matériel">
                <FileText size={14} /> Rapport
              </button>
              <select className="eq-filter" value={savFilterStatus} onChange={(e) => setSavFilterStatus(e.target.value)}>
                <option value="_active">En cours (actifs)</option>
                <option value="">Tous statuts</option>
                {Object.entries(SAV_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              {canManageEquipmentMaintenance && (
                <button className="eq-btn-add" onClick={() => { setEditingSavTicket(null); setShowSavModal(true); }}>
                  <Plus size={14} /> Ticket SAV
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="eq-content-wrapper">
        <div className="eq-content-inner">
          {/* Plan du dépôt */}
          {showDepotMap && depotZones && subTab === 'inventory' && (
            <div className="eq-depot-map-wrapper">
              <DepotMap
                zones={depotZones}
                stats={locationStats}
                selectedZone={filterZone && filterZone !== '_none' ? filterZone : null}
                onZoneSelect={(zoneId) => setFilterZone(filterZone === zoneId ? '' : zoneId)}
                onZoneFilter={(zoneId) => setFilterZone(zoneId || '')}
              />
            </div>
          )}
          <div className="eq-content">
          {subTab === 'inventory' && (
            <EquipmentGrid
              equipment={filteredEquipment}
              depotZones={depotZones}
              selectedId={selectedEquipment?.id}
              photosList={photosList}
              logosList={logosList}
              favoriteIds={favoriteIds}
              watchIds={watchIds}
              onToggleList={toggleList}
              onSelect={(eq) => {
                clearTimeout(clickTimerRef.current);
                clickTimerRef.current = setTimeout(() => {
                  if (selectedEquipment?.id === eq.id) {
                    setSelectedEquipment(null);
                  } else {
                    // Affichage immédiat avec les données en mémoire
                    setSelectedEquipment(eq);
                    // Enrichir en arrière-plan
                    api.getEquipmentById(eq.id).then(detail => setSelectedEquipment(detail)).catch(() => {});
                  }
                }, 200);
              }}
              onDoubleClick={(eq) => {
                clearTimeout(clickTimerRef.current);
                // Affichage immédiat, enrichir en arrière-plan
                setDialogEquipment(eq);
                api.getEquipmentById(eq.id).then(detail => setDialogEquipment(detail)).catch(() => {});
              }}
            />
          )}

          {subTab === 'sav' && (
          <SavTicketsList
            tickets={filteredTickets}
            equipment={equipment}
            persons={persons}
            selectedId={selectedTicket?.id}
            onSelect={(t) => {
              clearTimeout(ticketClickTimerRef.current);
              ticketClickTimerRef.current = setTimeout(() => {
                setSelectedTicket(selectedTicket?.id === t.id ? null : t);
              }, 200);
            }}
            onDoubleClick={(t) => {
              clearTimeout(ticketClickTimerRef.current);
              setDialogTicket(t);
            }}
            onEdit={(t) => { setEditingSavTicket(t); setShowSavModal(true); }}
            onDelete={async (id) => {
              if (!confirm('Supprimer ce ticket ?')) return;
              await api.deleteSavTicket(id);
              loadData();
            }}
          />
          )}
        </div>
        </div>

        {/* Volet de détail rapide – Matériel (clic simple) */}
        {subTab === 'inventory' && (
          <EquipmentSlidePanel
            equipment={selectedEquipment}
            categories={categories}
            persons={persons}
            photosList={photosList}
            logosList={logosList}
            favoriteIds={favoriteIds}
            watchIds={watchIds}
            onToggleList={toggleList}
            onClose={() => setSelectedEquipment(null)}
            onOpenDialog={(eq) => { setSelectedEquipment(null); setDialogEquipment(eq); }}
            onEdit={(eq) => { setEditingEquipment(eq); setShowEquipmentModal(true); }}
            onAssign={(eq) => { setAssignEquipment(eq); setShowAssignModal(true); }}
            onReturn={handleReturn}
            onPrintLabel={(eq) => setLabelPrintEquipment(eq)}
            onPrintSheet={(eq) => printEquipmentSheet(eq, photosList, logosList)}
            isAdmin={isAdmin}
          />
        )}

        {/* Volet de détail rapide – SAV (clic simple) */}
        {subTab === 'sav' && (
          <SavSlidePanel
            ticket={selectedTicket}
            equipment={equipment}
            persons={persons}
            onClose={() => setSelectedTicket(null)}
            onEdit={(t) => { setEditingSavTicket(t); setShowSavModal(true); }}
            onOpenDialog={(t) => { setSelectedTicket(null); setDialogTicket(t); }}
            onOpenEquipmentDialog={(eq) => { setSelectedTicket(null); setDialogEquipment(eq); }}
          />
        )}
      </div>

      {/* Dialog détail complet (double-clic) */}
      <EquipmentDetailDialog
        equipment={dialogEquipment}
        categories={categories}
        persons={persons}
        photosList={photosList}
        logosList={logosList}
        favoriteIds={favoriteIds}
        watchIds={watchIds}
        onToggleList={toggleList}
        isAdmin={isAdmin}
        onClose={() => setDialogEquipment(null)}
        onEdit={(eq) => { setEditingEquipment(eq); setShowEquipmentModal(true); }}
        onDelete={handleDeleteEquipment}
        onAssign={(eq) => { setAssignEquipment(eq); setShowAssignModal(true); }}
        onReturn={handleReturn}
        onCreateTicket={(eq) => { setEditingSavTicket(null); setShowSavModal(true); }}
        onRefresh={loadData}
        onOpenTicketDialog={(t) => { setDialogEquipment(null); setDialogTicket(t); }}
        onPrintLabel={(eq) => setLabelPrintEquipment(eq)}
        onPrintSheet={(eq) => printEquipmentSheet(eq, photosList, logosList)}
        onSerialize={handleSerializeEquipment}
      />

      {/* Dialog SAV (double-clic) */}
      <SavDetailDialog
        ticket={dialogTicket}
        equipment={equipment}
        persons={persons}
        isAdmin={isAdmin}
        onClose={() => setDialogTicket(null)}
        onEdit={(t) => { setEditingSavTicket(t); setShowSavModal(true); }}
        onDelete={async (id) => {
          if (!confirm('Supprimer ce ticket ?')) return;
          await api.deleteSavTicket(id);
          setDialogTicket(null);
          loadData();
        }}
        onOpenEquipmentDialog={(eq) => { setDialogTicket(null); setDialogEquipment(eq); }}
      />

      {/* Modals */}
      {showEquipmentModal && (
        <EquipmentFormModal
          equipment={editingEquipment}
          categories={categories}
          depotZones={depotZones}
          onSave={handleSaveEquipment}
          onClose={() => { setShowEquipmentModal(false); setEditingEquipment(null); }}
        />
      )}

      {showSavModal && (
        <SavTicketFormModal
          ticket={editingSavTicket}
          equipment={equipment}
          persons={persons}
          preselectedEquipment={selectedEquipment}
          onSave={handleSaveSavTicket}
          onClose={() => { setShowSavModal(false); setEditingSavTicket(null); }}
        />
      )}

      {showAssignModal && assignEquipment && (
        <AssignModal
          equipment={assignEquipment}
          persons={persons}
          onSave={handleAssign}
          onClose={() => { setShowAssignModal(false); setAssignEquipment(null); }}
        />
      )}

      {showImportModal && (
        <EquipmentImportModal
          onClose={() => setShowImportModal(false)}
          onImportDone={loadData}
        />
      )}

      {showSavImportModal && (
        <SavImportModal
          onClose={() => setShowSavImportModal(false)}
          onImportDone={loadData}
        />
      )}

      {labelPrintEquipment && (
        <EquipmentLabelPrint
          equipment={labelPrintEquipment}
          onClose={() => setLabelPrintEquipment(null)}
        />
      )}

      <MaintenanceReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />

      {/* ═══ PANNEAU DE GESTION MATÉRIEL ═══ */}
      {showManagement && (
        <div className="eq-management-overlay" onClick={onCloseManagement}>
          <div className="eq-management-panel" onClick={(e) => e.stopPropagation()}>
            <div className="eq-management-header">
              <h2><Package size={22} /> Gestion du Matériel</h2>
              <button className="eq-management-close" onClick={onCloseManagement}><X size={20} /></button>
            </div>

            {/* Onglets de gestion */}
            <div className="eq-mgmt-tabs">
              {[
                { id: 'imports', label: 'Imports', icon: Upload, color: '#3b82f6' },
                { id: 'categories', label: 'Catégories', icon: Tag, color: '#8b5cf6' },
                { id: 'labels', label: 'Étiquettes', icon: Printer, color: '#f97316' },
                { id: 'stats', label: 'Statistiques', icon: Hash, color: '#10b981' },
                { id: 'media', label: 'Médias', icon: ImageIcon, color: '#ec4899' },
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`eq-mgmt-tab ${mgmtTab === tab.id ? 'active' : ''}`}
                  onClick={() => setMgmtTab(tab.id)}
                  style={{ '--tab-color': tab.color }}
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className={`eq-management-content ${mgmtTab === 'labels' ? 'eq-mgmt-content-labels' : ''}`}>
              {/* Onglet Imports */}
              {mgmtTab === 'imports' && (
                <>
                  <div className="eq-management-section">
                    <h3><Upload size={18} /> Import CSV Inventaire</h3>
                    <p>Importez votre inventaire depuis un fichier CSV (format Locmat ou équivalent). Les familles, sous-familles et catégories seront automatiquement créées.</p>
                    <button className="eq-btn-save" onClick={() => { onCloseManagement(); setShowImportModal(true); }} style={{ marginTop: 12 }}>
                      <Upload size={16} /> Importer un fichier CSV
                    </button>
                  </div>
                  <div className="eq-management-section">
                    <h3><Wrench size={18} /> Import Interventions SAV</h3>
                    <p>Importez les interventions SAV depuis un fichier CSV Locmat. Les interventions seront automatiquement liées aux équipements via leur numéro de série.</p>
                    <button className="eq-btn-save" onClick={() => { onCloseManagement(); setShowSavImportModal(true); }} style={{ marginTop: 12 }}>
                      <Upload size={16} /> Importer les interventions
                    </button>
                  </div>
                </>
              )}

              {/* Onglet Catégories */}
              {mgmtTab === 'categories' && (
                <div className="eq-management-section">
                  <h3><Tag size={18} /> Catégories ({categories.length})</h3>
                  <EquipmentCategoriesTree families={families} subfamilies={subfamilies} leafCategories={leafCategories} categories={categories} equipment={equipment} />
                </div>
              )}

              {/* Onglet Étiquettes */}
              {mgmtTab === 'labels' && (
                <div className="eq-management-section eq-mgmt-labels-section">
                  <EquipmentBatchLabels
                    equipment={equipment}
                    onPrintSingle={(eq) => setLabelPrintEquipment(eq)}
                  />
                </div>
              )}

              {/* Onglet Statistiques */}
              {mgmtTab === 'stats' && (
                <div className="eq-management-section">
                  <h3>📊 Statistiques</h3>
                  <div className="eq-management-stats">
                    <div className="eq-mgmt-stat"><strong>{equipment.length}</strong><span>Équipements</span></div>
                    <div className="eq-mgmt-stat"><strong>{families.length}</strong><span>Familles</span></div>
                    <div className="eq-mgmt-stat"><strong>{subfamilies.length}</strong><span>Sous-familles</span></div>
                    <div className="eq-mgmt-stat"><strong>{leafCategories.length}</strong><span>Catégories</span></div>
                    <div className="eq-mgmt-stat"><strong>{equipment.filter(e => e.status === 'available').length}</strong><span>Disponibles</span></div>
                    <div className="eq-mgmt-stat"><strong>{equipment.filter(e => e.status === 'maintenance').length}</strong><span>En maintenance</span></div>
                  </div>
                </div>
              )}

              {/* Onglet Médias */}
              {mgmtTab === 'media' && (
                <div className="eq-management-section">
                  <h3><ImageIcon size={18} /> Médias ({photosList.length} photos, {logosList.length} logos)</h3>
                  <p>Les photos de <code>public/Photos/Matériel/</code> et les logos de <code>public/Logos/</code> sont automatiquement associés aux équipements par correspondance de nom.</p>
                  <div className="eq-mgmt-media-grid">
                    <div className="eq-mgmt-media-col">
                      <h4>📸 Photos matériel ({photosList.length})</h4>
                      <div className="eq-mgmt-media-list">
                        {photosList.slice(0, 20).map(p => (
                          <div key={p} className="eq-mgmt-media-item">
                            <img src={`/Photos/Matériel/${p}`} alt={p} />
                            <span title={p}>{p.length > 25 ? p.slice(0, 22) + '...' : p}</span>
                          </div>
                        ))}
                        {photosList.length > 20 && <p className="eq-detail-empty">+ {photosList.length - 20} autres photos...</p>}
                        {photosList.length === 0 && <p className="eq-detail-empty">Aucune photo dans Photos/Matériel/</p>}
                      </div>
                    </div>
                    <div className="eq-mgmt-media-col">
                      <h4>🏷️ Logos marques ({logosList.length})</h4>
                      <div className="eq-mgmt-media-list">
                        {logosList.map(l => (
                          <div key={l} className="eq-mgmt-media-item">
                            <img src={`/Logos/${l}`} alt={l} />
                            <span title={l}>{l.length > 25 ? l.slice(0, 22) + '...' : l}</span>
                          </div>
                        ))}
                        {logosList.length === 0 && <p className="eq-detail-empty">Aucun logo dans Logos/</p>}
                      </div>
                    </div>
                  </div>
                  <div className="eq-mgmt-media-legend">
                    <h4><QrCode size={16} /> UID & QR Codes</h4>
                    <p>Chaque équipement possède un UID unique (EMAG-XXXXX) et un QR Code qui renvoie vers l'interface mobile. Le QR Code est accessible depuis la fiche de chaque équipement.</p>
                    <div className="eq-mgmt-uid-example">
                      <QRCodeSVG value={`${APP_BASE_URL}/#/mobile/equipment/EMAG-00001`} size={80} level="M" includeMargin />
                      <div>
                        <code>EMAG-00001</code>
                        <span>→ Menu mobile : Fiche, Défaut, SAV, Intervention</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══ LISTE D'ÉQUIPEMENTS (tableau) ═══
const EquipmentGrid = ({ equipment, depotZones, selectedId, photosList, logosList, favoriteIds, watchIds, onToggleList, onSelect, onDoubleClick }) => {
  if (equipment.length === 0) {
    return (
      <div className="eq-empty">
        <Package size={48} strokeWidth={1} />
        <p>Aucun matériel trouvé</p>
        <span>Ajoutez votre premier équipement avec le bouton +</span>
      </div>
    );
  }

  return (
    <div className="eq-table-wrap">
      <table className="eq-table">
        <thead>
          <tr>
            <th style={{ width: 50 }}></th>
            <th>Nom</th>
            <th>UID</th>
            <th>Référence</th>
            <th>Catégorie</th>
            <th>Marque</th>
            <th>N° Série</th>
            <th>Qté</th>
            <th>Zone</th>
            <th>Statut</th>
            <th>Attribué à</th>
          </tr>
        </thead>
        <tbody>
          {equipment.map(eq => {
            const st = EQUIPMENT_STATUS[eq.status] || EQUIPMENT_STATUS.available;
            const photo = matchPhotoToEquipment(photosList, eq);
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
                  {photo ? (
                    <img src={photo} alt="" className="eq-table-photo" />
                  ) : (
                    <span className="eq-table-photo-placeholder">{eq.categoryIcon || eq.category_icon || '📦'}</span>
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
                <td className="eq-table-uid"><code>{eq.uid || '—'}</code></td>
                <td className="eq-table-ref">{eq.reference || '—'}</td>
                <td>
                  <span className="eq-table-cat" style={{ background: eq.categoryColor || '#6366f1' }}>
                    {eq.categoryIcon || '📦'} {eq.categoryName || '—'}
                  </span>
                </td>
                <td>{eq.brand || '—'}</td>
                <td className="eq-table-serial">{eq.serialNumber || '—'}</td>
                <td className="eq-table-qty">{eq.stockQuantity || 1}</td>
                <td>{(() => {
                  const zoneId = eq.location_zone || eq.locationZone;
                  if (zoneId && depotZones) {
                    const z = depotZones.zones?.find(zn => zn.id === zoneId);
                    if (z) return (
                      <span className="eq-zone-badge" style={{ background: z.color, color: z.textColor || '#fff' }}>
                        {z.label}
                        {(eq.location_code || eq.locationCode) && <span className="eq-zone-code">{eq.location_code || eq.locationCode}</span>}
                      </span>
                    );
                    return zoneId;
                  }
                  return eq.location || '—';
                })()}</td>
                <td>
                  <span className="eq-table-status" style={{ color: st.color }}>
                    {st.icon} {st.label}
                  </span>
                </td>
                <td className="eq-table-assigned">
                  {eq.currentAssignment
                    ? `${eq.currentAssignment.firstName || eq.currentAssignment.first_name || ''} ${eq.currentAssignment.lastName || eq.currentAssignment.last_name || ''}`.trim()
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ═══ CONTENU DÉTAIL PARTAGÉ ═══
const EquipmentDetailContent = ({ eq, isAdmin, compact = false, onEdit, onAssign, onReturn, onCreateTicket, onDelete, onSerialize, onPrintLabel, onPrintSheet, photosList, logosList, favoriteIds, watchIds, onToggleList, onOpenTicketDialog, categories: catList }) => {
  const st = EQUIPMENT_STATUS[eq.status] || EQUIPMENT_STATUS.available;
  const [showQR, setShowQR] = useState(false);
  const photo = matchPhotoToEquipment(photosList || [], eq);
  const logo = matchLogoToBrand(logosList || [], eq.brand);
  const qrUrl = eq.uid ? `${APP_BASE_URL}/#/mobile/equipment/${eq.uid}` : null;
  const isFav = favoriteIds?.has(eq.id);
  const isWatch = watchIds?.has(eq.id);
  const hierarchy = getCategoryHierarchy(eq, catList || []);

  return (
    <div className="eq-detail-body">
      <div className="eq-detail-main">
        {/* Photo + Logo + Actions listes */}
        <div className="eq-detail-media-row">
          {photo && (
            <div className="eq-detail-photo">
              <img src={photo} alt={cleanName(eq.name)} />
            </div>
          )}
          <div className="eq-detail-info-col">
            <div className="eq-detail-title-row">
              <h2>{eq.categoryIcon || eq.category_icon || '📦'} {cleanName(eq.name)}</h2>
            </div>
            <span className="eq-detail-status" style={{ background: st.color }}>{st.icon} {st.label}</span>
            {logo && (
              <div className="eq-detail-brand-logo">
                <img src={logo} alt={eq.brand} title={eq.brand} />
              </div>
            )}
            {/* UID & QR */}
            {eq.uid && (
              <div className="eq-detail-uid-row">
                <Hash size={14} />
                <code className="eq-uid-code">{eq.uid}</code>
                <button className="eq-btn-qr" onClick={() => setShowQR(!showQR)} title="Afficher QR Code">
                  <QrCode size={16} />
                </button>
                {onToggleList && (
                  <>
                    <button className={`eq-btn-list-star ${isFav ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleList(eq.id, 'favorite'); }} title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
                      <Star size={16} fill={isFav ? '#f59e0b' : 'none'} />
                    </button>
                    <button className={`eq-btn-list-eye ${isWatch ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleList(eq.id, 'watch'); }} title={isWatch ? 'Retirer de la surveillance' : 'Mettre en surveillance'}>
                      <Eye size={16} />
                    </button>
                  </>
                )}
              </div>
            )}
            {showQR && qrUrl && (
              <div className="eq-qr-block">
                <QRCodeSVG value={qrUrl} size={compact ? 120 : 180} level="M" includeMargin />
                <span className="eq-qr-url">{qrUrl}</span>
              </div>
            )}
          </div>
        </div>

        <div className="eq-detail-fields">
          {hierarchy && (
            <div className="eq-detail-hierarchy">
              {hierarchy.family && (
                <span className="eq-hier-badge eq-hier-family" style={{ background: hierarchy.family.color || '#6366f1' }}>
                  {hierarchy.family.icon || '📦'} {hierarchy.family.name}
                </span>
              )}
              {hierarchy.subfamily && (
                <>
                  <ChevronRight size={12} className="eq-hier-sep" />
                  <span className="eq-hier-badge eq-hier-sub">{hierarchy.subfamily.name}</span>
                </>
              )}
              {hierarchy.category && (
                <>
                  <ChevronRight size={12} className="eq-hier-sep" />
                  <span className="eq-hier-badge eq-hier-cat">{hierarchy.category.name}</span>
                </>
              )}
            </div>
          )}
          {(eq.reference || eq.serialNumber || eq.serial_number) && (
            <>
              {(eq.reference) && <div className="eq-detail-field"><Tag size={14} /><span>Réf.</span><strong>{eq.reference}</strong></div>}
              {(eq.serialNumber || eq.serial_number) && <div className="eq-detail-field"><Clipboard size={14} /><span>N° série</span><strong>{eq.serialNumber || eq.serial_number}</strong></div>}
            </>
          )}
          {(eq.brand) && <div className="eq-detail-field"><span>🏭</span><span>Marque</span><strong>{eq.brand}</strong></div>}
          {(eq.stockQuantity || eq.stock_quantity) > 1 && <div className="eq-detail-field"><Package size={14} /><span>Quantité</span><strong>{eq.stockQuantity || eq.stock_quantity}</strong></div>}
          {(eq.location_zone || eq.locationZone) && (
            <div className="eq-detail-field"><MapPin size={14} /><span>Zone dépôt</span><strong>{eq.location_zone || eq.locationZone}{(eq.location_code || eq.locationCode) ? ` — ${eq.location_code || eq.locationCode}` : ''}{(eq.location_floor || eq.locationFloor) ? ` (${eq.location_floor || eq.locationFloor})` : ''}</strong></div>
          )}
          {eq.location && <div className="eq-detail-field"><MapPin size={14} /><span>Localisation</span><strong>{eq.location}</strong></div>}
          {(eq.purchaseDate || eq.purchase_date) && <div className="eq-detail-field"><Calendar size={14} /><span>Achat</span><strong>{safeDate(eq.purchaseDate || eq.purchase_date)}</strong></div>}
          {(eq.purchasePrice || eq.purchase_price) && <div className="eq-detail-field"><DollarSign size={14} /><span>Prix</span><strong>{parseFloat(eq.purchasePrice || eq.purchase_price).toFixed(2)} €</strong></div>}
          {(eq.warrantyEnd || eq.warranty_end) && <div className="eq-detail-field"><CheckCircle size={14} /><span>Garantie</span><strong>jusqu'au {safeDate(eq.warrantyEnd || eq.warranty_end)}</strong></div>}
        </div>

        {eq.notes && <div className="eq-detail-notes"><h4>Notes</h4><p>{eq.notes}</p></div>}
      </div>

      {/* Actions (mode dialog) */}
      {!compact && onEdit && (
        <div className="eq-dialog-actions">
          <button className="eq-btn-secondary" onClick={() => onEdit(eq)}><Edit2 size={14} /> Modifier</button>
          {eq.status === 'available' && onAssign && (
            <button className="eq-btn-primary" onClick={() => onAssign(eq)}>
              <User size={14} /> Attribuer
            </button>
          )}
          {onCreateTicket && (
            <button className="eq-btn-secondary" onClick={() => onCreateTicket(eq)}>
              <Wrench size={14} /> Ticket SAV
            </button>
          )}
          {onPrintLabel && (
            <button className="eq-btn-secondary" onClick={() => onPrintLabel(eq)}>
              <Printer size={14} /> Étiquette
            </button>
          )}
          {onPrintSheet && (
            <button className="eq-btn-secondary" onClick={() => onPrintSheet(eq)}>
              <FileText size={14} /> Imprimer fiche
            </button>
          )}
          {isAdmin && onSerialize && (eq.stockQuantity || eq.stock_quantity || 1) > 1 && (
            <button className="eq-btn-secondary" onClick={() => onSerialize(eq)} title={`Scinder en ${eq.stockQuantity || eq.stock_quantity} entités individuelles avec UID`}>
              <Package size={14} /> Sérialiser ({eq.stockQuantity || eq.stock_quantity})
            </button>
          )}
          {isAdmin && onDelete && (
            <button className="eq-btn-danger" onClick={() => onDelete(eq.id)}><Trash2 size={14} /></button>
          )}
        </div>
      )}

      {/* Historique des attributions */}
      <div className="eq-detail-section">
        <h3><User size={16} /> Attributions</h3>
        {(!eq.assignments || eq.assignments.length === 0) ? (
          <p className="eq-detail-empty">Aucune attribution</p>
        ) : (
          <div className="eq-detail-list">
            {eq.assignments.map(a => (
              <div key={a.id} className={`eq-assign-item ${a.status}`}>
                <div className="eq-assign-info">
                  <strong>{a.firstName || a.first_name} {a.lastName || a.last_name}</strong>
                  <span>{safeDate(a.startDate || a.start_date)} → {(a.endDate || a.end_date) ? safeDate(a.endDate || a.end_date) : 'En cours'}</span>
                  {a.notes && <em>{a.notes}</em>}
                </div>
                {a.status === 'active' && onReturn && (
                  <button className="eq-btn-sm" onClick={() => onReturn(a.id)}>
                    <RotateCcw size={12} /> Retour
                  </button>
                )}
                {a.status === 'returned' && <span className="eq-assign-badge returned">Retourné</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interventions SAV */}
      {(() => {
        const tickets = eq.savTickets || [];
        const activeTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting_parts');
        const historyTickets = tickets.filter(t => t.status === 'closed' || t.status === 'resolved');
        
        if (tickets.length === 0) return (
          <div className="eq-detail-section">
            <h3><Wrench size={16} /> Interventions SAV</h3>
            <p className="eq-detail-empty">Aucune intervention</p>
          </div>
        );

        const renderTicket = (t) => {
          const tst = SAV_STATUS[t.status] || SAV_STATUS.open;
          const pri = SAV_PRIORITY[t.priority] || SAV_PRIORITY.medium;
          return (
            <div key={t.id} className={`eq-ticket-item ${onOpenTicketDialog ? 'eq-clickable-ticket' : ''}`} onClick={() => onOpenTicketDialog && onOpenTicketDialog(t)} style={onOpenTicketDialog ? { cursor: 'pointer' } : {}}>
              <div className="eq-ticket-header">
                <span className="eq-ticket-type">{SAV_TYPES[t.type] || t.type}</span>
                <span className="eq-ticket-priority" style={{ color: pri.color }}>{pri.label}</span>
                <span className="eq-ticket-status" style={{ background: tst.color }}>{tst.label}</span>
              </div>
              <strong>{t.title}</strong>
              {!compact && t.description && <p>{t.description}</p>}
              {!compact && t.resolution && <p className="eq-ticket-resolution">✅ {t.resolution}</p>}
              <div className="eq-ticket-meta">
                <span>{safeDate(t.createdAt)} → {safeDate(t.resolvedAt)}</span>
                {t.cost != null && t.cost > 0 && <span>{parseFloat(t.cost).toFixed(2)} €</span>}
              </div>
            </div>
          );
        };

        return (
          <>
            {activeTickets.length > 0 && (
              <div className="eq-detail-section">
                <h3 style={{ color: '#f59e0b' }}><Wrench size={16} /> Interventions en cours ({activeTickets.length})</h3>
                <div className="eq-detail-list">{activeTickets.map(renderTicket)}</div>
              </div>
            )}
            <div className="eq-detail-section">
              <h3><Wrench size={16} /> Historique interventions ({historyTickets.length})</h3>
              {historyTickets.length === 0 ? (
                <p className="eq-detail-empty">Aucun historique</p>
              ) : (
                <div className="eq-detail-list">
                  {(compact ? historyTickets.slice(0, 5) : historyTickets).map(renderTicket)}
                  {compact && historyTickets.length > 5 && (
                    <p className="eq-detail-empty" style={{ fontSize: 11 }}>+ {historyTickets.length - 5} autre(s)… Double-cliquez pour tout voir</p>
                  )}
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
};

// ═══ VOLET LATÉRAL (clic simple) ═══
const EquipmentSlidePanel = ({ equipment: eq, categories, persons, photosList, logosList, favoriteIds, watchIds, onToggleList, onClose, onOpenDialog, onEdit, onAssign, onReturn, onPrintLabel, onPrintSheet, isAdmin }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (eq) {
      setIsVisible(true);
      setIsClosing(false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpen(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsOpen(false);
      setIsClosing(true);
      const timer = setTimeout(() => { setIsVisible(false); setIsClosing(false); }, 350);
      return () => clearTimeout(timer);
    }
  }, [eq]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsClosing(true);
    setTimeout(() => onClose(), 350);
  }, [onClose]);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        const row = e.target.closest('.eq-table-row');
        if (!row) handleClose();
      }
    };
    if (eq && isVisible) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [eq, isVisible, handleClose]);

  if (!isVisible && !eq) return null;

  const currentEq = eq || {};
  const st = EQUIPMENT_STATUS[currentEq.status] || EQUIPMENT_STATUS.available;

  return (
    <div className={`eq-slide-panel ${isClosing ? 'closing' : isOpen ? 'open' : ''}`} ref={panelRef}>
      <div className="eq-slide-header">
        <div className="eq-slide-title-row">
          <span className="eq-slide-name">{cleanName(currentEq.name)}</span>
          <span className="eq-slide-status" style={{ background: st.color }}>{st.icon} {st.label}</span>
        </div>
        <button className="eq-slide-close" onClick={handleClose} title="Fermer">
          <X size={18} />
        </button>
      </div>
      <div className="eq-slide-body">
        <EquipmentDetailContent eq={currentEq} isAdmin={isAdmin} compact={true} onReturn={onReturn} photosList={photosList} logosList={logosList} favoriteIds={favoriteIds} watchIds={watchIds} onToggleList={onToggleList} categories={categories} />
      </div>
      <div className="eq-slide-footer">
        {onPrintLabel && (
          <button className="eq-btn-secondary" onClick={() => onPrintLabel(currentEq)} title="Imprimer étiquette" style={{ padding: '8px 12px' }}>
            <Printer size={14} />
          </button>
        )}
        {onPrintSheet && (
          <button className="eq-btn-secondary" onClick={() => onPrintSheet(currentEq)} title="Imprimer la fiche" style={{ padding: '8px 12px' }}>
            <FileText size={14} />
          </button>
        )}
        <button className="eq-slide-open-btn" onClick={() => { if (onOpenDialog) onOpenDialog(currentEq); }} style={{ flex: 1 }}>
          <ExternalLink size={14} /> Ouvrir la fiche complète
        </button>
      </div>
    </div>
  );
};

// ═══ MODAL DÉTAIL COMPLET (double-clic) ═══
const EquipmentDetailDialog = ({ equipment: eq, categories, persons, isAdmin, photosList, logosList, favoriteIds, watchIds, onToggleList, onClose, onEdit, onDelete, onAssign, onReturn, onCreateTicket, onRefresh, onOpenTicketDialog, onPrintLabel, onPrintSheet, onSerialize }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => { onClose(); setIsClosing(false); }, 200);
  }, [onClose]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose(); };
    if (eq) {
      setIsClosing(false);
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [eq, handleClose]);

  if (!eq) return null;

  const st = EQUIPMENT_STATUS[eq.status] || EQUIPMENT_STATUS.available;

  return (
    <div className={`eq-dialog-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`eq-dialog ${isClosing ? 'closing' : ''}`}>
        <div className="eq-dialog-header">
          <div className="eq-dialog-title-row">
            <span className="eq-dialog-cat" style={{ background: (eq.categoryColor || eq.category_color || '#6366f1') }}>
              {eq.categoryIcon || eq.category_icon || '📦'} {eq.categoryName || eq.category_name || ''}
            </span>
            <span className="eq-dialog-name">{cleanName(eq.name)}</span>
          </div>
          <button className="eq-dialog-close" onClick={handleClose} title="Fermer">
            <X size={20} />
          </button>
        </div>
        <div className="eq-dialog-body">
          <EquipmentDetailContent
            eq={eq}
            isAdmin={isAdmin}
            compact={false}
            onEdit={onEdit}
            onAssign={onAssign}
            onReturn={onReturn}
            onCreateTicket={onCreateTicket}
            onDelete={onDelete}
            photosList={photosList}
            logosList={logosList}
            favoriteIds={favoriteIds}
            watchIds={watchIds}
            onToggleList={onToggleList}
            onOpenTicketDialog={onOpenTicketDialog}
            onPrintLabel={onPrintLabel}
            onPrintSheet={onPrintSheet}
            onSerialize={onSerialize}
            categories={categories}
          />
        </div>
      </div>
    </div>
  );
};

// ═══ LISTE DES TICKETS SAV ═══
const SavTicketsList = ({ tickets, equipment, persons, selectedId, onSelect, onDoubleClick, onEdit, onDelete }) => {
  if (tickets.length === 0) {
    return (
      <div className="eq-empty">
        <Wrench size={48} strokeWidth={1} />
        <p>Aucun ticket SAV</p>
        <span>Les tickets apparaîtront ici lorsque du matériel nécessitera une intervention</span>
      </div>
    );
  }

  return (
    <div className="eq-tickets-table">
      <table>
        <thead>
          <tr>
            <th>Priorité</th>
            <th>Titre</th>
            <th>Matériel</th>
            <th>Type</th>
            <th>Statut</th>
            <th>Début</th>
            <th>Fin</th>
            <th>Coût</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map(t => {
            const tst = SAV_STATUS[t.status] || SAV_STATUS.open;
            const pri = SAV_PRIORITY[t.priority] || SAV_PRIORITY.medium;
            return (
              <tr key={t.id} className={selectedId === t.id ? 'selected' : ''} onClick={() => onSelect && onSelect(t)} onDoubleClick={() => onDoubleClick && onDoubleClick(t)} style={{ cursor: 'pointer' }}>
                <td><span className="eq-pri-dot" style={{ background: pri.color }} title={pri.label} /></td>
                <td className="eq-ticket-title-cell">{t.title}</td>
                <td>
                  <span className="eq-ticket-eq">{t.categoryIcon} {t.equipmentName || <em style={{ color: '#9ca3af' }}>Non lié</em>}</span>
                </td>
                <td>{SAV_TYPES[t.type] || t.type}</td>
                <td><span className="eq-status-badge" style={{ background: tst.color }}>{tst.label}</span></td>
                <td>{safeDate(t.createdAt)}</td>
                <td>{safeDate(t.resolvedAt)}</td>
                <td>{t.cost != null ? `${parseFloat(t.cost).toFixed(2)} €` : '—'}</td>
                <td>
                  <div className="eq-table-actions">
                    <button onClick={() => onEdit(t)} title="Modifier"><Edit2 size={14} /></button>
                    <button onClick={() => onDelete(t.id)} title="Supprimer" className="eq-btn-danger-sm"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ═══ MODAL FORMULAIRE ÉQUIPEMENT ═══
const EquipmentFormModal = ({ equipment: eq, categories, depotZones, onSave, onClose }) => {
  // Hiérarchie des catégories
  const families = useMemo(() => categories.filter(c => c.level === 'family'), [categories]);
  const subfamilies = useMemo(() => categories.filter(c => c.level === 'subfamily'), [categories]);
  const leafCategories = useMemo(() => categories.filter(c => c.level === 'category'), [categories]);
  // Trouver les parents de la catégorie actuelle
  const findParents = useCallback((catId) => {
    if (!catId) return { familyId: '', subfamilyId: '', categoryId: '' };
    const cat = categories.find(c => c.id === catId);
    if (!cat) return { familyId: '', subfamilyId: '', categoryId: '' };
    if (cat.level === 'family') return { familyId: String(cat.id), subfamilyId: '', categoryId: '' };
    if (cat.level === 'subfamily') return { familyId: String(cat.parent_id || ''), subfamilyId: String(cat.id), categoryId: '' };
    // level === 'category'
    const sf = categories.find(c => c.id === cat.parent_id);
    return { familyId: String(sf?.parent_id || ''), subfamilyId: String(cat.parent_id || ''), categoryId: String(cat.id) };
  }, [categories]);

  const parents = findParents(eq?.category_id);
  
  const [form, setForm] = useState({
    name: eq?.name || '',
    reference: eq?.reference || '',
    serial_number: eq?.serial_number || '',
    family_id: parents.familyId,
    subfamily_id: parents.subfamilyId,
    category_id: parents.categoryId || (eq?.category_id ? String(eq.category_id) : ''),
    status: eq?.status || 'available',
    location: eq?.location || '',
    location_zone: eq?.location_zone || eq?.locationZone || '',
    location_code: eq?.location_code || eq?.locationCode || '',
    location_floor: eq?.location_floor || eq?.locationFloor || '',
    purchase_date: eq?.purchase_date || '',
    purchase_price: eq?.purchase_price || '',
    warranty_end: eq?.warranty_end || '',
    notes: eq?.notes || '',
    brand: eq?.brand || '',
    stock_quantity: eq?.stock_quantity || 1,
  });

  const currentSubfamilies = useMemo(() => {
    if (!form.family_id) return [];
    return subfamilies.filter(sf => sf.parent_id === parseInt(form.family_id));
  }, [form.family_id, subfamilies]);

  const currentLeafCategories = useMemo(() => {
    if (!form.subfamily_id) return [];
    return leafCategories.filter(c => c.parent_id === parseInt(form.subfamily_id));
  }, [form.subfamily_id, leafCategories]);

  // La category_id finale à envoyer au serveur
  const resolvedCategoryId = form.category_id || form.subfamily_id || form.family_id || '';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.warning('Nom requis');
    onSave({
      ...form,
      category_id: resolvedCategoryId ? parseInt(resolvedCategoryId) : null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      stock_quantity: form.stock_quantity ? parseInt(form.stock_quantity) : 1,
      location_zone: form.location_zone || null,
      location_code: form.location_code || null,
      location_floor: form.location_floor || null,
    });
  };

  return (
    <div className="eq-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="eq-modal">
        <div className="eq-modal-header">
          <h3>{eq ? '✏️ Modifier l\'équipement' : '➕ Nouveau matériel'}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="eq-modal-body">
          <div className="eq-form-grid">
            <div className="eq-form-field eq-form-full">
              <label>Nom *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Enceinte 2 voies 8XT" autoFocus />
            </div>
            <div className="eq-form-field">
              <label>Référence / Code</label>
              <input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Ex: MTD108-8XT" />
            </div>
            <div className="eq-form-field">
              <label>N° de série</label>
              <input type="text" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            </div>
            <div className="eq-form-field">
              <label>Marque</label>
              <input type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Ex: L-ACOUSTICS" />
            </div>
            <div className="eq-form-field">
              <label>Quantité / Stock</label>
              <input type="number" min="1" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
            </div>
            <div className="eq-form-field">
              <label>Famille</label>
              <select value={form.family_id} onChange={(e) => setForm({ ...form, family_id: e.target.value, subfamily_id: '', category_id: '' })}>
                <option value="">— Sélectionner —</option>
                {families.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
              </select>
            </div>
            <div className="eq-form-field">
              <label>Sous-famille</label>
              <select value={form.subfamily_id} onChange={(e) => setForm({ ...form, subfamily_id: e.target.value, category_id: '' })} disabled={!form.family_id}>
                <option value="">— Sélectionner —</option>
                {currentSubfamilies.map(sf => <option key={sf.id} value={sf.id}>{sf.name}</option>)}
              </select>
            </div>
            <div className="eq-form-field">
              <label>Catégorie</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} disabled={!form.subfamily_id}>
                <option value="">— Sélectionner —</option>
                {currentLeafCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="eq-form-field">
              <label>Statut</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(EQUIPMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div className="eq-form-field">
              <label>Localisation / Zone</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ex: Dépôt A, Étagère 3" />
            </div>
            {depotZones && (
              <div className="eq-form-field eq-form-full">
                <LocationSelector
                  zones={depotZones}
                  value={{
                    location_zone: form.location_zone,
                    location_code: form.location_code,
                    location_floor: form.location_floor,
                  }}
                  onChange={(loc) => setForm(f => ({
                    ...f,
                    location_zone: loc.location_zone || '',
                    location_code: loc.location_code || '',
                    location_floor: loc.location_floor || '',
                  }))}
                />
              </div>
            )}
            <div className="eq-form-field">
              <label>Date d'achat</label>
              <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
            </div>
            <div className="eq-form-field">
              <label>Prix d'achat (€)</label>
              <input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
            </div>
            <div className="eq-form-field">
              <label>Fin de garantie</label>
              <input type="date" value={form.warranty_end} onChange={(e) => setForm({ ...form, warranty_end: e.target.value })} />
            </div>
            <div className="eq-form-field eq-form-full">
              <label>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Remarques, accessoires inclus..." />
            </div>
          </div>
          <div className="eq-modal-footer">
            <button type="button" className="eq-btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="eq-btn-save">{eq ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═══ MODAL TICKET SAV ═══
const SavTicketFormModal = ({ ticket, equipment, persons, preselectedEquipment, onSave, onClose }) => {
  const [form, setForm] = useState({
    equipment_id: ticket?.equipmentId || ticket?.equipment_id || preselectedEquipment?.id || '',
    assigned_to: ticket?.assignedTo || ticket?.assigned_to || '',
    type: ticket?.type || 'panne',
    priority: ticket?.priority || 'medium',
    status: ticket?.status || 'open',
    title: ticket?.title || '',
    description: ticket?.description || '',
    resolution: ticket?.resolution || '',
    cost: ticket?.cost || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.equipment_id || !form.title.trim()) return toast.warning('Équipement et titre requis');
    onSave({
      ...form,
      equipment_id: parseInt(form.equipment_id),
      assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null,
      cost: form.cost ? parseFloat(form.cost) : null,
    });
  };

  return (
    <div className="eq-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="eq-modal">
        <div className="eq-modal-header">
          <h3>{ticket ? '✏️ Modifier le ticket' : '🔧 Nouveau ticket SAV'}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="eq-modal-body">
          <div className="eq-form-grid">
            <div className="eq-form-field eq-form-full">
              <label>Équipement *</label>
              <select value={form.equipment_id} onChange={(e) => setForm({ ...form, equipment_id: e.target.value })} required>
                <option value="">— Sélectionner —</option>
                {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.category_icon} {cleanName(eq.name)} {eq.reference ? `(${eq.reference})` : ''}</option>)}
              </select>
            </div>
            <div className="eq-form-field eq-form-full">
              <label>Titre *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Batterie ne charge plus" autoFocus />
            </div>
            <div className="eq-form-field">
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(SAV_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="eq-form-field">
              <label>Priorité</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {Object.entries(SAV_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {ticket && (
              <div className="eq-form-field">
                <label>Statut</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(SAV_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            )}
            <div className="eq-form-field">
              <label>Technicien assigné</label>
              <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">— Non assigné —</option>
                {persons.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
            </div>
            <div className="eq-form-field eq-form-full">
              <label>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Détails du problème, circonstances..." />
            </div>
            {ticket && (
              <>
                <div className="eq-form-field eq-form-full">
                  <label>Résolution</label>
                  <textarea value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} rows={2} placeholder="Action corrective, pièces changées..." />
                </div>
                <div className="eq-form-field">
                  <label>Coût (€)</label>
                  <input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
                </div>
              </>
            )}
          </div>
          <div className="eq-modal-footer">
            <button type="button" className="eq-btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="eq-btn-save">{ticket ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═══ MODAL ATTRIBUTION ═══
const AssignModal = ({ equipment: eq, persons, onSave, onClose }) => {
  const [form, setForm] = useState({
    equipment_id: eq.id,
    assigned_to: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    affaire_id: '',
    notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.assigned_to) return toast.warning('Veuillez sélectionner une personne');
    onSave({
      ...form,
      assigned_to: parseInt(form.assigned_to),
    });
  };

  return (
    <div className="eq-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="eq-modal eq-modal-sm">
        <div className="eq-modal-header">
          <h3>👤 Attribuer : {cleanName(eq.name)}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="eq-modal-body">
          <div className="eq-form-grid">
            <div className="eq-form-field eq-form-full">
              <label>Attribuer à *</label>
              <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} required autoFocus>
                <option value="">— Sélectionner —</option>
                {persons.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
            </div>
            <div className="eq-form-field">
              <label>Date de début</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="eq-form-field">
              <label>Date de retour prévue</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div className="eq-form-field eq-form-full">
              <label>Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex: Pour chantier Rouen" />
            </div>
          </div>
          <div className="eq-modal-footer">
            <button type="button" className="eq-btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="eq-btn-save">Attribuer</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═══ VOLET LATÉRAL SAV (clic simple) ═══
const SavSlidePanel = ({ ticket, equipment, persons, onClose, onEdit, onOpenDialog, onOpenEquipmentDialog }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (ticket) {
      setIsVisible(true);
      setIsClosing(false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpen(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsOpen(false);
      setIsClosing(true);
      const timer = setTimeout(() => { setIsVisible(false); setIsClosing(false); }, 350);
      return () => clearTimeout(timer);
    }
  }, [ticket]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsClosing(true);
    setTimeout(() => onClose(), 350);
  }, [onClose]);

  if (!isVisible && !ticket) return null;

  const t = ticket || {};
  const tst = SAV_STATUS[t.status] || SAV_STATUS.open;
  const pri = SAV_PRIORITY[t.priority] || SAV_PRIORITY.medium;
  const eq = equipment.find(e => e.id === t.equipmentId);

  return (
    <div className={`eq-slide-panel ${isClosing ? 'closing' : isOpen ? 'open' : ''}`} ref={panelRef}>
      <div className="eq-slide-header">
        <div className="eq-slide-title-row">
          <span className="eq-slide-name" style={{ fontSize: 15 }}>🔧 {t.title}</span>
          <span className="eq-slide-status" style={{ background: tst.color }}>{tst.label}</span>
        </div>
        <button className="eq-slide-close" onClick={handleClose} title="Fermer">
          <X size={18} />
        </button>
      </div>
      <div className="eq-slide-body">
        <div className="eq-detail-fields">
          <div className="eq-detail-field"><span>🎯</span><span>Priorité</span><strong style={{ color: pri.color }}>{pri.label}</strong></div>
          <div className="eq-detail-field"><span>🔧</span><span>Type</span><strong>{SAV_TYPES[t.type] || t.type}</strong></div>
          {eq && <div className="eq-detail-field"><Package size={14} /><span>Matériel</span><strong className="eq-clickable-link" onClick={() => onOpenEquipmentDialog && onOpenEquipmentDialog(eq)}>{eq.categoryIcon || '📦'} {cleanName(eq.name)}</strong></div>}
          <div className="eq-detail-field"><Calendar size={14} /><span>Créé le</span><strong>{safeDate(t.createdAt)}</strong></div>
          {t.resolvedAt && <div className="eq-detail-field"><CheckCircle size={14} /><span>Résolu le</span><strong>{safeDate(t.resolvedAt)}</strong></div>}
          {t.cost != null && t.cost > 0 && <div className="eq-detail-field"><DollarSign size={14} /><span>Coût</span><strong>{parseFloat(t.cost).toFixed(2)} €</strong></div>}
        </div>
        {t.description && <div className="eq-detail-notes"><h4>Description</h4><p>{t.description}</p></div>}
        {t.resolution && <div className="eq-detail-notes"><h4>✅ Résolution</h4><p>{t.resolution}</p></div>}
      </div>
      <div className="eq-slide-footer">
        <button className="eq-btn-secondary" onClick={() => onEdit(t)} style={{ flex: 1 }}><Edit2 size={14} /> Modifier</button>
        <button className="eq-slide-open-btn" onClick={() => onOpenDialog(t)} style={{ flex: 1 }}>
          <ExternalLink size={14} /> Fiche complète
        </button>
      </div>
    </div>
  );
};

// ═══ DIALOG DÉTAIL SAV (double-clic) ═══
const SavDetailDialog = ({ ticket, equipment, persons, isAdmin, onClose, onEdit, onDelete, onOpenEquipmentDialog }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => { onClose(); setIsClosing(false); }, 200);
  }, [onClose]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose(); };
    if (ticket) {
      setIsClosing(false);
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [ticket, handleClose]);

  if (!ticket) return null;

  const t = ticket;
  const tst = SAV_STATUS[t.status] || SAV_STATUS.open;
  const pri = SAV_PRIORITY[t.priority] || SAV_PRIORITY.medium;
  const eq = equipment.find(e => e.id === t.equipmentId);
  const tech = t.assignedTo ? persons.find(p => p.id === t.assignedTo) : null;

  return (
    <div className={`eq-dialog-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`eq-dialog ${isClosing ? 'closing' : ''}`} style={{ maxWidth: 600 }}>
        <div className="eq-dialog-header">
          <div className="eq-dialog-title-row">
            <span className="eq-dialog-cat" style={{ background: tst.color }}>
              🔧 {tst.label}
            </span>
            <span className="eq-dialog-name">{t.title}</span>
          </div>
          <button className="eq-dialog-close" onClick={handleClose} title="Fermer">
            <X size={20} />
          </button>
        </div>
        <div className="eq-dialog-body">
          <div className="eq-detail-body">
            <div className="eq-detail-fields">
              <div className="eq-detail-field"><span>🎯</span><span>Priorité</span><strong style={{ color: pri.color }}>{pri.label}</strong></div>
              <div className="eq-detail-field"><span>🔧</span><span>Type</span><strong>{SAV_TYPES[t.type] || t.type}</strong></div>
              {eq && <div className="eq-detail-field"><Package size={14} /><span>Matériel</span><strong className="eq-clickable-link" onClick={() => onOpenEquipmentDialog && onOpenEquipmentDialog(eq)}>{eq.categoryIcon || '📦'} {cleanName(eq.name)} {eq.reference ? `(${eq.reference})` : ''}</strong></div>}
              {tech && <div className="eq-detail-field"><User size={14} /><span>Technicien</span><strong>{tech.firstName} {tech.lastName}</strong></div>}
              <div className="eq-detail-field"><Calendar size={14} /><span>Créé le</span><strong>{safeDate(t.createdAt)}</strong></div>
              {t.resolvedAt && <div className="eq-detail-field"><CheckCircle size={14} /><span>Résolu le</span><strong>{safeDate(t.resolvedAt)}</strong></div>}
              {t.cost != null && t.cost > 0 && <div className="eq-detail-field"><DollarSign size={14} /><span>Coût</span><strong>{parseFloat(t.cost).toFixed(2)} €</strong></div>}
            </div>
            {t.description && <div className="eq-detail-notes"><h4>Description</h4><p>{t.description}</p></div>}
            {t.resolution && <div className="eq-detail-notes"><h4>✅ Résolution</h4><p>{t.resolution}</p></div>}
            
            <div className="eq-dialog-actions">
              <button className="eq-btn-secondary" onClick={() => onEdit(t)}><Edit2 size={14} /> Modifier</button>
              {isAdmin && <button className="eq-btn-danger" onClick={() => onDelete(t.id)}><Trash2 size={14} /> Supprimer</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(EquipmentPanel);
