import './AnnuairePanel.css';

import {
  ArrowLeft,
  BookOpen,
  Building,
  Building2,
  Check,
  Contact,
  Edit2,
  Eye,
  Filter,
  Globe,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Star,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  Button,
  Checkbox,
  FormField,
  Input,
  ModalLayout,
  SearchBar,
  SectionHeader,
  Select,
  Spinner,
  Table,
  Textarea,
  Tooltip,
} from '@/design-system';

import { ANNUAIRE_TAB_COLORS } from '../../constants/colors';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import ContactsCSVImportDialog from './ContactsCSVImportDialog';
import LocationsTab from './LocationsTab';
import MatchingContactEntitiesModal from './MatchingContactEntitiesModal';
import MatchingEntitiesModal from './MatchingEntitiesModal';
import MatchingLocationsModal from './MatchingLocationsModal';

// ═══ Constantes ═══
const ENTITY_TABS = [
  { id: 'clients', label: 'Clients', icon: Building2, color: ANNUAIRE_TAB_COLORS.clients },
  { id: 'suppliers', label: 'Fournisseurs', icon: Building, color: ANNUAIRE_TAB_COLORS.suppliers },
  {
    id: 'prestataires',
    label: 'Prestataires',
    icon: UserCheck,
    color: ANNUAIRE_TAB_COLORS.prestataires,
  },
  { id: 'contacts', label: 'Contacts', icon: Contact, color: ANNUAIRE_TAB_COLORS.contacts },
  { id: 'lieux', label: 'Lieux', icon: MapPin, color: ANNUAIRE_TAB_COLORS.lieux },
  {
    id: 'referentiels',
    label: 'Référentiels',
    icon: BookOpen,
    color: ANNUAIRE_TAB_COLORS.referentiels,
  },
];

const CLIENT_TYPES = [
  { value: 'client', label: 'Client actif' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'ancien', label: 'Ancien client' },
];

const SUPPLIER_TYPES = [
  { value: 'fournisseur', label: 'Fournisseur' },
  { value: 'sous-traitant', label: 'Sous-traitant' },
];

const REFERENTIEL_TABS = [
  { slug: 'legal-structures', label: 'Structures juridiques', key: 'legal_structures' },
  { slug: 'service-types', label: 'Types de prestation', key: 'service_types' },
  { slug: 'activity-sectors', label: "Secteurs d'activité", key: 'activity_sectors' },
  { slug: 'contact-categories', label: 'Catégories de contact', key: 'contact_categories' },
];

function normalizeContactPhone(phone) {
  if (!phone) return '';
  const raw = String(phone)
    .trim()
    .replace(/[\s().-]/g, '');
  if (raw.startsWith('+33') && raw.length >= 12) return `0${raw.slice(3)}`;
  return raw;
}

function contactDisplayName(c) {
  return `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.last_name || 'Contact';
}

function contactEntityLabel(c) {
  if (c.client_name) return `Client: ${c.client_name}`;
  if (c.supplier_name) return `Fournisseur: ${c.supplier_name}`;
  if (c.prestataire_name) return `Prestataire: ${c.prestataire_name}`;
  return 'Sans entité';
}

// ═══ Composant Principal ═══
function AnnuairePanel({ currentUser }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('clients');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lookups, setLookups] = useState({});
  const [stats, setStats] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [typeFilter, setTypeFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  // Contact form linked entity
  const [contactParentType, setContactParentType] = useState('');
  const [contactParentId, setContactParentId] = useState('');
  // Referentiels
  const [refTab, setRefTab] = useState('legal-structures');
  const [refData, setRefData] = useState([]);
  const [showRefForm, setShowRefForm] = useState(false);
  const [editingRef, setEditingRef] = useState(null);
  // Import CSV contacts
  const [showContactsImport, setShowContactsImport] = useState(false);
  // Matching lieux
  const [showMatching, setShowMatching] = useState(false);
  const [showEntityMatching, setShowEntityMatching] = useState(false);
  const [showContactEntityMatching, setShowContactEntityMatching] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [scanningDuplicates, setScanningDuplicates] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [duplicateMasterByGroup, setDuplicateMasterByGroup] = useState({});
  const [mergingGroupIndex, setMergingGroupIndex] = useState(null);
  // Compteurs de version pour déclencher un refresh après CRUD
  const [dataVersion, setDataVersion] = useState(0);
  const [refVersion, setRefVersion] = useState(0);
  // Ref pour le toast (éviter les dépendances instables dans les effets)
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  });

  // ═══ Fonctions stables de chargement (lookups/stats) ═══
  const loadLookups = useCallback(async () => {
    try {
      const refs = await api.getAnnuaireRefAll();
      setLookups(refs);
    } catch (e) {
      console.error('Erreur chargement référentiels:', e);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const s = await api.getAnnuaireStats();
      setStats(s);
    } catch (e) {
      console.error('Erreur chargement stats:', e);
    }
  }, []);

  // ═══ Chargement initial ═══
  useEffect(() => {
    loadLookups();
    loadStats();
  }, [loadLookups, loadStats]);

  // ═══ Changement d'onglet (reset des filtres, batché avec React 18) ═══
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setPage(1);
    setSearchTerm('');
    setTypeFilter('');
    setSectorFilter('');
    setSelectedItem(null);
    setShowForm(false);
  }, []);

  // ═══ Chargement des données (liste) — un seul effet propre ═══
  useEffect(() => {
    if (activeTab === 'referentiels') return;

    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = { page, limit: 50 };
        if (searchTerm) params.search = searchTerm;
        if (typeFilter) params.type = typeFilter;
        if (sectorFilter) params.activity_sector = sectorFilter;
        if (activeTab === 'contacts' && contactParentType && contactParentId) {
          params[`${contactParentType}_id`] = contactParentId;
        }

        let result;
        switch (activeTab) {
          case 'clients':
            result = await api.getAnnuaireClients(params);
            break;
          case 'suppliers':
            result = await api.getAnnuaireSuppliers(params);
            break;
          case 'prestataires':
            result = await api.getAnnuairePrestataires(params);
            break;
          case 'contacts':
            result = await api.getAnnuaireContacts(params);
            break;
          default:
            result = { data: [], total: 0 };
        }
        if (!cancelled) {
          setData(result.data || []);
          setTotal(result.total || 0);
        }
      } catch (e) {
        if (!cancelled) toastRef.current?.error('Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    page,
    searchTerm,
    typeFilter,
    sectorFilter,
    contactParentType,
    contactParentId,
    dataVersion,
  ]);

  // ═══ Chargement référentiels ═══
  useEffect(() => {
    if (activeTab !== 'referentiels') return;

    let cancelled = false;
    const fetchRefData = async () => {
      setLoading(true);
      try {
        const d = await api.getAnnuaireRef(refTab);
        if (!cancelled) setRefData(d);
      } catch (e) {
        if (!cancelled) toastRef.current?.error('Erreur chargement référentiels');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRefData();
    return () => {
      cancelled = true;
    };
  }, [activeTab, refTab, refVersion]);

  // ═══ CRUD handlers ═══
  const handleSave = async (formData) => {
    try {
      const isEdit = !!editingItem;
      switch (activeTab) {
        case 'clients':
          isEdit
            ? await api.updateAnnuaireClient(editingItem.id, formData)
            : await api.createAnnuaireClient(formData);
          break;
        case 'suppliers':
          isEdit
            ? await api.updateAnnuaireSupplier(editingItem.id, formData)
            : await api.createAnnuaireSupplier(formData);
          break;
        case 'prestataires':
          isEdit
            ? await api.updateAnnuairePrestataire(editingItem.id, formData)
            : await api.createAnnuairePrestataire(formData);
          break;
        case 'contacts':
          isEdit
            ? await api.updateAnnuaireContact(editingItem.id, formData)
            : await api.createAnnuaireContact(formData);
          break;
      }
      toast?.success(isEdit ? 'Modifié avec succès' : 'Créé avec succès');
      setShowForm(false);
      setEditingItem(null);
      setDataVersion((v) => v + 1);
      loadStats();
    } catch (e) {
      toast?.error(e.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = (item) => {
    confirm({
      title: 'Confirmer la suppression',
      message: `Supprimer ${item.name || item.last_name} ?`,
      onConfirm: async () => {
        try {
          switch (activeTab) {
            case 'clients':
              await api.deleteAnnuaireClient(item.id);
              break;
            case 'suppliers':
              await api.deleteAnnuaireSupplier(item.id);
              break;
            case 'prestataires':
              await api.deleteAnnuairePrestataire(item.id);
              break;
            case 'contacts':
              await api.deleteAnnuaireContact(item.id);
              break;
          }
          toast?.success('Supprimé');
          setDataVersion((v) => v + 1);
          loadStats();
        } catch (e) {
          toast?.error(e.message || 'Erreur');
        }
      },
    });
  };

  const handleImportCSV = async (type) => {
    try {
      const result =
        type === 'clients' ? await api.importClientsCsv() : await api.importSuppliersCsv();
      toast?.success(
        `Import terminé : ${result.imported} importés, ${result.skipped} ignorés, ${result.errors} erreurs`,
      );
      setDataVersion((v) => v + 1);
      loadStats();
    } catch (e) {
      toast?.error('Erreur import CSV');
    }
  };

  const handleScanContactDuplicates = async () => {
    setScanningDuplicates(true);
    try {
      const allContacts = [];
      let currentPage = 1;
      let totalPages = 1;

      while (currentPage <= totalPages) {
        const resp = await api.getAnnuaireContacts({ page: currentPage, limit: 500 });
        const chunk = Array.isArray(resp?.data) ? resp.data : [];
        allContacts.push(...chunk);
        totalPages = Math.max(1, Math.ceil((resp?.total || chunk.length) / 500));
        currentPage += 1;
      }

      const keyToIds = new Map();
      const byId = new Map();

      for (const c of allContacts) {
        byId.set(c.id, c);
        const keys = [];
        const email = (c.email || '').trim().toLowerCase();
        const phone = normalizeContactPhone(c.phone || c.phone2 || '');
        const name = `${(c.first_name || '').trim().toLowerCase()}|${(c.last_name || '').trim().toLowerCase()}`;

        if (email) keys.push(`email:${email}`);
        if (phone) keys.push(`phone:${phone}`);
        if (name !== '|') {
          keys.push(
            `name:${name}|${c.client_id || ''}|${c.supplier_id || ''}|${c.prestataire_id || ''}`,
          );
        }

        for (const key of keys) {
          if (!keyToIds.has(key)) keyToIds.set(key, new Set());
          keyToIds.get(key).add(c.id);
        }
      }

      const adjacency = new Map();
      for (const ids of keyToIds.values()) {
        const list = Array.from(ids);
        if (list.length < 2) continue;
        for (const id of list) {
          if (!adjacency.has(id)) adjacency.set(id, new Set());
          for (const other of list) {
            if (other !== id) adjacency.get(id).add(other);
          }
        }
      }

      const visited = new Set();
      const groups = [];
      for (const id of adjacency.keys()) {
        if (visited.has(id)) continue;
        const stack = [id];
        const component = [];
        while (stack.length > 0) {
          const node = stack.pop();
          if (visited.has(node)) continue;
          visited.add(node);
          component.push(node);
          for (const nei of adjacency.get(node) || []) {
            if (!visited.has(nei)) stack.push(nei);
          }
        }
        if (component.length > 1) {
          const contacts = component
            .map((cid) => byId.get(cid))
            .filter(Boolean)
            .sort((a, b) => Number(b.is_primary || 0) - Number(a.is_primary || 0));
          groups.push(contacts);
        }
      }

      const masterDefaults = {};
      groups.forEach((g, idx) => {
        masterDefaults[idx] = g[0]?.id;
      });

      setDuplicateGroups(groups);
      setDuplicateMasterByGroup(masterDefaults);
      setShowDuplicatesModal(true);
    } catch (e) {
      toast?.error('Erreur détection des doublons');
    } finally {
      setScanningDuplicates(false);
    }
  };

  const handleMergeDuplicateGroup = async (groupIndex) => {
    const group = duplicateGroups[groupIndex] || [];
    if (group.length < 2) return;

    const masterId = duplicateMasterByGroup[groupIndex] || group[0].id;
    const master = group.find((c) => c.id === masterId);
    const duplicates = group.filter((c) => c.id !== masterId);
    if (!master || duplicates.length === 0) return;

    setMergingGroupIndex(groupIndex);
    try {
      const merged = { ...master };
      const fields = [
        'first_name',
        'last_name',
        'job_title',
        'category',
        'email',
        'phone',
        'phone2',
        'notes',
      ];

      for (const field of fields) {
        if (merged[field]) continue;
        const candidate = duplicates.find((d) => d[field]);
        if (candidate) merged[field] = candidate[field];
      }

      if (!merged.client_id)
        merged.client_id = duplicates.find((d) => d.client_id)?.client_id || null;
      if (!merged.supplier_id)
        merged.supplier_id = duplicates.find((d) => d.supplier_id)?.supplier_id || null;
      if (!merged.prestataire_id)
        merged.prestataire_id = duplicates.find((d) => d.prestataire_id)?.prestataire_id || null;

      const payload = {
        client_id: merged.client_id || null,
        supplier_id: merged.supplier_id || null,
        prestataire_id: merged.prestataire_id || null,
        first_name: merged.first_name || null,
        last_name: merged.last_name || master.last_name || 'Contact',
        job_title: merged.job_title || null,
        category: merged.category || null,
        email: merged.email || null,
        phone: merged.phone || null,
        phone2: merged.phone2 || null,
        is_primary: merged.is_primary ? 1 : 0,
        notes: merged.notes || null,
        is_active: merged.is_active !== undefined ? merged.is_active : 1,
      };

      await api.updateAnnuaireContact(master.id, payload);
      for (const dup of duplicates) {
        await api.deleteAnnuaireContact(dup.id);
      }

      toast?.success(`Fusion effectuée: ${duplicates.length} doublon(s) consolidé(s)`);
      setDuplicateGroups((prev) => prev.filter((_, idx) => idx !== groupIndex));
      setDataVersion((v) => v + 1);
      loadStats();
    } catch (e) {
      toast?.error(e.message || 'Erreur lors de la fusion');
    } finally {
      setMergingGroupIndex(null);
    }
  };

  const handleRefSave = async (formData) => {
    try {
      if (editingRef) {
        await api.updateAnnuaireRef(refTab, editingRef.id, formData);
      } else {
        await api.createAnnuaireRef(refTab, formData);
      }
      toast?.success('Référentiel sauvegardé');
      setShowRefForm(false);
      setEditingRef(null);
      setRefVersion((v) => v + 1);
      loadLookups();
    } catch (e) {
      toast?.error(e.message || 'Erreur');
    }
  };

  const handleRefDelete = (item) => {
    confirm({
      title: 'Supprimer',
      message: `Supprimer « ${item.name} » ?`,
      onConfirm: async () => {
        try {
          await api.deleteAnnuaireRef(refTab, item.id);
          toast?.success('Supprimé');
          setRefVersion((v) => v + 1);
          loadLookups();
        } catch (e) {
          toast?.error('Erreur');
        }
      },
    });
  };

  // ═══ Helpers ═══
  const getLookupName = (key, code) => {
    const list = lookups[key] || [];
    const found = list.find((l) => l.code === code);
    return found ? found.name : code || '—';
  };

  const totalPages = Math.ceil(total / 50);

  // ═══ RENDU ═══
  return (
    <div className="annuaire-panel">
      {/* Toolbar unifiée : onglets + stats + recherche + actions */}
      <div className="annuaire-toolbar">
        <div className="annuaire-toolbar-top">
          <div className="annuaire-tabs">
            {ENTITY_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  variant="ghost"
                  key={tab.id}
                  className={`annuaire-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => handleTabChange(tab.id)}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </Button>
              );
            })}
          </div>
          {stats && (
            <div className="annuaire-header-stats">
              <span className="stat-badge client">{stats.clients?.total || 0} clients</span>
              <span className="stat-badge supplier">
                {stats.suppliers?.total || 0} fournisseurs
              </span>
              <span className="stat-badge prestataire">
                {stats.prestataires?.total || 0} prestataires
              </span>
              <span className="stat-badge contact">{stats.contacts?.total || 0} contacts</span>
              <span className="stat-badge location">{stats.locations?.total || 0} lieux</span>
            </div>
          )}
        </div>

        {activeTab !== 'referentiels' && activeTab !== 'lieux' && (
          <div className="annuaire-toolbar-actions-row">
            <SearchBar
              value={searchTerm}
              onChange={(val) => {
                setSearchTerm(val);
                setPage(1);
              }}
              placeholder="Rechercher..."
            />
            <div className="annuaire-toolbar-actions">
              {(activeTab === 'clients' || activeTab === 'suppliers') && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label="Filtres"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter size={15} />
                </Button>
              )}
              {activeTab === 'clients' && currentUser?.isAdmin && (
                <Tooltip content="Import CSV Clients Locmat" position="bottom">
                  <Button variant="secondary" onClick={() => handleImportCSV('clients')}>
                    <Upload size={15} /> CSV
                  </Button>
                </Tooltip>
              )}
              {activeTab === 'suppliers' && currentUser?.isAdmin && (
                <Tooltip content="Import CSV Fournisseurs Locmat" position="bottom">
                  <Button variant="secondary" onClick={() => handleImportCSV('suppliers')}>
                    <Upload size={15} /> CSV
                  </Button>
                </Tooltip>
              )}
              {activeTab === 'contacts' && currentUser?.isAdmin && (
                <Tooltip content="Import CSV Contacts Locmat" position="bottom">
                  <Button variant="secondary" onClick={() => setShowContactsImport(true)}>
                    <Upload size={15} /> CSV
                  </Button>
                </Tooltip>
              )}
              {activeTab === 'contacts' && currentUser?.isAdmin && (
                <Tooltip content="Détection et fusion de doublons" position="bottom">
                  <Button
                    variant="secondary"
                    onClick={handleScanContactDuplicates}
                    disabled={scanningDuplicates}
                  >
                    {scanningDuplicates ? <Spinner size="sm" /> : <Filter size={15} />} Doublons
                  </Button>
                </Tooltip>
              )}
              {(activeTab === 'clients' ||
                activeTab === 'suppliers' ||
                activeTab === 'prestataires') &&
                currentUser?.isAdmin && (
                  <>
                    <Tooltip content="Correspondances lieux ↔ entités" position="bottom">
                      <Button variant="secondary" onClick={() => setShowMatching(true)}>
                        <MapPin size={15} /> Lier lieux
                      </Button>
                    </Tooltip>
                    <Tooltip
                      content="Correspondances client ↔ fournisseur ↔ prestataire"
                      position="bottom"
                    >
                      <Button variant="secondary" onClick={() => setShowEntityMatching(true)}>
                        <Link2 size={15} /> Lier entités
                      </Button>
                    </Tooltip>
                  </>
                )}
              {activeTab === 'contacts' && currentUser?.isAdmin && (
                <Tooltip content="Correspondances contacts ↔ entités via email" position="bottom">
                  <Button variant="secondary" onClick={() => setShowContactEntityMatching(true)}>
                    <Link2 size={15} /> Lier contacts
                  </Button>
                </Tooltip>
              )}
              <Button
                variant="primary"
                onClick={() => {
                  setEditingItem(null);
                  setShowForm(true);
                }}
              >
                <Plus size={15} /> Nouveau
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Filters bar */}
      {showFilters &&
        activeTab !== 'referentiels' &&
        activeTab !== 'contacts' &&
        activeTab !== 'lieux' && (
          <div className="annuaire-filters">
            {activeTab === 'clients' && (
              <Select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tous les types</option>
                {CLIENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
            {activeTab === 'suppliers' && (
              <Select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tous les types</option>
                {SUPPLIER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
            <Select
              value={sectorFilter}
              onChange={(e) => {
                setSectorFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tous les secteurs</option>
              {(lookups.activity_sectors || []).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        )}

      {/* Lieux Tab — composant autonome */}
      {activeTab === 'lieux' && <LocationsTab currentUser={currentUser} />}

      {/* Content */}
      {activeTab !== 'lieux' && (
        <div className="annuaire-content">
          {loading ? (
            <div className="annuaire-loading">
              <Spinner size="lg" />
              <p>Chargement...</p>
            </div>
          ) : selectedItem ? (
            <DetailView
              item={selectedItem}
              entityType={activeTab}
              lookups={lookups}
              getLookupName={getLookupName}
              currentUser={currentUser}
              onBack={() => setSelectedItem(null)}
              onEdit={(item) => {
                setEditingItem(item);
                setShowForm(true);
                setSelectedItem(null);
              }}
              onAddContact={(parentType, parentId) => {
                handleTabChange('contacts');
                setContactParentType(parentType);
                setContactParentId(parentId);
                setTimeout(() => {
                  setEditingItem(null);
                  setShowForm(true);
                }, 100);
              }}
              toast={toast}
            />
          ) : activeTab === 'referentiels' ? (
            <ReferentielsView
              refTab={refTab}
              setRefTab={setRefTab}
              refData={refData}
              loading={loading}
              currentUser={currentUser}
              onAdd={() => {
                setEditingRef(null);
                setShowRefForm(true);
              }}
              onEdit={(item) => {
                setEditingRef(item);
                setShowRefForm(true);
              }}
              onDelete={handleRefDelete}
            />
          ) : (
            <>
              <EntityTable
                data={data}
                entityType={activeTab}
                currentUser={currentUser}
                getLookupName={getLookupName}
                onSelect={setSelectedItem}
                onEdit={(item) => {
                  setEditingItem(item);
                  setShowForm(true);
                }}
                onDelete={handleDelete}
              />
              {totalPages > 1 && (
                <div className="annuaire-pagination">
                  <Button
                    variant="ghost"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← Précédent
                  </Button>
                  <span>
                    Page {page} / {totalPages} ({total} résultats)
                  </span>
                  <Button
                    variant="ghost"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Suivant →
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <EntityFormModal
          entityType={activeTab}
          item={editingItem}
          lookups={lookups}
          contactParentType={contactParentType}
          contactParentId={contactParentId}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
        />
      )}

      {/* Ref Form Modal */}
      {showRefForm && (
        <RefFormModal
          item={editingRef}
          onSave={handleRefSave}
          onClose={() => {
            setShowRefForm(false);
            setEditingRef(null);
          }}
        />
      )}

      {ConfirmDialogRenderer}

      {showContactsImport && (
        <ContactsCSVImportDialog
          onClose={() => setShowContactsImport(false)}
          onSuccess={() => {
            setDataVersion((v) => v + 1);
            loadStats();
          }}
          toast={toast}
        />
      )}

      {showMatching && (
        <MatchingLocationsModal
          onClose={() => setShowMatching(false)}
          onLinked={(count) => {
            toast.success(`${count} entité(s) liée(s) à un lieu`);
            setDataVersion((v) => v + 1);
          }}
        />
      )}
      {showEntityMatching && (
        <MatchingEntitiesModal
          onClose={() => setShowEntityMatching(false)}
          onLinked={(count) => {
            toast.success(`${count} liaison(s) entité créées`);
            setDataVersion((v) => v + 1);
          }}
        />
      )}
      {showContactEntityMatching && (
        <MatchingContactEntitiesModal
          onClose={() => setShowContactEntityMatching(false)}
          onLinked={(count) => {
            toast.success(`${count} contact(s) lié(s) à une entité`);
            setDataVersion((v) => v + 1);
          }}
        />
      )}

      {showDuplicatesModal && (
        <ModalLayout
          open
          size="xl"
          title="Doublons contacts"
          onClose={() => setShowDuplicatesModal(false)}
        >
          <div className="annuaire-duplicates-modal">
            {duplicateGroups.length === 0 ? (
              <div className="annuaire-empty">Aucun doublon détecté</div>
            ) : (
              duplicateGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="annuaire-duplicate-group">
                  <div className="annuaire-duplicate-group-head">
                    <strong>Groupe {groupIndex + 1}</strong>
                    <span>{group.length} contacts potentiellement doublons</span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleMergeDuplicateGroup(groupIndex)}
                      disabled={mergingGroupIndex === groupIndex}
                    >
                      Fusionner
                    </Button>
                  </div>
                  <Table className="annuaire-duplicates-table">
                    <thead>
                      <tr>
                        <th>Maître</th>
                        <th>Nom</th>
                        <th>Fonction</th>
                        <th>Entité</th>
                        <th>Téléphone</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <Checkbox
                              checked={duplicateMasterByGroup[groupIndex] === c.id}
                              onChange={() =>
                                setDuplicateMasterByGroup((prev) => ({
                                  ...prev,
                                  [groupIndex]: c.id,
                                }))
                              }
                            />
                          </td>
                          <td>{contactDisplayName(c)}</td>
                          <td>{c.job_title || '—'}</td>
                          <td>{contactEntityLabel(c)}</td>
                          <td>{c.phone || c.phone2 || '—'}</td>
                          <td>{c.email || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ))
            )}
          </div>
        </ModalLayout>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ENTITY TABLE
// ═══════════════════════════════════════════════════════════════
function EntityTable({
  data,
  entityType,
  currentUser,
  _getLookupName,
  onSelect,
  onEdit,
  onDelete,
}) {
  if (!data.length) {
    return (
      <div className="annuaire-empty">
        <p>Aucun enregistrement trouvé</p>
      </div>
    );
  }

  if (entityType === 'contacts') {
    return (
      <div className="annuaire-table-wrapper">
        <Table className="annuaire-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Fonction</th>
              <th>Entité</th>
              <th>Téléphone</th>
              <th>Email</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} onDoubleClick={() => onSelect(c)}>
                <td className="name-cell">
                  {c.is_primary ? <Star size={12} className="primary-star" /> : null}
                  {c.first_name} <strong>{c.last_name}</strong>
                </td>
                <td>{c.job_title || '—'}</td>
                <td className="entity-cell">
                  {c.client_name && (
                    <span className="entity-tag client">Client: {c.client_name}</span>
                  )}
                  {c.supplier_name && (
                    <span className="entity-tag supplier">Fourn: {c.supplier_name}</span>
                  )}
                  {c.prestataire_name && (
                    <span className="entity-tag prestataire">Presta: {c.prestataire_name}</span>
                  )}
                </td>
                <td>{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : '—'}</td>
                <td>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</td>
                <td className="actions-cell">
                  <Tooltip content="Voir">
                    <Button variant="ghost" onClick={() => onSelect(c)}>
                      <Eye size={14} />
                    </Button>
                  </Tooltip>
                  {currentUser?.isAdmin && (
                    <Tooltip content="Modifier">
                      <Button variant="ghost" onClick={() => onEdit(c)}>
                        <Edit2 size={14} />
                      </Button>
                    </Tooltip>
                  )}
                  {currentUser?.isAdmin && (
                    <Tooltip content="Supprimer">
                      <Button
                        variant="danger"
                        iconOnly
                        aria-label="Supprimer"
                        onClick={() => onDelete(c)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </Tooltip>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }

  // Clients / Suppliers / Prestataires
  return (
    <div className="annuaire-table-wrapper">
      <Table className="annuaire-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Nom</th>
            <th>Ville</th>
            <th>Téléphone</th>
            <th>Email</th>
            {entityType !== 'prestataires' && <th>Type</th>}
            <th>Contacts</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id} className={item.is_active === 0 ? 'inactive-row' : ''}>
              <td className="code-cell">{item.code_libre || '—'}</td>
              <td
                className="name-cell clickable"
                role="button"
                tabIndex={0}
                onClick={() => onSelect(item)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(item)}
              >
                <strong>{item.name}</strong>
                {item.is_active === 0 && <span className="inactive-badge">Inactif</span>}
              </td>
              <td>{[item.postal_code, item.city].filter(Boolean).join(' ') || '—'}</td>
              <td>{item.phone ? <a href={`tel:${item.phone}`}>{item.phone}</a> : '—'}</td>
              <td>{item.email ? <a href={`mailto:${item.email}`}>{item.email}</a> : '—'}</td>
              {entityType !== 'prestataires' && (
                <td>
                  <span className={`type-badge ${item.type || ''}`}>{item.type || '—'}</span>
                </td>
              )}
              <td className="count-cell">{item.contact_count || 0}</td>
              <td className="actions-cell">
                <Tooltip content="Voir">
                  <Button variant="ghost" onClick={() => onSelect(item)}>
                    <Eye size={14} />
                  </Button>
                </Tooltip>
                {currentUser?.isAdmin && (
                  <Tooltip content="Modifier">
                    <Button variant="ghost" onClick={() => onEdit(item)}>
                      <Edit2 size={14} />
                    </Button>
                  </Tooltip>
                )}
                {currentUser?.isAdmin && (
                  <Tooltip content="Supprimer">
                    <Button
                      variant="danger"
                      iconOnly
                      aria-label="Supprimer"
                      onClick={() => onDelete(item)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </Tooltip>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DETAIL VIEW
// ═══════════════════════════════════════════════════════════════
function DetailView({
  item,
  entityType,
  _lookups,
  getLookupName,
  currentUser,
  onBack,
  onEdit,
  onAddContact,
  toast,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkResults, setLinkResults] = useState([]);
  const [showLinkSearch, setShowLinkSearch] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        let d;
        switch (entityType) {
          case 'clients':
            d = await api.getAnnuaireClient(item.id);
            break;
          case 'suppliers':
            d = await api.getAnnuaireSupplier(item.id);
            break;
          case 'prestataires':
            d = await api.getAnnuairePrestataire(item.id);
            break;
          default:
            d = item;
        }
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) toast?.error('Erreur chargement détail');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDetail();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, entityType]);

  // Recherche de contacts existants pour liaison
  useEffect(() => {
    if (!showLinkSearch || linkSearch.length < 2) {
      setLinkResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await api.getAnnuaireContacts({ search: linkSearch, limit: 10 });
        // Exclure ceux déjà liés à cette entité
        const existingIds = new Set((detail?.contacts || []).map((c) => c.id));
        setLinkResults((result.data || []).filter((c) => !existingIds.has(c.id)));
      } catch {
        setLinkResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [linkSearch, showLinkSearch, detail]);

  const handleLinkContact = async (contact) => {
    const parentType =
      entityType === 'clients' ? 'client' : entityType === 'suppliers' ? 'supplier' : 'prestataire';
    const idField =
      parentType === 'client'
        ? 'client_id'
        : parentType === 'supplier'
          ? 'supplier_id'
          : 'prestataire_id';
    try {
      await api.updateAnnuaireContact(contact.id, { [idField]: detail.id });
      // Refresh
      let d;
      switch (entityType) {
        case 'clients':
          d = await api.getAnnuaireClient(detail.id);
          break;
        case 'suppliers':
          d = await api.getAnnuaireSupplier(detail.id);
          break;
        case 'prestataires':
          d = await api.getAnnuairePrestataire(detail.id);
          break;
        default:
          d = detail;
      }
      setDetail(d);
      setShowLinkSearch(false);
      setLinkSearch('');
      setLinkResults([]);
      toast?.success(`${contact.first_name || ''} ${contact.last_name} lié avec succès`);
    } catch {
      toast?.error('Erreur lors de la liaison');
    }
  };

  if (loading || !detail)
    return (
      <div className="annuaire-loading">
        <Spinner size="lg" />
      </div>
    );

  const serviceTypes = (() => {
    try {
      return JSON.parse(detail.service_types || '[]');
    } catch {
      return [];
    }
  })();

  const parentType =
    entityType === 'clients' ? 'client' : entityType === 'suppliers' ? 'supplier' : 'prestataire';

  return (
    <div className="annuaire-detail">
      <div className="detail-header">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Retour
        </Button>
        <div className="detail-title">
          <h3>{detail.name}</h3>
          {detail.code_libre && <span className="code-badge">{detail.code_libre}</span>}
          {detail.is_active === 0 && <span className="inactive-badge">Inactif</span>}
        </div>
        {currentUser?.isAdmin && (
          <Button variant="secondary" onClick={() => onEdit(detail)}>
            <Edit2 size={14} /> Modifier
          </Button>
        )}
      </div>

      <div className="detail-grid">
        {/* Infos générales */}
        <div className="detail-section">
          <h4>Informations générales</h4>
          <div className="detail-fields">
            {detail.type && (
              <div className="field">
                <label>Type</label>
                <span className={`type-badge ${detail.type}`}>{detail.type}</span>
              </div>
            )}
            {detail.legal_structure && (
              <div className="field">
                <label>Forme juridique</label>
                <span>{getLookupName('legal_structures', detail.legal_structure)}</span>
              </div>
            )}
            {detail.siret && (
              <div className="field">
                <label>SIRET</label>
                <span>{detail.siret}</span>
              </div>
            )}
            {detail.tva_intra && (
              <div className="field">
                <label>TVA Intra.</label>
                <span>{detail.tva_intra}</span>
              </div>
            )}
            {detail.activity_sector && (
              <div className="field">
                <label>Secteur</label>
                <span>{getLookupName('activity_sectors', detail.activity_sector)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Coordonnées */}
        <div className="detail-section">
          <h4>Coordonnées</h4>
          <div className="detail-fields">
            {detail.address && (
              <div className="field">
                <label>
                  <MapPin size={13} /> Adresse
                </label>
                <span>{detail.address}</span>
              </div>
            )}
            {(detail.postal_code || detail.city) && (
              <div className="field">
                <label>Ville</label>
                <span>{[detail.postal_code, detail.city].filter(Boolean).join(' ')}</span>
              </div>
            )}
            {detail.country && detail.country !== 'France' && (
              <div className="field">
                <label>Pays</label>
                <span>{detail.country}</span>
              </div>
            )}
            {detail.phone && (
              <div className="field">
                <label>
                  <Phone size={13} /> Tél.
                </label>
                <a href={`tel:${detail.phone}`}>{detail.phone}</a>
              </div>
            )}
            {detail.phone2 && (
              <div className="field">
                <label>
                  <Phone size={13} /> Tél. 2
                </label>
                <a href={`tel:${detail.phone2}`}>{detail.phone2}</a>
              </div>
            )}
            {detail.email && (
              <div className="field">
                <label>
                  <Mail size={13} /> Email
                </label>
                <a href={`mailto:${detail.email}`}>{detail.email}</a>
              </div>
            )}
            {detail.website &&
              (() => {
                try {
                  const url = detail.website.startsWith('http')
                    ? detail.website
                    : `https://${detail.website}`;
                  const parsed = new URL(url);
                  if (!['http:', 'https:'].includes(parsed.protocol))
                    return (
                      <div className="field">
                        <label>
                          <Globe size={13} /> Site web
                        </label>
                        <span>{detail.website}</span>
                      </div>
                    );
                  return (
                    <div className="field">
                      <label>
                        <Globe size={13} /> Site web
                      </label>
                      <a href={url} target="_blank" rel="noreferrer">
                        {detail.website}
                      </a>
                    </div>
                  );
                } catch {
                  return (
                    <div className="field">
                      <label>
                        <Globe size={13} /> Site web
                      </label>
                      <span>{detail.website}</span>
                    </div>
                  );
                }
              })()}
          </div>
        </div>

        {/* Prestations */}
        {serviceTypes.length > 0 && (
          <div className="detail-section">
            <h4>Types de prestation</h4>
            <div className="tags-list">
              {serviceTypes.map((code) => (
                <span key={code} className="service-tag">
                  {getLookupName('service_types', code)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {detail.notes && (
          <div className="detail-section full-width">
            <h4>Notes</h4>
            <p className="notes-text">{detail.notes}</p>
          </div>
        )}

        {/* Contacts */}
        <div className="detail-section full-width">
          <SectionHeader
            as="h4"
            title={`Contacts (${detail.contacts?.length || 0})`}
            actions={
              <div style={{ display: 'flex', gap: 6 }}>
                <Button variant="ghost" size="sm" onClick={() => setShowLinkSearch((s) => !s)}>
                  <Contact size={13} /> Lier existant
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onAddContact(parentType, detail.id)}
                >
                  <Plus size={13} /> Ajouter
                </Button>
              </div>
            }
          />
          {showLinkSearch && (
            <div className="link-contact-search">
              <Input
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                placeholder="Rechercher un contact existant..."
                autoFocus
              />
              {linkResults.length > 0 && (
                <div className="link-contact-results">
                  {linkResults.map((c) => (
                    <div
                      key={c.id}
                      className="link-contact-item"
                      onClick={() => handleLinkContact(c)}
                    >
                      <span>
                        {c.first_name} <strong>{c.last_name}</strong>
                      </span>
                      {c.job_title && <span className="link-contact-job">{c.job_title}</span>}
                      {(c.client_name || c.supplier_name || c.prestataire_name) && (
                        <span className="link-contact-entity">
                          {c.client_name || c.supplier_name || c.prestataire_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {detail.contacts?.length > 0 ? (
            <div className="contacts-grid">
              {detail.contacts.map((c) => (
                <div key={c.id} className="contact-card">
                  {c.is_primary ? <Star size={12} className="primary-star" /> : null}
                  <div className="contact-name">
                    {c.first_name} <strong>{c.last_name}</strong>
                  </div>
                  {c.job_title && <div className="contact-job">{c.job_title}</div>}
                  {c.phone && (
                    <div className="contact-info">
                      <Phone size={12} /> <a href={`tel:${c.phone}`}>{c.phone}</a>
                    </div>
                  )}
                  {c.email && (
                    <div className="contact-info">
                      <Mail size={12} /> <a href={`mailto:${c.email}`}>{c.email}</a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-text">Aucun contact associé</p>
          )}
        </div>

        {/* Commandes (fournisseurs) */}
        {entityType === 'suppliers' && detail.orders?.length > 0 && (
          <div className="detail-section full-width">
            <h4>Dernières commandes</h4>
            <Table className="mini-table">
              <thead>
                <tr>
                  <th>Réf.</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Total TTC</th>
                </tr>
              </thead>
              <tbody>
                {detail.orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.reference}</td>
                    <td>{o.order_date || '—'}</td>
                    <td>
                      <span className={`status-badge ${o.status}`}>{o.status}</span>
                    </td>
                    <td>{o.total_ttc ? `${o.total_ttc.toFixed(2)} €` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FORM MODAL
// ═══════════════════════════════════════════════════════════════
function EntityFormModal({
  entityType,
  item,
  lookups,
  contactParentType,
  contactParentId,
  onSave,
  onClose,
}) {
  const isEdit = !!item;
  const isContact = entityType === 'contacts';

  const [form, setForm] = useState(() => {
    if (isContact) {
      return {
        first_name: item?.first_name || '',
        last_name: item?.last_name || '',
        job_title: item?.job_title || '',
        category: item?.category || '',
        email: item?.email || '',
        phone: item?.phone || '',
        phone2: item?.phone2 || '',
        is_primary: item?.is_primary || false,
        notes: item?.notes || '',
        client_id: item?.client_id || (contactParentType === 'client' ? contactParentId : '') || '',
        supplier_id:
          item?.supplier_id || (contactParentType === 'supplier' ? contactParentId : '') || '',
        prestataire_id:
          item?.prestataire_id ||
          (contactParentType === 'prestataire' ? contactParentId : '') ||
          '',
      };
    }
    // Parse service_types
    let st = [];
    try {
      st = JSON.parse(item?.service_types || '[]');
    } catch {}

    return {
      name: item?.name || '',
      code_libre: item?.code_libre || '',
      email: item?.email || '',
      phone: item?.phone || '',
      phone2: item?.phone2 || '',
      address: item?.address || '',
      postal_code: item?.postal_code || '',
      city: item?.city || '',
      country: item?.country || 'France',
      type:
        item?.type ||
        (entityType === 'clients' ? 'client' : entityType === 'suppliers' ? 'fournisseur' : ''),
      legal_structure: item?.legal_structure || '',
      siret: item?.siret || '',
      tva_intra: item?.tva_intra || '',
      website: item?.website || '',
      activity_sector: item?.activity_sector || '',
      service_types: st,
      notes: item?.notes || '',
      is_active: item?.is_active !== undefined ? item.is_active : 1,
      contact_name: item?.contact_name || '',
      location_id: item?.location_id || '',
    };
  });

  // Liste des lieux pour le sélecteur de liaison
  const [locationsList, setLocationsList] = useState([]);
  useEffect(() => {
    if (!isContact) {
      api
        .getLocations()
        .then((res) => setLocationsList(res || []))
        .catch(() => {});
    }
  }, [isContact]);

  // Recherche d'entités pour le sélecteur de liaison contact
  const [entitySearch, setEntitySearch] = useState('');
  const [entitySearchResults, setEntitySearchResults] = useState([]);
  const [entitySearchLoading, setEntitySearchLoading] = useState(false);
  const [selectedParentType, setSelectedParentType] = useState(
    contactParentType ||
      (item?.client_id
        ? 'client'
        : item?.supplier_id
          ? 'supplier'
          : item?.prestataire_id
            ? 'prestataire'
            : ''),
  );
  const [selectedParentLabel, setSelectedParentLabel] = useState(
    item?.client_name || item?.supplier_name || item?.prestataire_name || '',
  );
  const hasPresetParent = !!(contactParentType && contactParentId);

  // Recherche debounced d'entités
  useEffect(() => {
    if (!isContact || hasPresetParent || !selectedParentType || entitySearch.length < 2) {
      setEntitySearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setEntitySearchLoading(true);
      try {
        let result;
        const params = { search: entitySearch, limit: 10 };
        if (selectedParentType === 'client') result = await api.getAnnuaireClients(params);
        else if (selectedParentType === 'supplier') result = await api.getAnnuaireSuppliers(params);
        else result = await api.getAnnuairePrestataires(params);
        setEntitySearchResults(result.data || []);
      } catch {
        setEntitySearchResults([]);
      } finally {
        setEntitySearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [entitySearch, selectedParentType, isContact, hasPresetParent]);

  const handleSelectParentEntity = (entity) => {
    const idField =
      selectedParentType === 'client'
        ? 'client_id'
        : selectedParentType === 'supplier'
          ? 'supplier_id'
          : 'prestataire_id';
    setForm((prev) => ({
      ...prev,
      client_id: '',
      supplier_id: '',
      prestataire_id: '',
      [idField]: entity.id,
    }));
    setSelectedParentLabel(entity.name);
    setEntitySearch('');
    setEntitySearchResults([]);
  };

  const handleClearParentEntity = () => {
    setForm((prev) => ({ ...prev, client_id: '', supplier_id: '', prestataire_id: '' }));
    setSelectedParentLabel('');
  };

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const toggleServiceType = (code) => {
    setForm((prev) => {
      const list = prev.service_types || [];
      return {
        ...prev,
        service_types: list.includes(code) ? list.filter((c) => c !== code) : [...list, code],
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    // Clean empty strings to null
    for (const [k, v] of Object.entries(data)) {
      if (v === '') data[k] = null;
    }
    if (isContact) {
      data.is_primary = data.is_primary ? 1 : 0;
    }
    onSave(data);
  };

  const types =
    entityType === 'clients' ? CLIENT_TYPES : entityType === 'suppliers' ? SUPPLIER_TYPES : [];

  return (
    <ModalLayout
      open
      onClose={onClose}
      title={`${isEdit ? 'Modifier' : 'Nouveau'} ${
        isContact
          ? 'contact'
          : entityType === 'clients'
            ? 'client'
            : entityType === 'suppliers'
              ? 'fournisseur'
              : 'prestataire'
      }`}
      size="lg"
      className="annuaire-form-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="entity-form">
            <Check size={15} /> {isEdit ? 'Modifier' : 'Créer'}
          </Button>
        </>
      }
    >
      <form id="entity-form" onSubmit={handleSubmit} className="annuaire-form">
        {isContact ? (
          // ─── Contact form ───
          <>
            {/* Sélecteur d'entité parente (si pas pré-défini) */}
            {!hasPresetParent && (
              <div className="contact-parent-selector">
                <FormField className="form-group" label="Rattacher à">
                  <div className="contact-parent-row">
                    <Select
                      value={selectedParentType}
                      onChange={(e) => {
                        setSelectedParentType(e.target.value);
                        handleClearParentEntity();
                        setEntitySearch('');
                      }}
                    >
                      <option value="">— Aucun (contact libre) —</option>
                      <option value="client">Client</option>
                      <option value="supplier">Fournisseur</option>
                      <option value="prestataire">Prestataire</option>
                    </Select>
                  </div>
                </FormField>
                {selectedParentType && (
                  <FormField
                    className="form-group"
                    label={selectedParentLabel ? 'Entité liée' : 'Rechercher...'}
                  >
                    {selectedParentLabel ? (
                      <div className="contact-parent-selected">
                        <span className={`entity-tag ${selectedParentType}`}>
                          {selectedParentLabel}
                        </span>
                        <Button variant="ghost" type="button" onClick={handleClearParentEntity}>
                          <X size={14} />
                        </Button>
                      </div>
                    ) : (
                      <div className="contact-parent-search-wrapper">
                        <Input
                          value={entitySearch}
                          onChange={(e) => setEntitySearch(e.target.value)}
                          placeholder={`Rechercher un ${selectedParentType === 'client' ? 'client' : selectedParentType === 'supplier' ? 'fournisseur' : 'prestataire'}...`}
                          autoFocus
                        />
                        {entitySearchLoading && <Spinner size="sm" />}
                        {entitySearchResults.length > 0 && (
                          <div className="contact-parent-results">
                            {entitySearchResults.map((e) => (
                              <div
                                key={e.id}
                                className="contact-parent-result-item"
                                onClick={() => handleSelectParentEntity(e)}
                              >
                                <strong>{e.name}</strong>
                                {e.city && <span className="result-city">{e.city}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </FormField>
                )}
              </div>
            )}
            <div className="form-row">
              <FormField className="form-group" label="Prénom">
                <Input
                  maxLength={100}
                  value={form.first_name || ''}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                />
              </FormField>
              <FormField className="form-group" label="Nom" required>
                <Input
                  maxLength={100}
                  value={form.last_name || ''}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  required
                />
              </FormField>
            </div>
            <div className="form-row">
              <FormField className="form-group" label="Fonction">
                <Input
                  maxLength={100}
                  value={form.job_title || ''}
                  onChange={(e) => handleChange('job_title', e.target.value)}
                />
              </FormField>
              <FormField className="form-group" label="Catégorie">
                <Select
                  value={form.category || ''}
                  onChange={(e) => handleChange('category', e.target.value)}
                >
                  <option value="">— Choisir —</option>
                  {(lookups.contact_categories || []).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <div className="form-row">
              <FormField className="form-group" label="Téléphone">
                <Input
                  maxLength={20}
                  value={form.phone || ''}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </FormField>
              <FormField className="form-group" label="Tél. 2">
                <Input
                  maxLength={20}
                  value={form.phone2 || ''}
                  onChange={(e) => handleChange('phone2', e.target.value)}
                />
              </FormField>
            </div>
            <FormField className="form-group" label="Email">
              <Input
                type="email"
                maxLength={254}
                value={form.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </FormField>
            <div className="form-group">
              <label className="checkbox-label">
                <Checkbox
                  checked={form.is_primary || false}
                  onChange={(e) => handleChange('is_primary', e.target.checked)}
                />
                Contact principal
              </label>
            </div>
            <FormField className="form-group" label="Notes">
              <Textarea
                value={form.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={2}
              />
            </FormField>
          </>
        ) : (
          // ─── Entity form (client/supplier/prestataire) ───
          <>
            <div className="form-row">
              <FormField className="form-group flex-2" label="Nom" required>
                <Input
                  maxLength={200}
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                />
              </FormField>
              <FormField className="form-group" label="Code libre">
                <Input
                  maxLength={50}
                  value={form.code_libre || ''}
                  onChange={(e) => handleChange('code_libre', e.target.value)}
                />
              </FormField>
            </div>

            {types.length > 0 && (
              <div className="form-row">
                <FormField className="form-group" label="Type">
                  <Select
                    value={form.type || ''}
                    onChange={(e) => handleChange('type', e.target.value)}
                  >
                    <option value="">— Choisir —</option>
                    {types.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField className="form-group" label="Forme juridique">
                  <Select
                    value={form.legal_structure || ''}
                    onChange={(e) => handleChange('legal_structure', e.target.value)}
                  >
                    <option value="">— Choisir —</option>
                    {(lookups.legal_structures || []).map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
            )}

            {entityType === 'prestataires' && (
              <FormField className="form-group" label="Forme juridique">
                <Select
                  value={form.legal_structure || ''}
                  onChange={(e) => handleChange('legal_structure', e.target.value)}
                >
                  <option value="">— Choisir —</option>
                  {(lookups.legal_structures || []).map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}

            <div className="form-row">
              <FormField className="form-group" label="SIRET">
                <Input
                  maxLength={17}
                  value={form.siret || ''}
                  onChange={(e) => handleChange('siret', e.target.value)}
                />
              </FormField>
              <FormField className="form-group" label="TVA Intra.">
                <Input
                  maxLength={20}
                  value={form.tva_intra || ''}
                  onChange={(e) => handleChange('tva_intra', e.target.value)}
                />
              </FormField>
            </div>

            <FormField className="form-group" label="Adresse">
              <Input
                maxLength={500}
                value={form.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </FormField>

            <div className="form-row">
              <FormField className="form-group" label="Code postal">
                <Input
                  maxLength={10}
                  value={form.postal_code || ''}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                />
              </FormField>
              <FormField className="form-group flex-2" label="Ville">
                <Input
                  maxLength={100}
                  value={form.city || ''}
                  onChange={(e) => handleChange('city', e.target.value)}
                />
              </FormField>
            </div>

            <FormField className="form-group" label="Lieu lié">
              <div className="form-row" style={{ gap: 8, alignItems: 'center' }}>
                <Select
                  style={{ flex: 1 }}
                  value={form.location_id || ''}
                  onChange={(e) =>
                    handleChange('location_id', e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">— Aucun lieu —</option>
                  {locationsList.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.address ? ` — ${l.address}` : ''}
                    </option>
                  ))}
                </Select>
                {form.location_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleChange('location_id', null)}
                    title="Délier"
                  >
                    <X size={14} />
                  </Button>
                )}
              </div>
            </FormField>

            <div className="form-row">
              <FormField className="form-group" label="Téléphone">
                <Input
                  maxLength={20}
                  value={form.phone || ''}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </FormField>
              <FormField className="form-group" label="Tél. 2">
                <Input
                  maxLength={20}
                  value={form.phone2 || ''}
                  onChange={(e) => handleChange('phone2', e.target.value)}
                />
              </FormField>
            </div>

            <div className="form-row">
              <FormField className="form-group" label="Email">
                <Input
                  type="email"
                  maxLength={254}
                  value={form.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                />
              </FormField>
              <FormField className="form-group" label="Site web">
                <Input
                  maxLength={500}
                  value={form.website || ''}
                  onChange={(e) => handleChange('website', e.target.value)}
                />
              </FormField>
            </div>

            {entityType === 'suppliers' && (
              <FormField className="form-group" label="Nom du contact">
                <Input
                  maxLength={100}
                  value={form.contact_name || ''}
                  onChange={(e) => handleChange('contact_name', e.target.value)}
                />
              </FormField>
            )}

            <FormField className="form-group" label="Secteur d'activité">
              <Select
                value={form.activity_sector || ''}
                onChange={(e) => handleChange('activity_sector', e.target.value)}
              >
                <option value="">— Choisir —</option>
                {(lookups.activity_sectors || []).map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField className="form-group" label="Types de prestation">
              <div className="service-types-grid">
                {(lookups.service_types || []).map((st) => (
                  <label
                    key={st.code}
                    className={`service-type-chip ${(form.service_types || []).includes(st.code) ? 'selected' : ''}`}
                  >
                    <Checkbox
                      checked={(form.service_types || []).includes(st.code)}
                      onChange={() => toggleServiceType(st.code)}
                    />
                    {st.name}
                  </label>
                ))}
              </div>
            </FormField>

            <FormField className="form-group" label="Notes">
              <Textarea
                value={form.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
              />
            </FormField>
          </>
        )}
      </form>
    </ModalLayout>
  );
}

// ═══════════════════════════════════════════════════════════════
// REFERENTIELS VIEW
// ═══════════════════════════════════════════════════════════════
function ReferentielsView({
  refTab,
  setRefTab,
  refData,
  _loading,
  currentUser,
  onAdd,
  onEdit,
  onDelete,
}) {
  return (
    <div className="referentiels-view">
      <div className="ref-toolbar">
        <div className="ref-tabs">
          {REFERENTIEL_TABS.map((t) => (
            <Button
              variant="ghost"
              key={t.slug}
              className={`ref-tab ${refTab === t.slug ? 'active' : ''}`}
              onClick={() => setRefTab(t.slug)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        {currentUser?.isAdmin && (
          <Button variant="primary" onClick={onAdd}>
            <Plus size={15} /> Ajouter
          </Button>
        )}
      </div>

      <div className="annuaire-table-wrapper">
        <Table className="annuaire-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Libellé</th>
              <th>Ordre</th>
              <th>Actif</th>
              {currentUser?.isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {refData.map((item) => (
              <tr key={item.id} className={!item.is_active ? 'inactive-row' : ''}>
                <td className="code-cell">{item.code}</td>
                <td>{item.name}</td>
                <td>{item.sort_order}</td>
                <td>
                  {item.is_active ? (
                    <Check size={14} className="text-success" />
                  ) : (
                    <X size={14} className="text-muted" />
                  )}
                </td>
                {currentUser?.isAdmin && (
                  <td className="actions-cell">
                    <Tooltip content="Modifier">
                      <Button variant="ghost" onClick={() => onEdit(item)}>
                        <Edit2 size={14} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Supprimer">
                      <Button
                        variant="danger"
                        iconOnly
                        aria-label="Supprimer"
                        onClick={() => onDelete(item)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </Tooltip>
                  </td>
                )}
              </tr>
            ))}
            {refData.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-cell">
                  Aucune donnée
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REF FORM MODAL
// ═══════════════════════════════════════════════════════════════
function RefFormModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    code: item?.code || '',
    name: item?.name || '',
    sort_order: item?.sort_order || 0,
    is_active: item?.is_active !== undefined ? item.is_active : 1,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <ModalLayout
      open
      onClose={onClose}
      title={item ? 'Modifier' : 'Ajouter'}
      size="sm"
      className="annuaire-form-modal small"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="ref-form">
            <Check size={15} /> Enregistrer
          </Button>
        </>
      }
    >
      <form id="ref-form" onSubmit={handleSubmit} className="annuaire-form">
        <div className="form-row">
          <FormField className="form-group" label="Code" required>
            <Input
              maxLength={50}
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              required
            />
          </FormField>
          <FormField className="form-group flex-2" label="Libellé" required>
            <Input
              maxLength={200}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </FormField>
        </div>
        <div className="form-row">
          <FormField className="form-group" label="Ordre">
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) =>
                setForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))
              }
            />
          </FormField>
          <div className="form-group">
            <label className="checkbox-label">
              <Checkbox
                checked={!!form.is_active}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked ? 1 : 0 }))}
              />
              Actif
            </label>
          </div>
        </div>
      </form>
    </ModalLayout>
  );
}

export default React.memo(AnnuairePanel);
