import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Package, Search, Plus, Filter, Wrench, AlertTriangle, CheckCircle, Clock, X, ChevronRight, Edit2, Trash2, RotateCcw, Tag, MapPin, Calendar, DollarSign, User, Clipboard, Upload, ExternalLink, Star, Eye, QrCode, Image as ImageIcon, Hash, Printer, FileText, Map, ZoomIn, Link2, Download, Camera } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../utils/api';
import { safeDate } from '../../utils/formatUtils';
import EquipmentImportModal from './EquipmentImportModal';
import SavImportModal from '../affaires/SavImportModal';
import EquipmentLabelPrint from './EquipmentLabelPrint';
import EquipmentBatchLabels from './EquipmentBatchLabels';
import { printEquipmentSheet } from './EquipmentSheetPrint';
import MaintenanceReportModal from '../vehicles/MaintenanceReportModal';
import LocationSelector from '../vehicles/LocationSelector';
import DepotMap from '../vehicles/DepotMap';
import './EquipmentPanel.css';
import { useToast } from '../../hooks/useToast';
import { resolveGenericImage, getAllGenericImages, GENERIC_IMAGES } from '../../utils/genericImages';

// Recherche flexible de zone : exact → codes → préfixe (ex: "G" → "G1", "A3" → "A1")
const findZone = (zoneList, zid) => {
  if (!zoneList || !zid) return null;
  const exact = zoneList.find(z => z.id === zid || z.codes?.includes(zid));
  if (exact) return exact;
  const upper = zid.toUpperCase();
  return zoneList.find(z => z.id.toUpperCase().startsWith(upper) || upper.startsWith(z.id.toUpperCase())) || null;
};

// ═══ CONSTANTES ═══
const EQUIPMENT_STATUS = {
  available: { label: 'Disponible', color: '#10b981', icon: '✅' },
  in_use: { label: 'En service', color: '#3b82f6', icon: '🔄' },
  maintenance: { label: 'En maintenance', color: '#f59e0b', icon: '🔧' },
  retired: { label: 'Réformé', color: 'var(--theme-text-gray)', icon: '⛔' },
};

const SAV_STATUS = {
  open: { label: 'Ouvert', color: '#ef4444' },
  in_progress: { label: 'En cours', color: '#f59e0b' },
  waiting_parts: { label: 'Attente pièces', color: '#8b5cf6' },
  resolved: { label: 'Résolu', color: '#10b981' },
  closed: { label: 'Clôturé', color: 'var(--theme-text-gray)' },
};

const SAV_PRIORITY = {
  low: { label: 'Basse', color: 'var(--theme-text-gray)' },
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
  // Priorité 0 : image générique manuellement choisie (format "generic:group/key")
  if (eq.photo && eq.photo.startsWith('generic:')) {
    const [groupKey, key] = eq.photo.slice(8).split('/');
    return GENERIC_IMAGES[groupKey]?.[key] || null;
  }
  if (!photos || photos.length === 0) return null;
  // Priorité : photo manuellement associée en DB
  if (eq.photo) {
    if (photos.includes(eq.photo)) return `/Photos/Matériel/${eq.photo}`;
  }
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

// ═══ FILTRE CATÉGORIES EN CASCADE (hover desktop / accordion mobile) ═══
const CategoryCascadeFilter = ({ families, subfamilies, leafCategories, value, onChange, isMobile }) => {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredFamily, setHoveredFamily] = useState(null);
  const [hoveredSub, setHoveredSub] = useState(null);
  // Mobile: expanded state (accordion)
  const [expandedFamily, setExpandedFamily] = useState(null);
  const [expandedSub, setExpandedSub] = useState(null);
  const containerRef = useRef(null);
  const closeTimer = useRef(null);

  const startClose = () => { if (isMobile) return; closeTimer.current = setTimeout(() => { setIsOpen(false); setHoveredFamily(null); setHoveredSub(null); }, 200); };
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false); setHoveredFamily(null); setHoveredSub(null);
        setExpandedFamily(null); setExpandedSub(null);
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
    if (type === 'subfamily') { const sf = subfamilies.find(x => x.id === id); return sf ? `${sf.icon || '📂'} ${sf.name}` : value; }
    if (type === 'category') { const c = leafCategories.find(x => x.id === id); return c ? `${c.icon || '📄'} ${c.name}` : value; }
    return value;
  };

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false); setHoveredFamily(null); setHoveredSub(null);
    setExpandedFamily(null); setExpandedSub(null);
  };

  return (
    <div className="eq-cascade-filter" ref={containerRef} onMouseLeave={startClose} onMouseEnter={cancelClose}>
      <button className={`eq-cascade-btn ${value ? 'active' : ''}`} onClick={() => { setIsOpen(!isOpen); setExpandedFamily(null); setExpandedSub(null); }}>
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
            const isHovered = !isMobile && hoveredFamily === fam.id;
            const isExpanded = isMobile && expandedFamily === fam.id;
            const showSubs = isHovered || isExpanded;
            return (
              <div key={fam.id} className="eq-cascade-family-wrap">
                <div className={`eq-cascade-item ${showSubs ? 'hovered' : ''} ${value === `family:${fam.id}` ? 'selected' : ''}`}
                  onMouseEnter={!isMobile ? () => { setHoveredFamily(fam.id); setHoveredSub(null); cancelClose(); } : undefined}
                  onClick={() => {
                    if (isMobile && subs.length > 0) {
                      // Toggle accordion : tap pour ouvrir/fermer les sous-familles
                      setExpandedFamily(expandedFamily === fam.id ? null : fam.id);
                      setExpandedSub(null);
                    } else {
                      handleSelect(`family:${fam.id}`);
                    }
                  }}>
                  <span className="eq-cascade-icon" style={{ color: fam.color || 'var(--theme-text-gray)' }}>{fam.icon || '📦'}</span>
                  <span className="eq-cascade-label">{fam.name}</span>
                  {subs.length > 0 && <ChevronRight size={12} className={`eq-cascade-sub-arrow${isExpanded ? ' eq-cascade-expanded' : ''}`} />}
                </div>
                {isMobile && isExpanded && subs.length > 0 && (
                  <div className="eq-cascade-menu eq-cascade-l2">
                    <div className="eq-cascade-item eq-cascade-all" onClick={(e) => { e.stopPropagation(); handleSelect(`family:${fam.id}`); }}>
                      Toute la famille
                    </div>
                    {subs.map(sf => {
                      const cats = leafCategories.filter(c => (c.parentId || c.parent_id) === sf.id);
                      const isSubExpanded = expandedSub === sf.id;
                      return (
                        <div key={sf.id}>
                          <div className={`eq-cascade-item ${isSubExpanded ? 'hovered' : ''} ${value === `subfamily:${sf.id}` ? 'selected' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (cats.length > 0) {
                                setExpandedSub(expandedSub === sf.id ? null : sf.id);
                              } else {
                                handleSelect(`subfamily:${sf.id}`);
                              }
                            }}>
                            <span className="eq-cascade-icon" style={{ color: sf.color || 'var(--theme-text-gray)' }}>{sf.icon || '📂'}</span>
                            <span className="eq-cascade-label">{sf.name}</span>
                            {cats.length > 0 && <ChevronRight size={12} className={`eq-cascade-sub-arrow${isSubExpanded ? ' eq-cascade-expanded' : ''}`} />}
                          </div>
                          {isSubExpanded && cats.length > 0 && (
                            <div className="eq-cascade-menu eq-cascade-l3">
                              <div className="eq-cascade-item eq-cascade-all" onClick={(e) => { e.stopPropagation(); handleSelect(`subfamily:${sf.id}`); }}>
                                Toute la sous-famille
                              </div>
                              {cats.map(cat => (
                                <div key={cat.id} className={`eq-cascade-item ${value === `category:${cat.id}` ? 'selected' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); handleSelect(`category:${cat.id}`); }}>
                                  <span className="eq-cascade-icon" style={{ color: cat.color || 'var(--theme-text-gray)' }}>{cat.icon || '📄'}</span>
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
                {!isMobile && isHovered && subs.length > 0 && (
                  <div className="eq-cascade-menu eq-cascade-l2" onMouseEnter={cancelClose}>
                    {subs.map(sf => {
                      const cats = leafCategories.filter(c => (c.parentId || c.parent_id) === sf.id);
                      const isSubHovered = hoveredSub === sf.id;
                      return (
                        <div key={sf.id} className="eq-cascade-sub-wrap">
                          <div className={`eq-cascade-item ${isSubHovered ? 'hovered' : ''} ${value === `subfamily:${sf.id}` ? 'selected' : ''}`}
                            onMouseEnter={() => { setHoveredSub(sf.id); cancelClose(); }}
                            onClick={(e) => { e.stopPropagation(); handleSelect(`subfamily:${sf.id}`); }}>
                            <span className="eq-cascade-icon" style={{ color: sf.color || 'var(--theme-text-gray)' }}>{sf.icon || '📂'}</span>
                            <span className="eq-cascade-label">{sf.name}</span>
                            {cats.length > 0 && <ChevronRight size={12} className="eq-cascade-sub-arrow" />}
                          </div>
                          {isSubHovered && cats.length > 0 && (
                            <div className="eq-cascade-menu eq-cascade-l3" onMouseEnter={cancelClose}>
                              {cats.map(cat => (
                                <div key={cat.id} className={`eq-cascade-item ${value === `category:${cat.id}` ? 'selected' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); handleSelect(`category:${cat.id}`); }}>
                                  <span className="eq-cascade-icon" style={{ color: cat.color || 'var(--theme-text-gray)' }}>{cat.icon || '📄'}</span>
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

// ═══ SÉLECTEUR CASCADE CATÉGORIE (pour formulaire) ═══
const CategoryCascadePicker = ({ families, subfamilies, leafCategories, value, onChange }) => {
  // value = { family_id, subfamily_id, category_id }
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
    const parts = [];
    if (value.family_id) {
      const f = families.find(x => x.id === parseInt(value.family_id));
      if (f) parts.push(`${f.icon || '📦'} ${f.name}`);
    }
    if (value.subfamily_id) {
      const sf = subfamilies.find(x => x.id === parseInt(value.subfamily_id));
      if (sf) parts.push(`${sf.icon || '📂'} ${sf.name}`);
    }
    if (value.category_id) {
      const c = leafCategories.find(x => x.id === parseInt(value.category_id));
      if (c) parts.push(`${c.icon || '📄'} ${c.name}`);
    }
    return parts.length > 0 ? parts.join(' › ') : '— Sélectionner une catégorie —';
  };

  const handleSelect = (familyId, subfamilyId, categoryId) => {
    onChange({
      family_id: familyId ? String(familyId) : '',
      subfamily_id: subfamilyId ? String(subfamilyId) : '',
      category_id: categoryId ? String(categoryId) : '',
    });
    setIsOpen(false); setHoveredFamily(null); setHoveredSub(null);
  };

  return (
    <div className="eq-cascade-filter eq-cascade-picker" ref={containerRef} onMouseLeave={startClose} onMouseEnter={cancelClose}>
      <button type="button" className={`eq-cascade-btn eq-cascade-picker-btn ${value.family_id ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)}>
        <Tag size={13} />
        <span>{getLabel()}</span>
        <ChevronRight size={12} className={`eq-cascade-arrow ${isOpen ? 'open' : ''}`} />
      </button>
      {isOpen && (
        <div className="eq-cascade-menu eq-cascade-l1 eq-cascade-picker-menu">
          <div className="eq-cascade-item eq-cascade-all" onClick={() => handleSelect('', '', '')}>
            Aucune catégorie
          </div>
          {families.map(fam => {
            const subs = subfamilies.filter(s => (s.parentId || s.parent_id) === fam.id);
            const isHovered = hoveredFamily === fam.id;
            return (
              <div key={fam.id} className="eq-cascade-family-wrap">
                <div className={`eq-cascade-item ${isHovered ? 'hovered' : ''} ${value.family_id === String(fam.id) && !value.subfamily_id ? 'selected' : ''}`}
                  onMouseEnter={() => { setHoveredFamily(fam.id); setHoveredSub(null); cancelClose(); }}
                  onClick={() => handleSelect(fam.id, '', '')}>
                  <span className="eq-cascade-icon" style={{ color: fam.color || 'var(--theme-text-gray)' }}>{fam.icon || '📦'}</span>
                  <span className="eq-cascade-label">{fam.name}</span>
                  {subs.length > 0 && <ChevronRight size={12} className="eq-cascade-sub-arrow" />}
                </div>
                {isHovered && subs.length > 0 && (
                  <div className="eq-cascade-menu eq-cascade-l2" onMouseEnter={cancelClose}>
                    {subs.map(sf => {
                      const cats = leafCategories.filter(c => (c.parentId || c.parent_id) === sf.id);
                      const isSubHovered = hoveredSub === sf.id;
                      return (
                        <div key={sf.id} className="eq-cascade-sub-wrap">
                          <div className={`eq-cascade-item ${isSubHovered ? 'hovered' : ''} ${value.subfamily_id === String(sf.id) && !value.category_id ? 'selected' : ''}`}
                            onMouseEnter={() => { setHoveredSub(sf.id); cancelClose(); }}
                            onClick={(e) => { e.stopPropagation(); handleSelect(fam.id, sf.id, ''); }}>
                            <span className="eq-cascade-icon" style={{ color: sf.color || 'var(--theme-text-gray)' }}>{sf.icon || '📂'}</span>
                            <span className="eq-cascade-label">{sf.name}</span>
                            {cats.length > 0 && <ChevronRight size={12} className="eq-cascade-sub-arrow" />}
                          </div>
                          {isSubHovered && cats.length > 0 && (
                            <div className="eq-cascade-menu eq-cascade-l3" onMouseEnter={cancelClose}>
                              {cats.map(cat => (
                                <div key={cat.id} className={`eq-cascade-item ${value.category_id === String(cat.id) ? 'selected' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); handleSelect(fam.id, sf.id, cat.id); }}>
                                  <span className="eq-cascade-icon" style={{ color: cat.color || 'var(--theme-text-gray)' }}>{cat.icon || '📄'}</span>
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
              <span className="eq-cat-family-icon" style={{ color: fam.color || 'var(--theme-text-gray)' }}>{fam.icon || '📦'}</span>
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
const EquipmentPanel = ({ currentUser, showManagement, onCloseManagement, initialTab, isMobile }) => {
  const [subTab, setSubTab] = useState(initialTab || 'inventory'); // inventory | sav
  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [savTickets, setSavTickets] = useState([]);
  const [persons, setPersons] = useState([]);
  const [brandsList, setBrandsList] = useState([]);
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
  const [savTicketEquipment, setSavTicketEquipment] = useState(null);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [dialogEquipment, setDialogEquipment] = useState(null);
  const clickTimerRef = useRef(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showSavImportModal, setShowSavImportModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [exportingSavPdf, setExportingSavPdf] = useState(false);
  const [showMobileSavRequest, setShowMobileSavRequest] = useState(false);
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
  const [allDepotZones, setAllDepotZones] = useState(null);
  const [locationStats, setLocationStats] = useState(null);
  const [filterZone, setFilterZone] = useState('');
  const [filterSerialized, setFilterSerialized] = useState(false);
  const [showDepotMap, setShowDepotMap] = useState(false);
  const [depotMapModalZone, setDepotMapModalZone] = useState(null); // { zoneId, equipmentName } or null

  // Trouver le bon dépôt pour la zone cliquée (dépôt 1 ou 2)
  const modalDepotData = useMemo(() => {
    const zoneId = depotMapModalZone?.zoneId;
    if (!zoneId) return null;
    // Chercher dans allDepotZones (contient tous les dépôts)
    if (allDepotZones?.depots) {
      for (const depot of allDepotZones.depots) {
        if (findZone(depot.zones, zoneId)) return depot;
      }
    }
    // Fallback: dépôt 1
    if (findZone(depotZones?.zones, zoneId)) return depotZones;
    // Dernier recours: retourner le premier dépôt disponible
    return depotZones || (allDepotZones?.depots?.[0]) || null;
  }, [depotMapModalZone, depotZones, allDepotZones]);

  const isAdmin = currentUser?.isAdmin === true;
  const canManageEquipmentMaintenance = isAdmin || currentUser?.permissions?.can_manage_equipment_maintenance === true;

  // ═══ CHARGEMENT ═══
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [eqData, catData, ticketData, persData, photosData, listsData, zonesData, locStatsData, allZonesData, brandsData] = await Promise.all([
        api.getEquipment(),
        api.getEquipmentCategories(),
        api.getSavTickets(),
        api.getPersons().catch(() => []),
        api.getEquipmentPhotos().catch(() => ({ photos: [], logos: [] })),
        api.getEquipmentLists().catch(() => []),
        api.getEquipmentDepotZones().catch(() => null),
        api.getEquipmentLocationStats().catch(() => null),
        api.getAllDepotZones().catch(() => null),
        api.getBrands().catch(() => []),
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
      setAllDepotZones(allZonesData);
      setBrandsList(brandsData || []);
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
      if (filterSerialized && !(eq.serialNumber || eq.serial_number)) return false;
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
  }, [equipment, filterStatus, filterSerialized, filterZone, parsedCatFilter, search, subfamilies, leafCategories, listFilter, favoriteIds, watchIds]);

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
      console.log('[EquipmentPanel] handleSaveEquipment — photo:', data.photo, '| editing:', !!editingEquipment);
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
      toast.success(`${result.message} — UID créés : ${result.created.map(c => c.uid).join(', ')}`);
      setSelectedEquipment(null);
      setDialogEquipment(null);
      // Mise à jour immédiate du tableau sans recharger toutes les données
      setEquipment(prev => [
        ...prev.filter(e => e.id !== eq.id),
        ...(result.items || [])
      ]);
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

  // Export PDF matériel en SAV
  const handleExportSavPdf = async () => {
    setExportingSavPdf(true);
    try {
      const blob = await api.exportSavActivePdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `materiel-en-sav-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur export PDF SAV:', err);
    } finally {
      setExportingSavPdf(false);
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
                isMobile={isMobile}
              />
              <label className="eq-filter-check" title="Afficher uniquement les matériels sérialisés">
                <input type="checkbox" checked={filterSerialized} onChange={(e) => setFilterSerialized(e.target.checked)} />
                <span>Sérialisés</span>
              </label>
              {depotZones && (
                <select className="eq-filter eq-zone-filter" value={filterZone} onChange={(e) => setFilterZone(e.target.value)} title="Filtrer par zone dépôt">
                  <option value="">Toutes zones</option>
                  <option value="_none">📍 Sans zone</option>
                  {allDepotZones?.depots ? allDepotZones.depots.map(d => (
                    <optgroup key={d.id} label={d.name || `Dépôt ${d.id}`}>
                      {d.zones.map(z => <option key={`${d.id}-${z.id}`} value={z.id}>📍 {z.label}</option>)}
                    </optgroup>
                  )) : depotZones.zones.map(z => <option key={z.id} value={z.id}>📍 {z.label}</option>)}
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
              {canManageEquipmentMaintenance && (
                <button className="eq-btn-secondary" onClick={() => setShowReportModal(true)} title="Rapport maintenance matériel">
                  <FileText size={14} /> Rapport
                </button>
              )}
              {canManageEquipmentMaintenance && (
                <button className="eq-btn-secondary" onClick={handleExportSavPdf} disabled={exportingSavPdf} title="Exporter PDF du matériel en SAV">
                  <Download size={14} /> {exportingSavPdf ? 'Export...' : 'PDF SAV'}
                </button>
              )}
              <select className="eq-filter" value={savFilterStatus} onChange={(e) => setSavFilterStatus(e.target.value)}>
                <option value="_active">En cours (actifs)</option>
                <option value="">Tous statuts</option>
                {Object.entries(SAV_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              {canManageEquipmentMaintenance && !isMobile && (
                <button className="eq-btn-add" onClick={() => { setSavTicketEquipment(null); setEditingSavTicket(null); setShowSavModal(true); }}>
                  <Plus size={14} /> Ticket SAV
                </button>
              )}
              {isMobile && (
                <button className="eq-btn-add eq-mobile-sav-request" onClick={() => setShowMobileSavRequest(true)}>
                  <Plus size={14} /> Demande SAV
                </button>
              )}
            </>
          )}
        </div>

        {/* Stats */}
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
                onZonesUpdated={loadData}
              />
            </div>
          )}
          <div className="eq-content">
          {subTab === 'inventory' && (
            <EquipmentGrid
              equipment={filteredEquipment}
              depotZones={depotZones}
              allDepotZones={allDepotZones}
              selectedId={selectedEquipment?.id}
              photosList={photosList}
              logosList={logosList}
              favoriteIds={favoriteIds}
              watchIds={watchIds}
              onToggleList={toggleList}
              categories={categories}
              onOpenDepotMap={(zoneId, eqName) => setDepotMapModalZone({ zoneId, equipmentName: eqName })}
              onSelect={(eq) => {
                clearTimeout(clickTimerRef.current);
                if (isMobile) {
                  // Mobile : ouvrir directement la fiche complète
                  setDialogEquipment(eq);
                  api.getEquipmentById(eq.id).then(detail => setDialogEquipment(detail)).catch(() => {});
                } else {
                  clickTimerRef.current = setTimeout(() => {
                    if (selectedEquipment?.id === eq.id) {
                      setSelectedEquipment(null);
                    } else {
                      setSelectedEquipment(eq);
                      api.getEquipmentById(eq.id).then(detail => setSelectedEquipment(detail)).catch(() => {});
                    }
                  }, 200);
                }
              }}
              onDoubleClick={(eq) => {
                clearTimeout(clickTimerRef.current);
                setSelectedEquipment(null);
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
              if (isMobile) {
                setDialogTicket(t);
              } else {
                ticketClickTimerRef.current = setTimeout(() => {
                  setSelectedTicket(selectedTicket?.id === t.id ? null : t);
                }, 200);
              }
            }}
            onDoubleClick={(t) => {
              clearTimeout(ticketClickTimerRef.current);
              setSelectedTicket(null);
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
        {subTab === 'inventory' && !dialogEquipment && (
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
            onPrintLabel={(eq) => setLabelPrintEquipment(eq)}
            onPrintSheet={(eq) => printEquipmentSheet(eq, photosList, logosList)}
            isAdmin={isAdmin}
            onOpenDepotMap={(zoneId, eqName) => setDepotMapModalZone({ zoneId, equipmentName: eqName })}
          />
        )}

        {/* Volet de détail rapide – SAV (clic simple) */}
        {subTab === 'sav' && !dialogTicket && !dialogEquipment && (
          <SavSlidePanel
            ticket={selectedTicket}
            equipment={equipment}
            persons={persons}
            onClose={() => setSelectedTicket(null)}
            onEdit={(t) => { setEditingSavTicket(t); setShowSavModal(true); }}
            onDelete={async (id) => {
              if (!confirm('Supprimer ce ticket ?')) return;
              await api.deleteSavTicket(id);
              setSelectedTicket(null);
              loadData();
            }}
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
        onCreateTicket={(eq) => { setSavTicketEquipment(eq); setEditingSavTicket(null); setShowSavModal(true); }}
        onRefresh={loadData}
        onOpenTicketDialog={(t) => { setDialogEquipment(null); setDialogTicket(t); }}
        onPrintLabel={isMobile ? undefined : (eq) => setLabelPrintEquipment(eq)}
        onPrintSheet={isMobile ? undefined : (eq) => printEquipmentSheet(eq, photosList, logosList)}
        onSerialize={handleSerializeEquipment}
        onOpenDepotMap={(zoneId, eqName) => setDepotMapModalZone({ zoneId, equipmentName: eqName })}
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
          brandsList={brandsList}
          depotZones={depotZones}
          allDepotZones={allDepotZones}
          photosList={photosList}
          onSave={handleSaveEquipment}
          onClose={() => { setShowEquipmentModal(false); setEditingEquipment(null); }}
        />
      )}

      {showSavModal && (
        <SavTicketFormModal
          ticket={editingSavTicket}
          equipment={equipment}
          persons={persons}
          preselectedEquipment={savTicketEquipment || selectedEquipment}
          onSave={handleSaveSavTicket}
          onClose={() => { setShowSavModal(false); setEditingSavTicket(null); setSavTicketEquipment(null); }}
        />
      )}

      {showMobileSavRequest && (
        <MobileSavRequestForm
          equipment={equipment}
          onSubmit={async (data) => {
            await api.createSavRequest(data);
            setShowMobileSavRequest(false);
            loadData();
          }}
          onClose={() => setShowMobileSavRequest(false)}
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
        <div className="eq-management-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCloseManagement()}>
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
                <EquipmentMediaManager
                  photosList={photosList}
                  logosList={logosList}
                  equipment={equipment}
                  onRefresh={loadData}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Plan dépôt (ouvert depuis un clic sur une zone) */}
      {depotMapModalZone && modalDepotData && (
        <div className="eq-depot-map-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setDepotMapModalZone(null)}>
          <div className="eq-depot-map-modal" onClick={(e) => e.stopPropagation()}>
            <div className="eq-depot-map-modal-header">
              <h3><MapPin size={18} /> Plan {modalDepotData.name || 'du dépôt'} — Zone {depotMapModalZone.zoneId}{depotMapModalZone.equipmentName ? ` · ${depotMapModalZone.equipmentName}` : ''}</h3>
              <button className="eq-dialog-close" onClick={() => setDepotMapModalZone(null)} title="Fermer"><X size={20} /></button>
            </div>
            <div className="eq-depot-map-modal-body">
              <DepotMap
                zones={modalDepotData}
                stats={locationStats}
                selectedZone={depotMapModalZone.zoneId}
                focusZoneId={depotMapModalZone.zoneId}
                focusEquipmentName={depotMapModalZone.equipmentName}
                onZoneSelect={(zoneId) => {}}
                onZoneFilter={() => {}}
                compact={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══ GESTIONNAIRE DE MÉDIAS ÉQUIPEMENT ═══
const EquipmentMediaManager = ({ photosList, logosList, equipment, onRefresh }) => {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [mediaSearch, setMediaSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [renamingPhoto, setRenamingPhoto] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [linkingPhoto, setLinkingPhoto] = useState(null);
  const [linkSearch, setLinkSearch] = useState('');

  // Filtrer les photos par recherche
  const filteredPhotos = useMemo(() => {
    if (!mediaSearch.trim()) return photosList;
    const q = mediaSearch.toLowerCase();
    return photosList.filter(p => p.toLowerCase().includes(q));
  }, [photosList, mediaSearch]);

  // Associer chaque photo à l'équipement correspondant
  const photoEquipmentMap = useMemo(() => {
    const map = {};
    for (const photo of photosList) {
      const match = equipment.find(eq => matchPhotoToEquipment([photo], eq));
      if (match) map[photo] = match;
    }
    return map;
  }, [photosList, equipment]);

  // Upload handler
  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const result = await api.uploadEquipmentPhotos(Array.from(files));
      toast.success(`${result.count} photo(s) uploadée(s)`);
      // Recharger les données pour avoir la liste à jour
      onRefresh();
    } catch (err) {
      toast.error('Erreur upload : ' + (err.message || 'inconnu'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete handler
  const handleDelete = async (filename) => {
    if (!confirm(`Supprimer la photo "${filename}" ?\nCette action est irréversible.`)) return;
    try {
      await api.deleteEquipmentPhoto(filename);
      toast.success(`Photo "${filename}" supprimée`);
      onRefresh();
    } catch (err) {
      toast.error('Erreur suppression : ' + (err.message || 'inconnu'));
    }
  };

  // Rename handler
  const handleRename = async () => {
    if (!renamingPhoto || !renameValue.trim()) return;
    const ext = renamingPhoto.split('.').pop();
    const newName = renameValue.trim().endsWith(`.${ext}`) ? renameValue.trim() : `${renameValue.trim()}.${ext}`;
    if (newName === renamingPhoto) { setRenamingPhoto(null); return; }
    try {
      await api.renameEquipmentPhoto(renamingPhoto, newName);
      toast.success(`Renommé : ${newName}`);
      setRenamingPhoto(null);
      setRenameValue('');
      onRefresh();
    } catch (err) {
      toast.error('Erreur renommage : ' + (err.message || 'inconnu'));
    }
  };

  // Manual link handler — associate a photo to an equipment by updating its `photo` field
  const handleManualLink = async (photoFilename, eq) => {
    try {
      await api.linkEquipmentPhoto(eq.id, photoFilename);
      toast.success(`Photo associée à ${cleanName(eq.name)}`);
      setLinkingPhoto(null);
      setLinkSearch('');
      onRefresh();
    } catch (err) {
      toast.error('Erreur association : ' + (err.message || 'inconnu'));
    }
  };

  // Filtered equipment for manual link
  const linkFilteredEquipment = useMemo(() => {
    if (!linkSearch.trim()) return equipment.slice(0, 20);
    const q = linkSearch.toLowerCase();
    return equipment.filter(eq =>
      (eq.name || '').toLowerCase().includes(q) ||
      (eq.reference || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [equipment, linkSearch]);

  // Drag & Drop
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files?.length) handleUpload(files);
  };

  return (
    <div className="eq-management-section eq-media-manager">
      <div className="eq-media-header">
        <h3><ImageIcon size={18} /> Gestion des Médias</h3>
        <div className="eq-media-counts">
          <span className="eq-media-count-badge">📸 {photosList.length} photos</span>
          <span className="eq-media-count-badge">🏷️ {logosList.length} logos</span>
        </div>
      </div>

      {/* Barre d'actions */}
      <div className="eq-media-toolbar">
        <div className="eq-media-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Rechercher une photo..."
            value={mediaSearch}
            onChange={(e) => setMediaSearch(e.target.value)}
          />
          {mediaSearch && <button className="eq-media-search-clear" onClick={() => setMediaSearch('')}><X size={12} /></button>}
        </div>
        <button className="eq-btn-save" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload size={16} /> {uploading ? 'Upload...' : 'Ajouter des photos'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Zone de drop */}
      <div
        className={`eq-media-dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={24} />
        <span>Glissez-déposez des images ici ou cliquez pour sélectionner</span>
        <small>JPG, PNG, WebP, AVIF, SVG — Max 20 MB par fichier</small>
      </div>

      {/* Grille des photos */}
      <div className="eq-media-section">
        <h4>📸 Photos matériel ({filteredPhotos.length}{mediaSearch ? ` / ${photosList.length}` : ''})</h4>
        {filteredPhotos.length === 0 ? (
          <p className="eq-detail-empty">{mediaSearch ? 'Aucune photo correspondante' : 'Aucune photo dans Photos/Matériel/'}</p>
        ) : (
          <div className="eq-media-photo-grid">
            {filteredPhotos.map(p => {
              const linkedEq = photoEquipmentMap[p];
              return (
                <div key={p} className={`eq-media-card ${linkedEq ? 'linked' : ''}`}>
                  <div className="eq-media-card-img" onClick={() => setPreviewPhoto(p)}>
                    <img src={`/Photos/Matériel/${p}`} alt={p} loading="lazy" />
                    <div className="eq-media-card-zoom"><ZoomIn size={16} /></div>
                  </div>
                  <div className="eq-media-card-info">
                    {renamingPhoto === p ? (
                      <div style={{ display: 'flex', gap: 3, width: '100%' }}>
                        <input
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenamingPhoto(null); }}
                          style={{ flex: 1, fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--theme-border-medium)', minWidth: 0 }}
                          autoFocus
                        />
                        <button onClick={handleRename} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--theme-primary)', color: 'var(--theme-text-inverse)', border: 'none', cursor: 'pointer' }}>OK</button>
                      </div>
                    ) : (
                      <span className="eq-media-card-name" title={p}>{p.length > 20 ? p.slice(0, 17) + '...' : p}</span>
                    )}
                    {linkedEq ? (
                      <span className="eq-media-card-link" title={`Associé à : ${cleanName(linkedEq.name)}`}>
                        <Link2 size={10} /> {cleanName(linkedEq.name).slice(0, 18)}
                      </span>
                    ) : linkingPhoto === p ? (
                      <div className="eq-media-link-picker" style={{ width: '100%' }}>
                        <input
                          type="text"
                          placeholder="Rechercher équipement..."
                          value={linkSearch}
                          onChange={e => setLinkSearch(e.target.value)}
                          style={{ width: '100%', fontSize: 10, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--theme-border-medium)', marginBottom: 3 }}
                          autoFocus
                        />
                        <div style={{ maxHeight: 100, overflowY: 'auto', fontSize: 10 }}>
                          {linkFilteredEquipment.map(eq => (
                            <div
                              key={eq.id}
                              onClick={() => handleManualLink(p, eq)}
                              style={{ padding: '3px 4px', cursor: 'pointer', borderRadius: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              onMouseEnter={e => e.target.style.background = 'var(--theme-bg-tertiary)'}
                              onMouseLeave={e => e.target.style.background = 'transparent'}
                            >
                              {eq.reference ? `${eq.reference} — ` : ''}{cleanName(eq.name)}
                            </div>
                          ))}
                          {linkFilteredEquipment.length === 0 && <div style={{ padding: 4, opacity: 0.5 }}>Aucun résultat</div>}
                        </div>
                        <button onClick={() => { setLinkingPhoto(null); setLinkSearch(''); }} style={{ fontSize: 9, padding: '1px 6px', marginTop: 2, borderRadius: 3, background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border-medium)', cursor: 'pointer' }}>Annuler</button>
                      </div>
                    ) : (
                      <span className="eq-media-card-nolink" onClick={() => setLinkingPhoto(p)} style={{ cursor: 'pointer' }} title="Cliquer pour associer manuellement">
                        Non associé
                      </span>
                    )}
                  </div>
                  <div className="eq-media-card-actions" style={{ display: 'flex', gap: 2 }}>
                    <button className="eq-media-card-action-btn" onClick={() => { setRenamingPhoto(p); setRenameValue(p.replace(/\.[^.]+$/, '')); }} title="Renommer">
                      <Edit2 size={12} />
                    </button>
                    <button className="eq-media-card-action-btn" onClick={() => setLinkingPhoto(linkingPhoto === p ? null : p)} title="Associer manuellement">
                      <Link2 size={12} />
                    </button>
                    <button className="eq-media-card-delete" onClick={() => handleDelete(p)} title="Supprimer cette photo">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section Logos (lecture seule) */}
      <div className="eq-media-section">
        <h4>🏷️ Logos marques ({logosList.length})</h4>
        {logosList.length === 0 ? (
          <p className="eq-detail-empty">Aucun logo dans Logos/</p>
        ) : (
          <div className="eq-media-photo-grid">
            {logosList.map(l => (
              <div key={l} className="eq-media-card logo-card">
                <div className="eq-media-card-img" onClick={() => setPreviewPhoto({ src: `/Logos/${l}`, name: l })}>
                  <img src={`/Logos/${l}`} alt={l} loading="lazy" />
                  <div className="eq-media-card-zoom"><ZoomIn size={16} /></div>
                </div>
                <div className="eq-media-card-info">
                  <span className="eq-media-card-name" title={l}>{l.length > 20 ? l.slice(0, 17) + '...' : l}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Code section */}
      <div className="eq-mgmt-media-legend">
        <h4><QrCode size={16} /> UID & QR Codes</h4>
        <p>Chaque équipement possède un UID unique (EMAG-XXXXX) et un QR Code qui renvoie vers l'interface mobile.</p>
        <div className="eq-mgmt-uid-example">
          <QRCodeSVG value={`${APP_BASE_URL}/#/mobile/equipment/EMAG-00001`} size={80} level="M" includeMargin />
          <div>
            <code>EMAG-00001</code>
            <span>→ Menu mobile : Fiche, Défaut, SAV, Intervention</span>
          </div>
        </div>
      </div>

      {/* Modal de prévisualisation plein écran */}
      {previewPhoto && (
        <div className="eq-media-preview-overlay" onMouseDown={(e) => e.target === e.currentTarget && setPreviewPhoto(null)}>
          <div className="eq-media-preview-content" onClick={(e) => e.stopPropagation()}>
            <button className="eq-media-preview-close" onClick={() => setPreviewPhoto(null)}><X size={22} /></button>
            <img
              src={typeof previewPhoto === 'string' ? `/Photos/Matériel/${previewPhoto}` : previewPhoto.src}
              alt={typeof previewPhoto === 'string' ? previewPhoto : previewPhoto.name}
            />
            <span className="eq-media-preview-name">{typeof previewPhoto === 'string' ? previewPhoto : previewPhoto.name}</span>
          </div>
        </div>
      )}

    </div>
  );
};

// ═══ LISTE D'ÉQUIPEMENTS (tableau) ═══
const EquipmentGrid = ({ equipment, depotZones, allDepotZones, selectedId, photosList, logosList, favoriteIds, watchIds, onToggleList, onSelect, onDoubleClick, onOpenDepotMap, categories }) => {
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
          </tr>
        </thead>
        <tbody>
          {equipment.map(eq => {
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
                  {(photo || genericImg) ? (
                    <img src={photo || genericImg} alt="" className={`eq-table-photo${!photo && genericImg ? ' eq-generic' : ''}`} />
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
                <td>{eq.brand_canonical || eq.brand || '—'}</td>
                <td className="eq-table-serial">{eq.serialNumber || '—'}</td>
                <td className="eq-table-qty">{eq.stockQuantity || 1}</td>
                <td>{(() => {
                  const zoneId = eq.location_zone || eq.locationZone;
                  if (zoneId) {
                    // Chercher la zone dans tous les dépôts (avec matching flexible)
                    let z = null;
                    if (depotZones?.zones) z = findZone(depotZones.zones, zoneId);
                    if (!z && allDepotZones?.depots) {
                      for (const depot of allDepotZones.depots) {
                        z = findZone(depot.zones, zoneId);
                        if (z) break;
                      }
                    }
                    if (z) return (
                      <span className="eq-zone-badge eq-zone-clickable" style={{ background: z.color, color: z.textColor || '#fff' }} onClick={(e) => { e.stopPropagation(); onOpenDepotMap && onOpenDepotMap(zoneId, eq.name); }} title="Voir sur le plan">
                        <MapPin size={11} />
                        {z.label}
                        {(eq.location_code || eq.locationCode) && <span className="eq-zone-code">{eq.location_code || eq.locationCode}</span>}
                      </span>
                    );
                    // Zone non trouvée dans les JSON mais présente en base → quand même cliquable
                    return (
                      <span className="eq-zone-badge eq-zone-clickable" style={{ background: 'var(--theme-text-secondary)', color: 'var(--theme-text-inverse)' }} onClick={(e) => { e.stopPropagation(); onOpenDepotMap && onOpenDepotMap(zoneId, eq.name); }} title="Voir sur le plan">
                        <MapPin size={11} />
                        {zoneId}
                      </span>
                    );
                  }
                  return eq.location || '—';
                })()}</td>
                <td>
                  <span className="eq-table-status" style={{ color: st.color }}>
                    {st.icon} {st.label}
                  </span>
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
const EquipmentDetailContent = ({ eq, isAdmin, compact = false, onEdit, onCreateTicket, onDelete, onSerialize, onPrintLabel, onPrintSheet, photosList, logosList, favoriteIds, watchIds, onToggleList, onOpenTicketDialog, onOpenDepotMap, categories: catList }) => {
  const st = EQUIPMENT_STATUS[eq.status] || EQUIPMENT_STATUS.available;
  const [showQR, setShowQR] = useState(false);
  const photo = matchPhotoToEquipment(photosList || [], eq);
  const logo = matchLogoToBrand(logosList || [], eq.brand_canonical || eq.brand);
  const qrUrl = eq.uid ? `${APP_BASE_URL}/#/mobile/equipment/${eq.uid}` : null;
  const isFav = favoriteIds?.has(eq.id);
  const isWatch = watchIds?.has(eq.id);
  const hierarchy = getCategoryHierarchy(eq, catList || []);
  const genericImg = !photo ? resolveGenericImage(eq, hierarchy) : null;

  return (
    <div className="eq-detail-body">
      {/* ── Hero: Photo + Identité ── */}
      <div className="eq-detail-hero">
        {(photo || genericImg) && (
          <div className={`eq-detail-photo${!photo && genericImg ? ' eq-generic' : ''}`}>
            <img src={photo || genericImg} alt={cleanName(eq.name)} />
          </div>
        )}
        <div className="eq-detail-identity">
          <h2 className="eq-detail-name">{eq.categoryIcon || eq.category_icon || '📦'} {cleanName(eq.name)}</h2>
          <div className="eq-detail-meta-row">
            <span className="eq-detail-status" style={{ background: st.color }}>{st.icon} {st.label}</span>
            {logo && <img className="eq-detail-brand-img" src={logo} alt={eq.brand_canonical || eq.brand} title={eq.brand_canonical || eq.brand} />}
          </div>
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

      {/* ── Hiérarchie catégorie ── */}
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

      {/* ── Informations (fusionné dans la fiche) ── */}
      <div className="eq-detail-grid eq-detail-info-grid">
          {eq.reference && (
            <div className="eq-detail-field">
              <span className="eq-field-label"><Tag size={14} /> Référence</span>
              <span className="eq-field-value">{eq.reference}</span>
            </div>
          )}
          {(eq.serialNumber || eq.serial_number) && (
            <div className="eq-detail-field">
              <span className="eq-field-label"><Clipboard size={14} /> N° série</span>
              <span className="eq-field-value">{eq.serialNumber || eq.serial_number}</span>
            </div>
          )}
          {eq.brand && (
            <div className="eq-detail-field">
              <span className="eq-field-label">🏭 Marque</span>
              <span className="eq-field-value">{eq.brand_canonical || eq.brand}</span>
            </div>
          )}
          {(eq.stockQuantity || eq.stock_quantity) > 1 && (
            <div className="eq-detail-field">
              <span className="eq-field-label"><Package size={14} /> Quantité</span>
              <span className="eq-field-value">{eq.stockQuantity || eq.stock_quantity}</span>
            </div>
          )}
          {(eq.location_zone || eq.locationZone || eq.location) && (
            <div className="eq-detail-field eq-field-wide">
              <span className="eq-field-label"><MapPin size={14} /> Zone dépôt</span>
              <span className="eq-field-value">
                {(eq.location_zone || eq.locationZone) ? `${(eq.location_depot || eq.locationDepot) ? `D${eq.location_depot || eq.locationDepot} — ` : ''}${eq.location_zone || eq.locationZone}${(eq.location_code || eq.locationCode) ? ` — ${eq.location_code || eq.locationCode}` : ''}${(eq.location_floor || eq.locationFloor) ? ` (${eq.location_floor || eq.locationFloor})` : ''}` : eq.location}
                {(eq.location_zone || eq.locationZone) && onOpenDepotMap && (
                  <button className="eq-zone-map-btn" onClick={(e) => { e.stopPropagation(); onOpenDepotMap(eq.location_zone || eq.locationZone, eq.name); }} title="Voir sur le plan">
                    <Map size={13} /> Plan
                  </button>
                )}
              </span>
            </div>
          )}
          {(eq.purchaseDate || eq.purchase_date) && (
            <div className="eq-detail-field">
              <span className="eq-field-label"><Calendar size={14} /> Achat</span>
              <span className="eq-field-value">{safeDate(eq.purchaseDate || eq.purchase_date)}</span>
            </div>
          )}
          {(eq.purchasePrice || eq.purchase_price) && (
            <div className="eq-detail-field">
              <span className="eq-field-label"><DollarSign size={14} /> Prix</span>
              <span className="eq-field-value">{parseFloat(eq.purchasePrice || eq.purchase_price).toFixed(2)} €</span>
            </div>
          )}
          {(eq.warrantyEnd || eq.warranty_end) && (
            <div className="eq-detail-field">
              <span className="eq-field-label"><CheckCircle size={14} /> Garantie</span>
              <span className="eq-field-value">jusqu'au {safeDate(eq.warrantyEnd || eq.warranty_end)}</span>
            </div>
          )}
      </div>

      {/* ── Notes ── */}
      {eq.notes && (
        <div className="eq-detail-notes">
          <h4>📝 Notes</h4>
          <p>{eq.notes}</p>
        </div>
      )}

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
const EquipmentSlidePanel = ({ equipment: eq, categories, persons, photosList, logosList, favoriteIds, watchIds, onToggleList, onClose, onOpenDialog, onEdit, onPrintLabel, onPrintSheet, isAdmin, onOpenDepotMap }) => {
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
        <EquipmentDetailContent eq={currentEq} isAdmin={isAdmin} compact={true} photosList={photosList} logosList={logosList} favoriteIds={favoriteIds} watchIds={watchIds} onToggleList={onToggleList} onOpenDepotMap={onOpenDepotMap} categories={categories} />
      </div>
      <div className="eq-slide-footer">
        {onPrintLabel && (
          <button className="eq-btn-secondary eq-footer-icon-btn" onClick={() => onPrintLabel(currentEq)} title="Imprimer étiquette">
            <Printer size={14} />
          </button>
        )}
        {onPrintSheet && (
          <button className="eq-btn-secondary eq-footer-icon-btn" onClick={() => onPrintSheet(currentEq)} title="Imprimer la fiche">
            <FileText size={14} />
          </button>
        )}
        <button className="eq-slide-open-btn" onClick={() => { if (onOpenDialog) onOpenDialog(currentEq); }}>
          <ExternalLink size={14} /> Ouvrir la fiche complète
        </button>
      </div>
    </div>
  );
};

// ═══ MODAL DÉTAIL COMPLET (double-clic) ═══
const EquipmentDetailDialog = ({ equipment: eq, categories, persons, isAdmin, photosList, logosList, favoriteIds, watchIds, onToggleList, onClose, onEdit, onDelete, onCreateTicket, onRefresh, onOpenTicketDialog, onPrintLabel, onPrintSheet, onSerialize, onOpenDepotMap }) => {
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
    <div className={`eq-dialog-overlay${isClosing ? ' closing' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="eq-dialog">
        <div className="eq-dialog-header" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="eq-dialog-title-row" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <span className="eq-dialog-cat" style={{ background: (eq.categoryColor || eq.category_color || '#6366f1') }}>
              {eq.categoryIcon || eq.category_icon || '📦'} {eq.categoryName || eq.category_name || ''}
            </span>
            <span className="eq-dialog-name">{cleanName(eq.name)}</span>
          </div>
          <button className="eq-dialog-close" onClick={handleClose} title="Fermer" style={{ flexShrink: 0, marginLeft: '12px' }}>
            <X size={20} />
          </button>
        </div>
        <div className="eq-dialog-body">
          <EquipmentDetailContent
            eq={eq}
            isAdmin={isAdmin}
            compact={false}
            photosList={photosList}
            logosList={logosList}
            favoriteIds={favoriteIds}
            watchIds={watchIds}
            onToggleList={onToggleList}
            onOpenTicketDialog={onOpenTicketDialog}
            onOpenDepotMap={onOpenDepotMap}
            categories={categories}
          />
        </div>
        <div className="eq-dialog-footer">
          <div className="eq-dialog-actions">
            <div className="eq-actions-group">
              <button className="eq-btn-primary" onClick={() => onEdit(eq)}><Edit2 size={14} /> Modifier</button>
            </div>
            <div className="eq-actions-group">
              {onCreateTicket && (
                <button className="eq-btn-secondary" onClick={() => onCreateTicket(eq)}>
                  <Wrench size={14} /> Ticket SAV
                </button>
              )}
              {onOpenDepotMap && (
                <button className="eq-btn-secondary" onClick={() => onOpenDepotMap(eq.location_zone || eq.locationZone || '', eq.name)}>
                  <MapPin size={14} /> Localisation
                </button>
              )}
              {onPrintLabel && (
                <button className="eq-btn-secondary" onClick={() => onPrintLabel(eq)}>
                  <Printer size={14} /> Étiquette
                </button>
              )}
              {onPrintSheet && (
                <button className="eq-btn-secondary" onClick={() => onPrintSheet(eq)}>
                  <FileText size={14} /> Fiche
                </button>
              )}
              {isAdmin && onSerialize && (eq.stockQuantity || eq.stock_quantity || 1) > 1 && (
                <button className="eq-btn-secondary" onClick={() => onSerialize(eq)} title={`Scinder en ${eq.stockQuantity || eq.stock_quantity} entités individuelles avec UID`}>
                  <Package size={14} /> Sérialiser ({eq.stockQuantity || eq.stock_quantity})
                </button>
              )}
            </div>
            {isAdmin && onDelete && (
              <button className="eq-btn-danger" onClick={() => onDelete(eq.id)}><Trash2 size={14} /> Supprimer</button>
            )}
          </div>
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
                  <span className="eq-ticket-eq">{t.categoryIcon} {t.equipmentName || <em style={{ color: 'var(--theme-text-muted)' }}>Non lié</em>}</span>
                </td>
                <td>{SAV_TYPES[t.type] || t.type}</td>
                <td><span className="eq-status-badge" style={{ background: tst.color }}>{tst.label}</span></td>
                <td>{safeDate(t.createdAt)}</td>
                <td>{safeDate(t.resolvedAt)}</td>
                <td>{t.cost != null ? `${parseFloat(t.cost).toFixed(2)} €` : '—'}</td>
                <td>
                  <div className="eq-table-actions">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(t); }} title="Modifier"><Edit2 size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(t.id); }} title="Supprimer" className="eq-btn-danger-sm"><Trash2 size={14} /></button>
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
const EquipmentFormModal = ({ equipment: eq, categories, brandsList = [], depotZones, allDepotZones, photosList = [], onSave, onClose }) => {
  const [showMap, setShowMap] = useState(false);
  const [mapSelection, setMapSelection] = useState('');
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [photoSearch, setPhotoSearch] = useState('');
  const [pickerTab, setPickerTab] = useState('photos'); // 'photos' | 'generic'
  const [mapDepotIdx, setMapDepotIdx] = useState(0); // index du dépôt affiché sur le plan
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
    const catParent = cat.parentId || cat.parent_id;
    if (cat.level === 'subfamily') return { familyId: String(catParent || ''), subfamilyId: String(cat.id), categoryId: '' };
    // level === 'category'
    const sf = categories.find(c => c.id === catParent);
    const sfParent = sf?.parentId || sf?.parent_id;
    return { familyId: String(sfParent || ''), subfamilyId: String(catParent || ''), categoryId: String(cat.id) };
  }, [categories]);

  const parents = findParents(eq?.categoryId || eq?.category_id);
  
  const [form, setForm] = useState({
    name: eq?.name || '',
    reference: eq?.reference || '',
    serial_number: eq?.serialNumber || eq?.serial_number || '',
    family_id: parents.familyId,
    subfamily_id: parents.subfamilyId,
    category_id: parents.categoryId || (eq?.categoryId || eq?.category_id ? String(eq.categoryId || eq.category_id) : ''),
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
  });

  const currentSubfamilies = useMemo(() => {
    if (!form.family_id) return [];
    const fid = parseInt(form.family_id);
    return subfamilies.filter(sf => (sf.parentId || sf.parent_id) === fid);
  }, [form.family_id, subfamilies]);

  const currentLeafCategories = useMemo(() => {
    if (!form.subfamily_id) return [];
    const sid = parseInt(form.subfamily_id);
    return leafCategories.filter(c => (c.parentId || c.parent_id) === sid);
  }, [form.subfamily_id, leafCategories]);

  // La category_id finale à envoyer au serveur
  const resolvedCategoryId = form.category_id || form.subfamily_id || form.family_id || '';

  // Photo : manuelle (DB) ou auto-matchée
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

  // Catégorie résolue pour l'icône par défaut
  const resolvedCat = useMemo(() => {
    const cid = parseInt(resolvedCategoryId);
    return cid ? categories.find(c => c.id === cid) : null;
  }, [resolvedCategoryId, categories]);
  const defaultIcon = resolvedCat?.icon || '📦';

  // Photos filtrées pour le picker
  const filteredPickerPhotos = useMemo(() => {
    if (!photoSearch.trim()) return photosList;
    const q = photoSearch.toLowerCase();
    return photosList.filter(p => p.toLowerCase().includes(q));
  }, [photosList, photoSearch]);

  // Images génériques
  const allGenerics = useMemo(() => getAllGenericImages(), []);
  const filteredGenerics = useMemo(() => {
    if (!photoSearch.trim()) return allGenerics;
    const q = photoSearch.toLowerCase();
    return allGenerics.filter(g => g.label.toLowerCase().includes(q) || g.group.toLowerCase().includes(q));
  }, [allGenerics, photoSearch]);

  // Image générique auto-résolue (pour preview quand pas de photo)
  const genericImageUrl = useMemo(() => {
    if (currentPhotoUrl) return null;
    const fakeEq = { name: form.name, reference: form.reference };
    const hierarchy = getCategoryHierarchy({ categoryId: parseInt(resolvedCategoryId) || 0 }, categories);
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
    console.log('[EquipmentForm] Submit — photo:', data.photo, '| form.photo:', form.photo);
    onSave(data);
  };

  return (
    <div className="eq-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
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

            {/* Photo picker */}
            <div className="eq-form-field eq-form-full">
              <label>Photo</label>
              <div className="eq-photo-picker">
                <div className="eq-photo-picker-preview" onClick={() => setShowPhotoPicker(!showPhotoPicker)}>
                  {currentPhotoUrl ? (
                    <img src={currentPhotoUrl} alt="" />
                  ) : genericImageUrl ? (
                    <img src={genericImageUrl} alt="" className="eq-generic-preview" />
                  ) : (
                    <span className="eq-photo-picker-icon">{defaultIcon}</span>
                  )}
                  <span className="eq-photo-picker-label">
                    {form.photo ? form.photo : (autoMatchedPhoto ? '(auto)' : genericImageUrl ? '(générique auto)' : 'Choisir une photo')}
                  </span>
                  <Camera size={16} />
                </div>
                {form.photo && (
                  <button type="button" className="eq-photo-picker-clear" onClick={() => setForm(f => ({ ...f, photo: '' }))} title="Retirer la photo">
                    <X size={14} />
                  </button>
                )}
              </div>
              {showPhotoPicker && (
                <div className="eq-photo-picker-dropdown">
                  <div className="eq-photo-picker-search">
                    <Search size={14} />
                    <input type="text" value={photoSearch} onChange={(e) => setPhotoSearch(e.target.value)} placeholder="Rechercher..." autoFocus />
                  </div>
                  <div className="eq-photo-picker-tabs">
                    <button type="button" className={`eq-picker-tab${pickerTab === 'photos' ? ' active' : ''}`} onClick={() => setPickerTab('photos')}>📸 Photos ({photosList.length})</button>
                    <button type="button" className={`eq-picker-tab${pickerTab === 'generic' ? ' active' : ''}`} onClick={() => setPickerTab('generic')}>🖼️ Génériques ({allGenerics.length})</button>
                  </div>
                  <div className="eq-photo-picker-grid">
                    {/* Option icône par défaut (pas de photo) */}
                    <div
                      className={`eq-photo-picker-item${!form.photo ? ' selected' : ''}`}
                      onClick={() => { setForm(f => ({ ...f, photo: '' })); setShowPhotoPicker(false); setPhotoSearch(''); }}
                    >
                      <span className="eq-photo-picker-item-icon">{defaultIcon}</span>
                      <span className="eq-photo-picker-item-label">Aucune photo</span>
                    </div>
                    {pickerTab === 'photos' && filteredPickerPhotos.map(p => (
                      <div
                        key={p}
                        className={`eq-photo-picker-item${form.photo === p ? ' selected' : ''}`}
                        onClick={() => { setForm(f => ({ ...f, photo: p })); setShowPhotoPicker(false); setPhotoSearch(''); }}
                        title={p}
                      >
                        <img src={`/Photos/Matériel/${p}`} alt={p} />
                        <span className="eq-photo-picker-item-label">{p.replace(/\.[^.]+$/, '')}</span>
                      </div>
                    ))}
                    {pickerTab === 'generic' && (() => {
                      let lastGroup = '';
                      return filteredGenerics.map(g => {
                        const showHeader = g.group !== lastGroup;
                        lastGroup = g.group;
                        return (
                          <React.Fragment key={g.key}>
                            {showHeader && <div className="eq-photo-picker-group-header">{g.group}</div>}
                            <div
                              className="eq-photo-picker-item eq-generic-item"
                              onClick={() => { setForm(f => ({ ...f, photo: `generic:${g.groupKey}/${g.key}` })); setShowPhotoPicker(false); setPhotoSearch(''); }}
                              title={g.label}
                            >
                              <img src={g.path} alt={g.label} />
                              <span className="eq-photo-picker-item-label">{g.label}</span>
                            </div>
                          </React.Fragment>
                        );
                      });
                    })()}
                    {pickerTab === 'photos' && filteredPickerPhotos.length === 0 && <div className="eq-photo-picker-empty">Aucune photo trouvée</div>}
                    {pickerTab === 'generic' && filteredGenerics.length === 0 && <div className="eq-photo-picker-empty">Aucune image générique trouvée</div>}
                  </div>
                </div>
              )}
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
              <input type="text" list="eq-brands-list" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Ex: L-Acoustics" />
              <datalist id="eq-brands-list">
                {brandsList.map(b => <option key={b.id} value={b.name} />)}
              </datalist>
            </div>
            <div className="eq-form-field">
              <label>Quantité / Stock</label>
              <input type="number" min="1" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
            </div>
            <div className="eq-form-field eq-form-full">
              <label>Catégorie</label>
              <CategoryCascadePicker
                families={families}
                subfamilies={subfamilies}
                leafCategories={leafCategories}
                value={{ family_id: form.family_id, subfamily_id: form.subfamily_id, category_id: form.category_id }}
                onChange={({ family_id, subfamily_id, category_id }) => setForm(f => ({ ...f, family_id, subfamily_id, category_id }))}
              />
            </div>
            <div className="eq-form-field">
              <label>Statut</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(EQUIPMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
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
                  onChange={(loc) => setForm(f => ({
                    ...f,
                    location_depot: loc.location_depot || '',
                    location_zone: loc.location_zone || '',
                    location_code: loc.location_code || '',
                    location_floor: loc.location_floor || '',
                  }))}
                />
                <button type="button" className="eq-form-map-toggle" onClick={() => setShowMap(true)}>
                  <Map size={14} /> Choisir sur le plan
                </button>
                {showMap && (() => {
                  const depotsList = allDepotZones?.depots || (depotZones ? [depotZones] : []);
                  const currentDepotData = depotsList[mapDepotIdx] || depotsList[0];
                  if (!currentDepotData) return null;
                  return (
                    <div className="eq-depot-map-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowMap(false)}>
                      <div className="eq-depot-map-modal" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="eq-depot-map-modal-header">
                          <h3><MapPin size={18} /> Choisir la localisation sur le plan</h3>
                          {depotsList.length > 1 && (
                            <div className="eq-form-map-tabs" style={{ position: 'static', margin: '0 auto 0 16px' }}>
                              {depotsList.map((d, i) => (
                                <button key={d.id || i} type="button" className={`eq-form-map-tab${i === mapDepotIdx ? ' active' : ''}`} onClick={() => setMapDepotIdx(i)}>
                                  {d.name || `Dépôt ${d.id || i + 1}`}
                                </button>
                              ))}
                            </div>
                          )}
                          <button className="eq-dialog-close" onClick={() => setShowMap(false)} title="Fermer"><X size={20} /></button>
                        </div>
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
                        <div className="eq-depot-map-modal-footer">
                          {mapSelection && (() => {
                            const z = currentDepotData.zones?.find(z => z.id === mapSelection);
                            return <span className="eq-depot-map-modal-zone-label" style={{ borderLeftColor: z?.color || 'var(--theme-primary)' }}>{z?.label || mapSelection}</span>;
                          })()}
                          <div style={{ flex: 1 }} />
                          <button type="button" className="eq-btn-cancel" onClick={() => { setMapSelection(''); setShowMap(false); }}>Annuler</button>
                          <button type="button" className="eq-btn-save" disabled={!mapSelection} onClick={() => {
                            const zoneObj = currentDepotData.zones?.find(z => z.id === mapSelection);
                            setForm(f => ({
                              ...f,
                              location_depot: currentDepotData.id || currentDepotData.depotId || '',
                              location_zone: mapSelection,
                              location_code: '',
                              location_floor: zoneObj?.floor || '',
                            }));
                            setMapSelection('');
                            setShowMap(false);
                          }}>✓ Valider</button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            {!depotZones && !allDepotZones && (
              <div className="eq-form-field">
                <label>Localisation / Zone</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ex: Dépôt A, Étagère 3" />
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
    <div className="eq-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="eq-modal">
        <div className="eq-modal-header">
          <h3>{ticket ? '✏️ Modifier le ticket' : '🔧 Nouveau ticket SAV'}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="eq-modal-body">
          <div className="eq-form-grid">
            <div className="eq-form-field eq-form-full">
              <label>Équipement *</label>
              {preselectedEquipment && !ticket ? (
                <div className="eq-form-locked-value">
                  {preselectedEquipment.category_icon || preselectedEquipment.categoryIcon || '📦'} {cleanName(preselectedEquipment.name)} {preselectedEquipment.reference ? `(${preselectedEquipment.reference})` : ''}
                </div>
              ) : (
                <select value={form.equipment_id} onChange={(e) => setForm({ ...form, equipment_id: e.target.value })} required>
                  <option value="">— Sélectionner —</option>
                  {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.category_icon} {cleanName(eq.name)} {eq.reference ? `(${eq.reference})` : ''}</option>)}
                </select>
              )}
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

// ═══ FORMULAIRE DEMANDE SAV MOBILE (utilisateurs simples) ═══
const MobileSavRequestForm = ({ equipment, onSubmit, onClose }) => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'panne', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef(null);

  const filtered = useMemo(() => {
    if (!search.trim() || search.length < 2) return [];
    const q = search.toLowerCase();
    return equipment.filter(eq =>
      (eq.name && eq.name.toLowerCase().includes(q)) ||
      (eq.uid && eq.uid.toLowerCase().includes(q)) ||
      (eq.reference && eq.reference.toLowerCase().includes(q)) ||
      (eq.serialNumber && eq.serialNumber.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [equipment, search]);

  const handleSelect = (eq) => {
    setSelectedEquipment(eq);
    setSearch('');
    setShowResults(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEquipment) return toast.warning('Sélectionnez un équipement');
    if (!form.title.trim()) return toast.warning('Titre requis');
    setSubmitting(true);
    try {
      await onSubmit({
        equipment_id: selectedEquipment.id,
        title: form.title,
        description: form.description,
        type: form.type,
        priority: form.priority,
      });
      toast.success('Demande SAV envoyée');
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="eq-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="eq-modal" style={{ maxWidth: '100%', width: '100%', margin: 0, borderRadius: '12px 12px 0 0', position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="eq-modal-header">
          <h3>🔧 Demande de SAV</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="eq-modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {/* Sélection équipement */}
          <div className="eq-form-field eq-form-full" style={{ marginBottom: '1rem', position: 'relative', zIndex: 100 }}>
            <label>Équipement *</label>
            {selectedEquipment ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem', background: 'var(--theme-bg-secondary)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
                <span>{selectedEquipment.category_icon || selectedEquipment.categoryIcon || '📦'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedEquipment.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--theme-text-muted)' }}>
                    {selectedEquipment.uid}{selectedEquipment.reference ? ` — ${selectedEquipment.reference}` : ''}
                  </div>
                  {selectedEquipment.serialNumber && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--theme-accent, #2563eb)', fontWeight: 500 }}>S/N {selectedEquipment.serialNumber}</div>
                  )}
                </div>
                <button type="button" onClick={() => setSelectedEquipment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-muted)', padding: '4px' }}>
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative', zIndex: 100 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--theme-text-muted)', pointerEvents: 'none' }} />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
                    onFocus={() => search.length >= 2 && setShowResults(true)}
                    placeholder="Rechercher un équipement (nom, UID, réf…)"
                    style={{ paddingLeft: 32, width: '100%' }}
                    autoFocus
                  />
                </div>
                {showResults && filtered.length > 0 && (
                  <div
                    onTouchMove={(e) => {
                      const el = e.currentTarget;
                      if (el.scrollHeight > el.clientHeight) e.stopPropagation();
                    }}
                    style={{ position: 'absolute', left: 0, right: 0, zIndex: 200, marginTop: -1, background: 'var(--theme-bg-card, #fff)', border: '1px solid var(--theme-border)', borderTop: 'none', borderRadius: '0 0 10px 10px', maxHeight: 280, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
                  >
                    {filtered.map(eq => (
                      <div key={eq.id} role="button" tabIndex={0} onClick={() => handleSelect(eq)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0.75rem', width: '100%', textAlign: 'left', background: 'var(--theme-bg-card, #fff)', border: 'none', borderBottom: '1px solid var(--theme-border)', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--theme-text-primary)' }}>
                        <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{eq.category_icon || eq.categoryIcon || '📦'}</span>
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eq.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--theme-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {eq.uid}{eq.reference ? ` — ${eq.reference}` : ''}
                          </div>
                          {eq.serialNumber ? (
                            <div style={{ fontSize: '0.7rem', color: 'var(--theme-accent, #2563eb)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              S/N {eq.serialNumber}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {showResults && search.length >= 2 && filtered.length === 0 && (
                  <div style={{ position: 'relative', zIndex: 200, marginTop: -1, background: 'var(--theme-bg-card, #fff)', border: '1px solid var(--theme-border)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '0.75rem', textAlign: 'center', color: 'var(--theme-text-muted)', fontSize: '0.85rem', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
                    Aucun résultat
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Champs du formulaire */}
          <div className="eq-form-grid">
            <div className="eq-form-field eq-form-full">
              <label>Titre *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Câble arraché, ne charge plus…" />
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
            <div className="eq-form-field eq-form-full">
              <label>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Détails du problème, quand c'est arrivé…" />
            </div>
          </div>

          <div className="eq-modal-footer">
            <button type="button" className="eq-btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="eq-btn-save" disabled={submitting || !selectedEquipment}>
              {submitting ? 'Envoi…' : '🔧 Envoyer la demande'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═══ VOLET LATÉRAL SAV (clic simple) ═══
const SavSlidePanel = ({ ticket, equipment, persons, onClose, onEdit, onDelete, onOpenDialog, onOpenEquipmentDialog }) => {
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
        {onDelete && <button className="eq-btn-danger-sm" onClick={() => onDelete(t.id)} title="Supprimer" style={{ padding: '6px 10px' }}><Trash2 size={14} /></button>}
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
    <div className={`eq-dialog-overlay${isClosing ? ' closing' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="eq-dialog" style={{ maxWidth: 600 }}>
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
