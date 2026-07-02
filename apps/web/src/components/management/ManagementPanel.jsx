import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Cloud,
  Download,
  Edit2,
  Gauge,
  GripVertical,
  Lock,
  Map,
  MapPin,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Smartphone,
  Trash2,
  Truck,
  Upload,
  UserCircle2,
} from 'lucide-react';
import React, { Suspense, useEffect, useRef, useState } from 'react';

import api from '../../utils/api';
import { loadFromIndexedDB, saveToIndexedDB, STORES } from '../../utils/indexedDB';
import { getAvailablePhotos, getPhotosSync } from '../../utils/photoList';
import { getVehicleAvatar } from '../../utils/vehicleAvatars';
import { getExpiredTechnicalControls, hasExpiredTechnicalControl } from '../../utils/vehicleUtils';
import ChangePassword from '../auth/ChangePassword';
import MobileAccess from '../auth/MobileAccess';
import LocationsMapPanel from '../locations/LocationsMapPanel';
import { formatPhoneDisplay } from '../PhoneInput';
import ClientDialog from '../vehicles/ClientDialog';
import DepotMap from '../vehicles/DepotMap';
import GoogleCalendarConfig from '../vehicles/GoogleCalendarConfig';
import LocationDialog from '../vehicles/LocationDialog';
import ReservationRequestsPanel from '../vehicles/ReservationRequestsPanel';
import VehicleMaintenanceModal from '../vehicles/VehicleMaintenanceModal';
import RentalReportingPanel from './RentalReportingPanel';
import UserManagement from './UserManagement';
const PersonnelPanel = React.lazy(() => import('../personnel/PersonnelPanel'));
import './ManagementPanel.css';

import { Button, Input, Modal, ModalBody, ModalHeader, Select } from '@/design-system';

import { ACCENT_COLORS, MANAGEMENT_PALETTE, STATUS_COLORS } from '../../constants/colors';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';

/**
 * Helper: récupère les 40 couleurs de gestion depuis les tokens CSS.
 * Fallback sur MANAGEMENT_PALETTE si les tokens ne sont pas disponibles.
 */
function getMgmtColors() {
  if (typeof window === 'undefined') return MANAGEMENT_PALETTE;

  const root = document.documentElement;
  const computed = getComputedStyle(root);
  const colors = [];

  for (let i = 0; i < 40; i++) {
    const tokenName = `--mgmt-color-${i}`;
    let value = computed.getPropertyValue(tokenName).trim();

    // Si le token n'est pas trouvé, utiliser la palette JS
    if (!value) {
      value = MANAGEMENT_PALETTE[i] || '#999999';
    }

    colors.push(value);
  }

  return colors;
}

const ManagementPanel = ({
  vehicles,
  setVehicles,
  _reservations,
  setReservations,
  clients,
  setClients,
  drivers,
  setDrivers,
  locations,
  setLocations,
  _calendarConfig,
  setCalendarConfig,
  _garages,
  setGarages,
  maintenances,
  setMaintenances,
  currentUser,
  onClose,
  activeModule = 'vehicles',
  panelType = 'management',
  onNavigateToPersonnel,
}) => {
  const toast = useToast();
  const [colors, setColors] = useState(getMgmtColors());
  const [activeTab, setActiveTab] = useState(() => {
    if (panelType === 'settings') return 'account';
    return 'vehicles';
  });
  const [pendingAccessCount, setPendingAccessCount] = useState(0);
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({
    name: '',
    isLocation: false,
    type: '',
    color: STATUS_COLORS.info,
    immatriculation: '',
    marque: '',
    couleurVehicule: '',
    photo: '',
    address: '',
    lat: null,
    lng: null,
    placeId: '',
    locationType: 'Salle de spectacle',
  });
  const [availablePhotos, setAvailablePhotos] = useState(getPhotosSync());
  const [isRefreshingPhotos, setIsRefreshingPhotos] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedSection, setDraggedSection] = useState(null);
  const [importStatus, setImportStatus] = useState('');
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [locationToEdit, setLocationToEdit] = useState(null);
  const [showMapPanel, setShowMapPanel] = useState(false);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [clientToEdit, setClientToEdit] = useState(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [vehicleToMaintain, setVehicleToMaintain] = useState(null);
  const [companyAddress, setCompanyAddress] = useState('');
  const _autocompleteRef = useRef(null);
  const _inputRef = useRef(null);

  const fileInputRef = useRef(null);

  // State pour le plan dépôt (onglet settings)
  const [depotZones, setDepotZones] = useState(null);
  const [locationStats, setLocationStats] = useState(null);
  const [activeDepot, setActiveDepot] = useState(1);
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();

  // Charger le nombre de demandes d'accès en attente
  useEffect(() => {
    if (!currentUser?.isAdmin) return;
    const loadPendingCount = async () => {
      try {
        const data = await api.getPendingAccessRequestsCount();
        setPendingAccessCount(data.count || 0);
      } catch (_e) {
        /* silencieux */
      }
    };
    loadPendingCount();
    const interval = setInterval(loadPendingCount, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Charger l'adresse du siège depuis la config
  useEffect(() => {
    const loadCompanyAddress = async () => {
      try {
        const config = await loadFromIndexedDB('calendarConfig', {});
        const address = config.companyAddress || '';
        setCompanyAddress(address);
      } catch (error) {
        console.error('Erreur chargement adresse entreprise:', error);
      }
    };
    loadCompanyAddress();
  }, []);

  // Charger zones dépôt et stats quand l'onglet plan-dépôt est activé
  useEffect(() => {
    if (activeTab !== 'depot-map') return;
    setDepotZones(null); // Reset pendant le chargement
    const loadDepotData = async () => {
      try {
        const [zonesData, statsData] = await Promise.all([
          api.getEquipmentDepotZones(activeDepot).catch(() => null),
          api.getEquipmentLocationStats().catch(() => null),
        ]);
        if (zonesData) setDepotZones(zonesData);
        if (statsData) setLocationStats(statsData);
      } catch (err) {
        console.error('[ManagementPanel] Depot data load error:', err);
      }
    };
    loadDepotData();
  }, [activeTab, activeDepot]);

  // Charger la liste des photos au montage du composant
  useEffect(() => {
    const loadPhotos = async () => {
      const photos = await getAvailablePhotos();
      setAvailablePhotos(photos);
    };
    loadPhotos();
  }, []);

  // Fonction pour rafraîchir la liste des photos
  const refreshPhotoList = async () => {
    setIsRefreshingPhotos(true);
    try {
      const photos = await getAvailablePhotos();
      setAvailablePhotos(photos);
    } finally {
      setTimeout(() => setIsRefreshingPhotos(false), 500);
    }
  };

  // Les lieux utilisent maintenant LocationDialog avec PlaceAutocompleteElement

  const tabs =
    panelType === 'settings'
      ? [
          { id: 'account', label: 'Mon compte', icon: Lock, color: 'var(--theme-text-gray)' },
          ...(currentUser?.isAdmin
            ? [
                { id: 'users', label: 'Utilisateurs', icon: Shield, color: STATUS_COLORS.danger },
                { id: 'sync', label: 'Import/Export', icon: Cloud, color: ACCENT_COLORS.pink },
                {
                  id: 'google-config',
                  label: 'Config Google',
                  icon: Settings,
                  color: ACCENT_COLORS.cyanLight,
                },
                {
                  id: 'mobile',
                  label: 'Accès Mobile',
                  icon: Smartphone,
                  color: ACCENT_COLORS.violetLight,
                },
                {
                  id: 'depot-map',
                  label: 'Plan Dépôt',
                  icon: MapPin,
                  color: STATUS_COLORS.success,
                },
              ]
            : []),
        ]
      : [
          { id: 'vehicles', label: 'Véhicules', icon: Truck, color: STATUS_COLORS.info },
          { id: 'clients', label: 'Clients', icon: UserCircle2, color: ACCENT_COLORS.violet },
          ...(currentUser?.isAdmin
            ? [
                { id: 'requests', label: 'Demandes', icon: Calendar, color: ACCENT_COLORS.orange },
                {
                  id: 'rental-reports',
                  label: 'Rapports Locations',
                  icon: Gauge,
                  color: ACCENT_COLORS.cyan,
                },
              ]
            : []),
        ];

  useEffect(() => {
    const validTabIds = tabs.map((t) => t.id);
    if (!validTabIds.includes(activeTab)) {
      setActiveTab(validTabIds[0] || (panelType === 'settings' ? 'account' : 'vehicles'));
    }
  }, [activeTab, tabs, panelType]);

  const getCurrentList = () => {
    switch (activeTab) {
      case 'vehicles':
        return vehicles;
      case 'clients':
        return clients;
      case 'drivers':
        return drivers;
      case 'locations': {
        // Ajouter le siège comme premier lieu si une adresse est configurée
        if (companyAddress) {
          const companyLocation = {
            id: 'company-hq',
            name: 'Siège',
            address: companyAddress,
            type: 'Dépôt',
            isCompanyLocation: true,
          };
          return [companyLocation, ...locations];
        }
        return locations;
      }
      default:
        return [];
    }
  };

  const _setCurrentList = (newList) => {
    switch (activeTab) {
      case 'vehicles':
        setVehicles(newList);
        break;
      case 'clients':
        setClients(newList);
        break;
      case 'drivers':
        setDrivers(newList);
        break;
      case 'locations':
        setLocations(newList);
        break;
    }
  };

  const generateUUID = () => {
    // Fonction compatible avec tous les navigateurs
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const handleAdd = async () => {
    if (!newItem.name.trim()) return;

    const currentList = getCurrentList();
    // Générer un ID approprié selon le type d'entité
    let newId;
    if (activeTab === 'vehicles') {
      newId = generateUUID();
    } else {
      // Pour les autres entités (clients, drivers, etc.), utiliser un ID numérique
      const numericIds = currentList
        .map((item) => (typeof item.id === 'number' ? item.id : 0))
        .filter((id) => id > 0);
      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      newId = maxId + 1;
    }

    const itemToAdd = {
      id: newId,
      name: newItem.name,
      ...(activeTab === 'vehicles' && {
        type: newItem.type || 'Véhicule',
        category: newItem.type || 'Véhicule',
        color: newItem.color,
        displayColor: newItem.color,
        registration: newItem.immatriculation || '',
        brand: newItem.marque || '',
        model: '',
        owner: '',
        comment: '',
        photo: newItem.photo || '',
        order: currentList.length,
        isLocation: Boolean(newItem.isLocation),
      }),
      ...(activeTab === 'locations' && {
        address: newItem.address || '',
        lat: newItem.lat || null,
        lng: newItem.lng || null,
        placeId: newItem.placeId || '',
      }),
    };

    // Appeler l'API backend pour créer l'élément
    try {
      if (activeTab === 'vehicles') {
        const createdVehicle = await api.createVehicle(itemToAdd);
        const vehicleWithId = { ...itemToAdd, id: createdVehicle.id || itemToAdd.id };
        const newList = [...currentList, vehicleWithId];
        setVehicles(newList);
        saveToIndexedDB(STORES.vehicles, newList);
      } else if (activeTab === 'clients') {
        const createdClient = await api.createClient(itemToAdd);
        const clientWithId = { ...itemToAdd, id: createdClient.id || itemToAdd.id };
        const newList = [...currentList, clientWithId];
        setClients(newList);
        saveToIndexedDB(STORES.clients, newList);
      } else if (activeTab === 'drivers') {
        const createdDriver = await api.createDriver(itemToAdd);
        const driverWithId = { ...itemToAdd, id: createdDriver.id || itemToAdd.id };
        const newList = [...currentList, driverWithId];
        setDrivers(newList);
        saveToIndexedDB(STORES.drivers, newList);
      } else if (activeTab === 'locations') {
        const createdLocation = await api.createLocation(itemToAdd);
        const locationWithId = { ...itemToAdd, id: createdLocation.id || itemToAdd.id };
        const newList = [...currentList, locationWithId];
        setLocations(newList);
        saveToIndexedDB(STORES.locations, newList);
      }
    } catch (error) {
      console.error('❌ Erreur création:', error);
      toast.error(`Erreur lors de la création: ${error.message}`);
      return;
    }

    setNewItem({
      name: '',
      isLocation: false,
      type: '',
      color: STATUS_COLORS.info,
      immatriculation: '',
      marque: '',
      couleurVehicule: '',
      photo: '',
      address: '',
      lat: null,
      lng: null,
      placeId: '',
      locationType: 'Salle de spectacle',
    });
    setShowAddForm(false);
  };

  const handleEdit = (item) => {
    if (activeTab === 'locations') {
      setLocationToEdit(item);
      setShowLocationDialog(true);
    } else if (activeTab === 'clients') {
      setClientToEdit(item);
      setShowClientDialog(true);
    } else {
      setEditingItem({ ...item });
    }
  };

  const handleAddLocation = () => {
    setLocationToEdit(null);
    setShowLocationDialog(true);
  };

  const handleSaveLocation = async (locationData) => {
    try {
      // LocationDialog gère la persistance API; ici on synchronise uniquement l'état local
      const savedLocation = locationData;
      const isUpdate = locations.some((loc) => loc.id === savedLocation.id);
      const newList = isUpdate
        ? locations.map((loc) => (loc.id === savedLocation.id ? savedLocation : loc))
        : [...locations, savedLocation];
      setLocations(newList);
      saveToIndexedDB(STORES.locations, newList);
    } catch (error) {
      console.error('❌ Erreur sauvegarde lieu:', error);
      toast.error(`Erreur lors de la sauvegarde: ${error.message}`);
    }
  };

  const handleSaveClient = async (clientData) => {
    try {
      if (clientToEdit) {
        // Mise à jour
        await api.updateClient(clientToEdit.id, clientData);
        const newList = clients.map((cli) =>
          cli.id === clientToEdit.id ? { ...clientData, id: clientToEdit.id } : cli,
        );
        setClients(newList);
        saveToIndexedDB(STORES.clients, newList);
      } else {
        // Création
        const createdClient = await api.createClient(clientData);
        const newClient = { ...clientData, id: createdClient.id || Date.now() };
        const newList = [...clients, newClient];
        setClients(newList);
        saveToIndexedDB(STORES.clients, newList);
      }
      setShowClientDialog(false);
      setClientToEdit(null);
    } catch (error) {
      console.error('❌ Erreur sauvegarde client:', error);
      toast.error(`Erreur lors de la sauvegarde: ${error.message}`);
    }
  };

  const handleOpenMaintenance = (vehicle) => {
    setVehicleToMaintain(vehicle);
    setShowMaintenanceModal(true);
  };

  const handleSaveMaintenance = async (updatedVehicle) => {
    try {
      const response = await api.updateVehicle(updatedVehicle.id, updatedVehicle);
      const newList = vehicles.map((v) => (v.id === updatedVehicle.id ? response : v));
      setVehicles(newList);
      saveToIndexedDB(STORES.vehicles, newList);
      setShowMaintenanceModal(false);
      setVehicleToMaintain(null);
    } catch (error) {
      console.error('❌ Erreur sauvegarde maintenance:', error);
      toast.error(`Erreur lors de la sauvegarde: ${error.message}`);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem.name.trim()) return;

    const currentList = getCurrentList();
    const newList = currentList.map((item) => (item.id === editingItem.id ? editingItem : item));

    // Appeler l'API backend pour mettre à jour
    try {
      if (activeTab === 'vehicles') {
        await api.updateVehicle(editingItem.id, editingItem);
        setVehicles(newList);
        saveToIndexedDB(STORES.vehicles, newList);
      } else if (activeTab === 'clients') {
        await api.updateClient(editingItem.id, editingItem);
        setClients(newList);
        saveToIndexedDB(STORES.clients, newList);
      } else if (activeTab === 'drivers') {
        await api.updateDriver(editingItem.id, editingItem);
        setDrivers(newList);
        saveToIndexedDB(STORES.drivers, newList);
      } else if (activeTab === 'locations') {
        await api.updateLocation(editingItem.id, editingItem);
        setLocations(newList);
        saveToIndexedDB(STORES.locations, newList);
      }
    } catch (error) {
      console.error('❌ Erreur modification:', error);
      toast.error(`Erreur lors de la modification: ${error.message}`);
      return;
    }

    setEditingItem(null);
  };

  const handleDelete = (id) => {
    confirm({
      title: 'Supprimer cet élément',
      message: 'Êtes-vous sûr de vouloir supprimer cet élément ?',
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        const currentList = getCurrentList();
        const newList = currentList.filter((item) => item.id !== id);

        // Appeler l'API backend pour supprimer
        try {
          if (activeTab === 'vehicles') {
            await api.deleteVehicle(id);
            setVehicles(newList);
            saveToIndexedDB(STORES.vehicles, newList);
          } else if (activeTab === 'clients') {
            await api.deleteClient(id);
            setClients(newList);
            saveToIndexedDB(STORES.clients, newList);
          } else if (activeTab === 'drivers') {
            await api.deleteDriver(id);
            setDrivers(newList);
            saveToIndexedDB(STORES.drivers, newList);
          } else if (activeTab === 'locations') {
            await api.deleteLocation(id);
            setLocations(newList);
            saveToIndexedDB(STORES.locations, newList);
          }
        } catch (error) {
          console.error('❌ Erreur suppression:', error);
          toast.error(`Erreur lors de la suppression: ${error.message}`);
        }
      },
    });
  };

  const _handleMoveUp = async (index) => {
    if (index === 0) return;
    const currentList = [...getCurrentList()];
    [currentList[index - 1], currentList[index]] = [currentList[index], currentList[index - 1]];

    // Mettre à jour les ordre si c'est des véhicules
    if (activeTab === 'vehicles') {
      currentList.forEach((v, i) => (v.orderIndex = i));
      setVehicles(currentList);
      saveToIndexedDB(STORES.vehicles, currentList);
      // Persister les 2 véhicules échangés côté serveur
      try {
        await Promise.all([
          api.updateVehicle(currentList[index - 1].id, currentList[index - 1]),
          api.updateVehicle(currentList[index].id, currentList[index]),
        ]);
      } catch (error) {
        console.error('Erreur sauvegarde ordre:', error);
      }
    } else {
      if (activeTab === 'clients') {
        setClients(currentList);
      } else if (activeTab === 'drivers') {
        setDrivers(currentList);
      } else if (activeTab === 'locations') {
        setLocations(currentList);
      } else if (activeTab === 'garages') {
        setGarages(currentList);
      }
    }
  };

  const _handleMoveDown = async (index) => {
    const currentList = [...getCurrentList()];
    if (index === currentList.length - 1) return;
    [currentList[index], currentList[index + 1]] = [currentList[index + 1], currentList[index]];

    // Mettre à jour les ordre si c'est des véhicules
    if (activeTab === 'vehicles') {
      currentList.forEach((v, i) => (v.orderIndex = i));
      setVehicles(currentList);
      saveToIndexedDB(STORES.vehicles, currentList);
      // Persister les 2 véhicules échangés côté serveur
      try {
        await Promise.all([
          api.updateVehicle(currentList[index].id, currentList[index]),
          api.updateVehicle(currentList[index + 1].id, currentList[index + 1]),
        ]);
      } catch (error) {
        console.error('Erreur sauvegarde ordre:', error);
      }
    } else {
      if (activeTab === 'clients') {
        setClients(currentList);
      } else if (activeTab === 'drivers') {
        setDrivers(currentList);
      } else if (activeTab === 'locations') {
        setLocations(currentList);
      }
    }
  };

  const handleDragStart = (index, section) => {
    setDraggedIndex(index);
    setDraggedSection(section);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (dropIndex, dropSection) => {
    if (draggedIndex === null || draggedSection !== dropSection) return;

    if (activeTab === 'vehicles') {
      const allVehicles = [...vehicles];
      const sectionVehicles = allVehicles.filter((v) =>
        dropSection === 'company' ? !v.isLocation : v.isLocation,
      );

      if (draggedIndex === dropIndex) return;

      const [movedItem] = sectionVehicles.splice(draggedIndex, 1);
      sectionVehicles.splice(dropIndex, 0, movedItem);

      // Reconstruire la liste complète en conservant l'ordre des deux sections
      const otherVehicles = allVehicles.filter((v) =>
        dropSection === 'company' ? v.isLocation : !v.isLocation,
      );

      const newList =
        dropSection === 'company'
          ? [...sectionVehicles, ...otherVehicles]
          : [...otherVehicles, ...sectionVehicles];

      // Mettre à jour l'ordre de tous les véhicules
      newList.forEach((v, i) => (v.orderIndex = i));

      // Sauvegarder localement immédiatement pour une UI réactive
      setVehicles(newList);
      saveToIndexedDB(STORES.vehicles, newList);

      // Sauvegarder l'ordre sur le serveur uniquement pour la section modifiée
      try {
        // Ne mettre à jour que les véhicules de la section qui a été réorganisée
        const vehiclesToUpdate = newList.filter((v) =>
          dropSection === 'company' ? !v.isLocation : v.isLocation,
        );

        await Promise.all(
          vehiclesToUpdate.map((vehicle) => api.updateVehicle(vehicle.id, vehicle)),
        );
      } catch (error) {
        console.error("Erreur lors de la sauvegarde de l'ordre des véhicules:", error);
        toast.warning("Erreur lors de la sauvegarde de l'ordre. Veuillez réessayer.");
      }
    }

    setDraggedIndex(null);
    setDraggedSection(null);
  };

  // Fonction d'export des données
  const handleExportData = async () => {
    try {
      const stores = [
        'vehicles',
        'reservations',
        'clients',
        'drivers',
        'locations',
        'maintenances',
        'calendarConfig',
      ];
      const data = {};

      for (const storeName of stores) {
        data[storeName] = await loadFromIndexedDB(storeName, []);
      }

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setImportStatus('✅ Données exportées avec succès !');
      setTimeout(() => setImportStatus(''), 3000);
    } catch (err) {
      setImportStatus("❌ Erreur lors de l'export : " + err.message);
      setTimeout(() => setImportStatus(''), 5000);
    }
  };

  // Fonction d'import des données
  const handleImportData = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      setImportStatus(
        `⏳ Import de ${backupData.reservations?.length || 0} réservations en cours...`,
      );

      // Importer dans IndexedDB - ATTENDRE que TOUTES les sauvegardes soient terminées
      const savePromises = [];
      for (const [storeName, items] of Object.entries(backupData)) {
        savePromises.push(saveToIndexedDB(storeName, items));
      }
      await Promise.all(savePromises);

      // Mettre à jour les états locaux
      if (backupData.vehicles) setVehicles(backupData.vehicles);
      if (backupData.reservations) setReservations(backupData.reservations);
      if (backupData.clients) setClients(backupData.clients);
      if (backupData.drivers) setDrivers(backupData.drivers);
      if (backupData.locations) setLocations(backupData.locations);
      if (backupData.maintenances) setMaintenances(backupData.maintenances);
      if (backupData.calendarConfig) setCalendarConfig(backupData.calendarConfig);

      setImportStatus(
        `✅ ${backupData.reservations?.length || 0} réservations sauvegardées ! Rechargement...`,
      );

      // Attendre 500ms pour que l'utilisateur voie le message, puis recharger
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error('Erreur import:', err);
      setImportStatus("❌ Erreur lors de l'import : " + err.message);
      setTimeout(() => setImportStatus(''), 5000);
    }
  };

  const panelTitle =
    panelType === 'settings'
      ? 'Paramètres'
      : activeModule === 'personnel'
        ? 'Gestion Personnel'
        : 'Gestion Véhicules';

  // Si gestion personnel, déléguer entièrement à PersonnelPanel
  if (panelType === 'management' && activeModule === 'personnel') {
    return (
      <Modal open={true} onClose={onClose} size="xl" className="management-panel">
        <ModalHeader onClose={onClose}>{panelTitle}</ModalHeader>
        <ModalBody>
          <Suspense
            fallback={
              <div className="u-text-center" style={{ padding: '2rem' }}>
                Chargement…
              </div>
            }
          >
            <PersonnelPanel currentUser={currentUser} mode="management" />
          </Suspense>
        </ModalBody>
      </Modal>
    );
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      size={panelType === 'settings' ? 'lg' : 'xl'}
      className={`management-panel${panelType === 'settings' ? ' management-panel--modal' : ''}`}
    >
      <ModalHeader onClose={onClose}>{panelTitle}</ModalHeader>
      <ModalBody className={panelType === 'settings' ? 'settings-body' : 'panel-body'}>
        <div className="management-tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                variant="ghost"
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{ '--tab-color': tab.color }}
              >
                <div
                  className="tab-icon"
                  style={{ backgroundColor: activeTab === tab.id ? tab.color : 'transparent' }}
                >
                  <Icon size={20} style={{ color: activeTab === tab.id ? 'white' : tab.color }} />
                </div>
                <span className="tab-label">{tab.label}</span>
                {tab.id === 'users' && pendingAccessCount > 0 && (
                  <span className="tab-badge">{pendingAccessCount}</span>
                )}
              </Button>
            );
          })}
        </div>

        <div className="management-content">
          {/* Formulaire d'ajout */}
          {activeTab !== 'sync' &&
            activeTab !== 'account' &&
            activeTab !== 'users' &&
            activeTab !== 'google-config' &&
            activeTab !== 'mobile' &&
            activeTab !== 'requests' &&
            activeTab !== 'depot-map' && (
              <div className="add-section">
                <div className="add-section-header">
                  <h3>
                    Ajouter{' '}
                    {activeTab === 'vehicles'
                      ? 'un véhicule'
                      : activeTab === 'clients'
                        ? 'un client'
                        : activeTab === 'drivers'
                          ? 'un conducteur'
                          : 'un lieu'}
                  </h3>
                  <div className="u-flex-center u-gap-1">
                    {activeTab === 'locations' && (
                      <Button
                        variant="ghost"
                        onClick={() => setShowMapPanel(true)}
                        title="Voir sur la carte"
                      >
                        <Map size={20} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="toggle-add-form-btn"
                      onClick={() => {
                        if (activeTab === 'locations') {
                          handleAddLocation();
                        } else if (activeTab === 'clients') {
                          setClientToEdit(null);
                          setShowClientDialog(true);
                        } else {
                          setShowAddForm(!showAddForm);
                        }
                      }}
                      title={
                        activeTab === 'locations'
                          ? 'Ajouter un lieu'
                          : activeTab === 'clients'
                            ? 'Ajouter un client'
                            : showAddForm
                              ? 'Masquer le formulaire'
                              : 'Afficher le formulaire'
                      }
                    >
                      {activeTab === 'locations' || activeTab === 'clients' ? (
                        <Plus size={20} />
                      ) : showAddForm ? (
                        <ChevronUp size={20} />
                      ) : (
                        <ChevronDown size={20} />
                      )}
                    </Button>
                  </div>
                </div>
                {showAddForm && activeTab !== 'locations' && activeTab !== 'clients' && (
                  <div className="add-form">
                    <Input
                      type="text"
                      placeholder={`Nom du ${activeTab === 'vehicles' ? 'véhicule' : activeTab === 'clients' ? 'client' : activeTab === 'drivers' ? 'conducteur' : 'lieu'}`}
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                      id={activeTab === 'locations' ? 'location-autocomplete-input' : undefined}
                    />

                    {activeTab === 'locations' && (
                      <div className="location-details">
                        <small className="help-text">
                          Tapez une adresse et sélectionnez-la dans la liste pour obtenir les
                          coordonnées GPS
                        </small>
                        {newItem.address && (
                          <div className="location-info">
                            <div>📍 {newItem.address}</div>
                            {newItem.lat && newItem.lng && (
                              <div className="coordinates">
                                Coordonnées: {newItem.lat.toFixed(6)}, {newItem.lng.toFixed(6)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'vehicles' && (
                      <>
                        <div className="management-field">
                          <label>Usage</label>
                          <Select
                            value={newItem.isLocation ? 'location' : 'entreprise'}
                            onChange={(e) =>
                              setNewItem({
                                ...newItem,
                                isLocation: e.target.value === 'location',
                              })
                            }
                          >
                            <option value="entreprise">Entreprise</option>
                            <option value="location">Location</option>
                          </Select>
                        </div>
                        <div className="management-field">
                          <label>Catégorie</label>
                          <Input
                            type="text"
                            placeholder="VL 20m3, Porteur..."
                            value={newItem.type}
                            onChange={(e) =>
                              setNewItem({
                                ...newItem,
                                type: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="management-field">
                          <label>Immatriculation</label>
                          <Input
                            type="text"
                            placeholder="Immatriculation"
                            value={newItem.immatriculation}
                            onChange={(e) =>
                              setNewItem({ ...newItem, immatriculation: e.target.value })
                            }
                          />
                        </div>
                        <div className="management-field">
                          <label>Marque</label>
                          <Input
                            type="text"
                            placeholder="Marque"
                            value={newItem.marque}
                            onChange={(e) => setNewItem({ ...newItem, marque: e.target.value })}
                          />
                        </div>
                        <div className="management-field">
                          <label>Couleur véhicule</label>
                          <Input
                            type="text"
                            placeholder="Couleur véhicule"
                            value={newItem.couleurVehicule}
                            onChange={(e) =>
                              setNewItem({ ...newItem, couleurVehicule: e.target.value })
                            }
                          />
                        </div>
                        <div className="management-field">
                          <label>Photo</label>
                          <div className="photo-select-wrapper">
                            <Select
                              value={newItem.photo}
                              onChange={(e) => setNewItem({ ...newItem, photo: e.target.value })}
                            >
                              <option value="">Pas de photo</option>
                              {availablePhotos.map((photo) => (
                                <option key={photo} value={photo}>
                                  {photo}
                                </option>
                              ))}
                            </Select>
                            <Button
                              variant="ghost"
                              type="button"
                              className={`refresh-photos-btn ${isRefreshingPhotos ? 'refreshing' : ''}`}
                              onClick={refreshPhotoList}
                              title="Rafraîchir la liste des photos"
                            >
                              <RefreshCw size={16} />
                            </Button>
                          </div>
                        </div>
                        <div className="color-picker">
                          <label>Couleur d'affichage:</label>
                          <div className="color-options-grid">
                            {colors.map((color) => (
                              <Button
                                variant="ghost"
                                key={color}
                                className={`color-option ${newItem.color === color ? 'selected' : ''}`}
                                style={{ backgroundColor: color }}
                                onClick={() =>
                                  setNewItem({ ...newItem, color, displayColor: color })
                                }
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    <Button variant="ghost" className="add-button" onClick={handleAdd}>
                      <Plus size={20} />
                      Ajouter
                    </Button>
                  </div>
                )}
              </div>
            )}

          {/* Configuration Google Calendar */}
          {/* Import/Export (Admin uniquement) */}
          {activeTab === 'sync' && currentUser?.isAdmin && (
            <div className="sync-section">
              <h3>📦 Import / Export des données</h3>
              <div className="sync-info">
                <p>
                  Sauvegardez ou restaurez toutes vos données (véhicules, réservations, clients,
                  etc.)
                </p>
              </div>

              <div className="sync-form">
                <div className="import-export-buttons">
                  <Button variant="ghost" className="export-button" onClick={handleExportData}>
                    <Download size={20} />
                    Exporter toutes les données
                  </Button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    className="u-hidden"
                    onChange={handleImportData}
                  />
                  <Button
                    variant="ghost"
                    className="import-button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={20} />
                    Importer des données
                  </Button>
                </div>

                {importStatus && (
                  <div
                    className={`sync-status ${importStatus.includes('✅') ? 'success' : 'error'}`}
                  >
                    {importStatus}
                  </div>
                )}

                <div className="sync-tips">
                  <h4>ℹ️ Utilisation :</h4>
                  <ul>
                    <li>
                      <strong>Export :</strong> Télécharge un fichier JSON avec toutes vos données
                    </li>
                    <li>
                      <strong>Import :</strong> Remplace toutes les données actuelles par celles du
                      fichier
                    </li>
                    <li>
                      <strong>⚠️ Attention :</strong> L'import écrase complètement les données
                      existantes
                    </li>
                    <li>
                      Utile pour transférer vos données entre différents navigateurs ou appareils
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Mon compte */}
          {activeTab === 'account' && <ChangePassword currentUser={currentUser} />}

          {/* Gestion des utilisateurs (Admin uniquement) */}
          {activeTab === 'users' && currentUser?.isAdmin && (
            <UserManagement
              onAccessRequestChange={() => {
                api
                  .getPendingAccessRequestsCount()
                  .then((data) => setPendingAccessCount(data.count || 0))
                  .catch(() => {});
              }}
              onNavigateToPersonnel={(person) => {
                if (onNavigateToPersonnel) onNavigateToPersonnel(person);
              }}
            />
          )}

          {/* Configuration Google Calendar (Admin uniquement) */}
          {activeTab === 'google-config' && currentUser?.isAdmin && <GoogleCalendarConfig />}

          {/* Accès Mobile (Admin uniquement) */}
          {activeTab === 'mobile' && currentUser?.isAdmin && <MobileAccess />}

          {/* Plan du Dépôt (Admin uniquement) */}
          {activeTab === 'depot-map' && currentUser?.isAdmin && (
            <div className="depot-map-settings-wrapper" style={{ padding: '0 8px' }}>
              {/* Sélecteur de dépôt */}
              <div className="u-flex-center u-gap-2 u-mb-3">
                <Button
                  variant="ghost"
                  className="u-cursor-pointer"
                  onClick={() => setActiveDepot(1)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border:
                      activeDepot === 1
                        ? `2px solid ${STATUS_COLORS.success}`
                        : '1px solid #334155',
                    background: activeDepot === 1 ? 'rgba(16,185,129,0.15)' : 'rgba(30,41,59,0.5)',
                    color: activeDepot === 1 ? STATUS_COLORS.success : 'var(--theme-text-muted)',
                    fontWeight: activeDepot === 1 ? 600 : 400,
                    fontSize: '0.9rem',
                    transition: 'all 0.2s',
                  }}
                >
                  Dépôt 1 — Événementiel
                </Button>
                <Button
                  variant="ghost"
                  className="u-cursor-pointer"
                  onClick={() => setActiveDepot(2)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border:
                      activeDepot === 2 ? `2px solid ${STATUS_COLORS.info}` : '1px solid #334155',
                    background: activeDepot === 2 ? 'rgba(59,130,246,0.15)' : 'rgba(30,41,59,0.5)',
                    color: activeDepot === 2 ? STATUS_COLORS.info : 'var(--theme-text-muted)',
                    fontWeight: activeDepot === 2 ? 600 : 400,
                    fontSize: '0.9rem',
                    transition: 'all 0.2s',
                  }}
                >
                  Dépôt 2 — Structure
                </Button>
              </div>
              {depotZones ? (
                <DepotMap
                  zones={depotZones}
                  stats={locationStats}
                  selectedZone={null}
                  onZoneSelect={() => {}}
                  onZoneFilter={() => {}}
                />
              ) : (
                <div className="u-text-center u-text-muted" style={{ padding: 32 }}>
                  Chargement du plan...
                </div>
              )}
            </div>
          )}

          {/* Reporting Location (Admin uniquement) */}
          {activeTab === 'rental-reports' && currentUser?.isAdmin && <RentalReportingPanel />}

          {/* Demandes de réservation (Admin uniquement) */}
          {activeTab === 'requests' && currentUser?.isAdmin && (
            <ReservationRequestsPanel
              onRequestProcessed={() => {
                // Recharger les réservations si besoin
                if (setReservations) {
                  // Cette fonction sera appelée quand une demande est approuvée
                  // pour rafraîchir la liste des réservations
                }
              }}
            />
          )}

          {/* Liste des éléments */}
          {activeTab !== 'sync' &&
            activeTab !== 'account' &&
            activeTab !== 'users' &&
            activeTab !== 'google-config' &&
            activeTab !== 'mobile' &&
            activeTab !== 'requests' &&
            activeTab !== 'rental-reports' &&
            activeTab !== 'depot-map' && (
              <div className="items-section">
                {activeTab === 'vehicles' ? (
                  <>
                    {/* Véhicules entreprise */}
                    <div className="vehicles-subsection">
                      <h3>Véhicules entreprise ({vehicles.filter((v) => !v.isLocation).length})</h3>
                      <div className="items-list">
                        {vehicles
                          .filter((v) => !v.isLocation)
                          .map((item, index) => (
                            <div
                              key={item.id}
                              className={`item-card ${draggedSection === 'company' && draggedIndex === index ? 'dragging' : ''}`}
                              draggable={!editingItem}
                              onDragStart={() => handleDragStart(index, 'company')}
                              onDragOver={handleDragOver}
                              onDrop={() => handleDrop(index, 'company')}
                            >
                              {editingItem?.id === item.id ? (
                                <div className="edit-form">
                                  <div className="management-field management-field--compact">
                                    <label>Nom</label>
                                    <Input
                                      type="text"
                                      value={editingItem.name}
                                      onChange={(e) =>
                                        setEditingItem({ ...editingItem, name: e.target.value })
                                      }
                                      onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                                      placeholder="Nom"
                                    />
                                  </div>
                                  {activeTab === 'vehicles' && (
                                    <>
                                      <div className="management-field management-field--compact">
                                        <label>Catégorie</label>
                                        <Input
                                          type="text"
                                          value={editingItem.type || editingItem.category || ''}
                                          onChange={(e) =>
                                            setEditingItem({
                                              ...editingItem,
                                              type: e.target.value,
                                              category: e.target.value,
                                            })
                                          }
                                          placeholder="Catégorie"
                                        />
                                      </div>
                                      <div className="management-field management-field--compact">
                                        <label>Usage</label>
                                        <Select
                                          value={editingItem.isLocation ? 'location' : 'entreprise'}
                                          onChange={(e) =>
                                            setEditingItem({
                                              ...editingItem,
                                              isLocation: e.target.value === 'location',
                                            })
                                          }
                                        >
                                          <option value="entreprise">Entreprise</option>
                                          <option value="location">Location</option>
                                        </Select>
                                      </div>
                                      <div className="management-field management-field--compact">
                                        <label>Immatriculation</label>
                                        <Input
                                          type="text"
                                          value={
                                            editingItem.immatriculation ||
                                            editingItem.registration ||
                                            ''
                                          }
                                          onChange={(e) =>
                                            setEditingItem({
                                              ...editingItem,
                                              immatriculation: e.target.value,
                                              registration: e.target.value,
                                            })
                                          }
                                          placeholder="Immatriculation"
                                        />
                                      </div>
                                      <div className="management-field management-field--compact">
                                        <label>Marque</label>
                                        <Input
                                          type="text"
                                          value={editingItem.marque || editingItem.brand || ''}
                                          onChange={(e) =>
                                            setEditingItem({
                                              ...editingItem,
                                              marque: e.target.value,
                                              brand: e.target.value,
                                            })
                                          }
                                          placeholder="Marque"
                                        />
                                      </div>
                                      <div className="management-field management-field--compact">
                                        <label>Couleur véhicule</label>
                                        <Input
                                          type="text"
                                          value={
                                            editingItem.couleurVehicule || editingItem.color || ''
                                          }
                                          onChange={(e) =>
                                            setEditingItem({
                                              ...editingItem,
                                              couleurVehicule: e.target.value,
                                              color: e.target.value,
                                            })
                                          }
                                          placeholder="Couleur véhicule"
                                        />
                                      </div>
                                      <div className="management-field management-field--compact">
                                        <label>Photo</label>
                                        <div className="photo-select-wrapper">
                                          <Select
                                            value={editingItem.photo || ''}
                                            onChange={(e) =>
                                              setEditingItem({
                                                ...editingItem,
                                                photo: e.target.value,
                                              })
                                            }
                                          >
                                            <option value="">Pas de photo</option>
                                            {availablePhotos.map((photo) => (
                                              <option key={photo} value={photo}>
                                                {photo}
                                              </option>
                                            ))}
                                          </Select>
                                          <Button
                                            variant="ghost"
                                            type="button"
                                            className={`refresh-photos-btn ${isRefreshingPhotos ? 'refreshing' : ''}`}
                                            onClick={refreshPhotoList}
                                            title="Rafraîchir la liste des photos"
                                          >
                                            <RefreshCw size={16} />
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="color-picker-inline">
                                        <label>Couleur d'affichage:</label>
                                        <div className="color-options-grid">
                                          {colors.map((color) => (
                                            <Button
                                              variant="ghost"
                                              key={color}
                                              className={`color-option ${(editingItem.displayColor || editingItem.color) === color ? 'selected' : ''}`}
                                              style={{ backgroundColor: color }}
                                              onClick={() =>
                                                setEditingItem({
                                                  ...editingItem,
                                                  color,
                                                  displayColor: color,
                                                })
                                              }
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                  <div className="edit-actions">
                                    <Button variant="primary" onClick={handleSaveEdit}>
                                      Enregistrer
                                    </Button>
                                    <Button variant="ghost" onClick={() => setEditingItem(null)}>
                                      Annuler
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="item-info">
                                    {activeTab === 'vehicles' && (
                                      <div
                                        className="item-color"
                                        style={{
                                          backgroundColor:
                                            item.displayColor || item.color || STATUS_COLORS.info,
                                        }}
                                      />
                                    )}
                                    {activeTab === 'vehicles' && (
                                      <div className="item-photo">
                                        {item.photo ? (
                                          <img
                                            src={`/Photos/${item.photo}`}
                                            alt={item.name}
                                            loading="lazy"
                                          />
                                        ) : (
                                          <img
                                            src={getVehicleAvatar(item.type)}
                                            alt={item.name}
                                            className="vehicle-avatar"
                                            loading="lazy"
                                          />
                                        )}
                                        {hasExpiredTechnicalControl(item, maintenances) && (
                                          <div
                                            className="expired-control-badge"
                                            title={`Contrôle technique expiré: ${getExpiredTechnicalControls(
                                              item,
                                              maintenances,
                                            )
                                              .map((c) => `${c.type} (${c.daysExpired}j)`)
                                              .join(', ')}`}
                                          >
                                            🚫
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    <div>
                                      <div className="item-name">{item.name}</div>
                                      {activeTab === 'vehicles' && (
                                        <>
                                          <div className="item-type">{item.type}</div>
                                          <div className="item-registration">
                                            📋 {item.immatriculation || item.registration || ''}
                                          </div>
                                          <div className="item-brand">
                                            🚗 {item.marque || item.brand || ''}{' '}
                                            {item.couleurVehicule || item.model || ''}
                                          </div>
                                        </>
                                      )}
                                      {activeTab === 'clients' && (
                                        <>
                                          {item.email && (
                                            <div className="item-detail">@ {item.email}</div>
                                          )}
                                          {item.phone && (
                                            <div className="item-detail">
                                              📞 {formatPhoneDisplay(item.phone)}
                                            </div>
                                          )}
                                          {item.address && (
                                            <div className="item-detail">📍 {item.address}</div>
                                          )}
                                          {item.lat && item.lng && (
                                            <div className="item-detail coordinates-detail">
                                              🗺️ {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                                              <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="map-link"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                Voir sur Google Maps
                                              </a>
                                            </div>
                                          )}
                                        </>
                                      )}
                                      {activeTab === 'locations' && (
                                        <>
                                          {item.address && (
                                            <div className="item-detail">📍 {item.address}</div>
                                          )}
                                          {item.lat && item.lng && (
                                            <div className="item-detail coordinates-detail">
                                              🗺️ {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                                              <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="map-link"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                Voir sur Google Maps
                                              </a>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="item-actions">
                                    <div className="drag-handle" title="Glisser pour réorganiser">
                                      <GripVertical size={20} />
                                    </div>
                                    <Button
                                      variant="ghost"
                                      className="maintenance-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenMaintenance(item);
                                      }}
                                      title="Maintenance et contrôle technique"
                                    >
                                      <Gauge size={16} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="edit-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(item);
                                      }}
                                    >
                                      <Edit2 size={16} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="delete-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(item.id);
                                      }}
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}

                        {vehicles.filter((v) => !v.isLocation).length === 0 && (
                          <div className="empty-state">
                            <p>Aucun véhicule entreprise</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Véhicules de location */}
                    <div className="vehicles-subsection">
                      <h3>Véhicules de location ({vehicles.filter((v) => v.isLocation).length})</h3>
                      <div className="items-list">
                        {vehicles
                          .filter((v) => v.isLocation)
                          .map((item, index) => (
                            <div
                              key={item.id}
                              className={`item-card ${draggedSection === 'location' && draggedIndex === index ? 'dragging' : ''}`}
                              draggable={!editingItem}
                              onDragStart={() => handleDragStart(index, 'location')}
                              onDragOver={handleDragOver}
                              onDrop={() => handleDrop(index, 'location')}
                            >
                              {editingItem?.id === item.id ? (
                                <div className="edit-form">
                                  {/* Contenu d'édition identique */}
                                  <div className="management-field management-field--compact">
                                    <label>Nom</label>
                                    <Input
                                      type="text"
                                      value={editingItem.name}
                                      onChange={(e) =>
                                        setEditingItem({ ...editingItem, name: e.target.value })
                                      }
                                      onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                                      placeholder="Nom"
                                    />
                                  </div>
                                  <div className="management-field management-field--compact">
                                    <label>Catégorie</label>
                                    <Input
                                      type="text"
                                      value={editingItem.type || editingItem.category || ''}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          type: e.target.value,
                                          category: e.target.value,
                                        })
                                      }
                                      placeholder="Catégorie"
                                    />
                                  </div>
                                  <div className="management-field management-field--compact">
                                    <label>Usage</label>
                                    <Select
                                      value={editingItem.isLocation ? 'location' : 'entreprise'}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          isLocation: e.target.value === 'location',
                                        })
                                      }
                                    >
                                      <option value="entreprise">Entreprise</option>
                                      <option value="location">Location</option>
                                    </Select>
                                  </div>
                                  <div className="management-field management-field--compact">
                                    <label>Immatriculation</label>
                                    <Input
                                      type="text"
                                      value={
                                        editingItem.immatriculation ||
                                        editingItem.registration ||
                                        ''
                                      }
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          immatriculation: e.target.value,
                                          registration: e.target.value,
                                        })
                                      }
                                      placeholder="Immatriculation"
                                    />
                                  </div>
                                  <div className="management-field management-field--compact">
                                    <label>Marque</label>
                                    <Input
                                      type="text"
                                      value={editingItem.marque || editingItem.brand || ''}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          marque: e.target.value,
                                          brand: e.target.value,
                                        })
                                      }
                                      placeholder="Marque"
                                    />
                                  </div>
                                  <div className="management-field management-field--compact">
                                    <label>Couleur véhicule</label>
                                    <Input
                                      type="text"
                                      value={editingItem.couleurVehicule || editingItem.color || ''}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          couleurVehicule: e.target.value,
                                          color: e.target.value,
                                        })
                                      }
                                      placeholder="Couleur véhicule"
                                    />
                                  </div>
                                  <div className="management-field management-field--compact">
                                    <label>Photo</label>
                                    <div className="photo-select-wrapper">
                                      <Select
                                        value={editingItem.photo || ''}
                                        onChange={(e) =>
                                          setEditingItem({ ...editingItem, photo: e.target.value })
                                        }
                                      >
                                        <option value="">Pas de photo</option>
                                        {availablePhotos.map((photo) => (
                                          <option key={photo} value={photo}>
                                            {photo}
                                          </option>
                                        ))}
                                      </Select>
                                      <Button
                                        variant="ghost"
                                        type="button"
                                        className={`refresh-photos-btn ${isRefreshingPhotos ? 'refreshing' : ''}`}
                                        onClick={refreshPhotoList}
                                        title="Rafraîchir la liste des photos"
                                      >
                                        <RefreshCw size={16} />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="color-picker-inline">
                                    <label>Couleur d'affichage:</label>
                                    <div className="color-options-grid">
                                      {colors.map((color) => (
                                        <Button
                                          variant="ghost"
                                          key={color}
                                          className={`color-option ${(editingItem.displayColor || editingItem.color) === color ? 'selected' : ''}`}
                                          style={{ backgroundColor: color }}
                                          onClick={() =>
                                            setEditingItem({
                                              ...editingItem,
                                              color,
                                              displayColor: color,
                                            })
                                          }
                                        />
                                      ))}
                                    </div>
                                  </div>
                                  <div className="rental-rates-edit">
                                    <label>Tarifs de location :</label>
                                    <div className="rental-rates-grid">
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="Tarif jour (€)"
                                        value={editingItem.dailyRate || ''}
                                        onChange={(e) =>
                                          setEditingItem({
                                            ...editingItem,
                                            dailyRate: parseFloat(e.target.value) || 0,
                                          })
                                        }
                                      />
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="Tarif semaine (€)"
                                        value={editingItem.weeklyRate || ''}
                                        onChange={(e) =>
                                          setEditingItem({
                                            ...editingItem,
                                            weeklyRate: parseFloat(e.target.value) || 0,
                                          })
                                        }
                                      />
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="Tarif mois (€)"
                                        value={editingItem.monthlyRate || ''}
                                        onChange={(e) =>
                                          setEditingItem({
                                            ...editingItem,
                                            monthlyRate: parseFloat(e.target.value) || 0,
                                          })
                                        }
                                      />
                                    </div>
                                  </div>
                                  <div className="edit-actions">
                                    <Button variant="primary" onClick={handleSaveEdit}>
                                      Enregistrer
                                    </Button>
                                    <Button variant="ghost" onClick={() => setEditingItem(null)}>
                                      Annuler
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="item-info">
                                    <div
                                      className="item-color"
                                      style={{
                                        backgroundColor:
                                          item.displayColor || item.color || STATUS_COLORS.info,
                                      }}
                                    />
                                    <div className="item-photo">
                                      {item.photo ? (
                                        <img
                                          src={`/Photos/${item.photo}`}
                                          alt={item.name}
                                          loading="lazy"
                                        />
                                      ) : (
                                        <img
                                          src={getVehicleAvatar(item.type)}
                                          alt={item.name}
                                          className="vehicle-avatar"
                                          loading="lazy"
                                        />
                                      )}
                                    </div>
                                    <div>
                                      <div className="item-name">{item.name}</div>
                                      <div className="item-type">{item.type}</div>
                                      <div className="item-registration">
                                        📋 {item.immatriculation || item.registration || ''}
                                      </div>
                                      <div className="item-brand">
                                        🚗 {item.marque || item.brand || ''}{' '}
                                        {item.couleurVehicule || item.model || ''}
                                      </div>
                                      {(item.dailyRate > 0 ||
                                        item.weeklyRate > 0 ||
                                        item.monthlyRate > 0) && (
                                        <div className="item-rates">
                                          💰{' '}
                                          {[
                                            item.dailyRate > 0 && `${item.dailyRate}€/j`,
                                            item.weeklyRate > 0 && `${item.weeklyRate}€/sem`,
                                            item.monthlyRate > 0 && `${item.monthlyRate}€/mois`,
                                          ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="item-actions">
                                    <div className="drag-handle" title="Glisser pour réorganiser">
                                      <GripVertical size={20} />
                                    </div>
                                    <Button
                                      variant="ghost"
                                      className="maintenance-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenMaintenance(item);
                                      }}
                                      title="Maintenance et contrôle technique"
                                    >
                                      <Gauge size={16} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="edit-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(item);
                                      }}
                                    >
                                      <Edit2 size={16} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="delete-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(item.id);
                                      }}
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}

                        {vehicles.filter((v) => v.isLocation).length === 0 && (
                          <div className="empty-state">
                            <p>Aucun véhicule de location</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>Liste ({getCurrentList().length})</h3>
                    <div className="items-list">
                      {activeTab === 'locations'
                        ? // Grouper les lieux par type
                          (() => {
                            const allLocations = getCurrentList();
                            const locationTypes = [
                              'Salle de spectacle',
                              'Prestataire',
                              'Dépôt',
                              'Garage',
                              'Autre',
                            ];
                            const groupedLocations = {};
                            locationTypes.forEach((type) => {
                              groupedLocations[type] = allLocations.filter(
                                (loc) => loc.type === type,
                              );
                            });
                            // Ajouter les lieux sans type ou avec type inconnu dans "Autre"
                            const untyped = allLocations.filter(
                              (loc) => !loc.type || !locationTypes.includes(loc.type),
                            );
                            if (untyped.length > 0) {
                              groupedLocations['Autre'] = [
                                ...(groupedLocations['Autre'] || []),
                                ...untyped,
                              ];
                            }

                            return locationTypes.map((type) => {
                              const typeLocations = groupedLocations[type] || [];
                              if (typeLocations.length === 0) return null;

                              return (
                                <div key={type} className="locations-group">
                                  <h4 className="group-title">
                                    {type} ({typeLocations.length})
                                  </h4>
                                  {typeLocations.map((item, _index) => (
                                    <div key={item.id} className="item-card">
                                      {editingItem?.id === item.id ? (
                                        <div className="edit-form">
                                          <Input
                                            type="text"
                                            value={editingItem.name}
                                            onChange={(e) =>
                                              setEditingItem({
                                                ...editingItem,
                                                name: e.target.value,
                                              })
                                            }
                                            onKeyPress={(e) =>
                                              e.key === 'Enter' && handleSaveEdit()
                                            }
                                            placeholder="Nom"
                                          />
                                          <div className="edit-actions">
                                            <Button variant="primary" onClick={handleSaveEdit}>
                                              Enregistrer
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              onClick={() => setEditingItem(null)}
                                            >
                                              Annuler
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="item-content">
                                            <div>
                                              <div className="item-name">
                                                {item.name}
                                                {item.isCompanyLocation && (
                                                  <span
                                                    className="u-font-xs u-font-semibold u-rounded-sm"
                                                    style={{
                                                      marginLeft: '8px',
                                                      padding: '2px 8px',
                                                      background: 'var(--theme-gradient)',
                                                      color: 'var(--theme-text-inverse)',
                                                    }}
                                                  >
                                                    Lieu principal
                                                  </span>
                                                )}
                                              </div>
                                              {item.type && (
                                                <div className="item-detail">🏢 {item.type}</div>
                                              )}
                                              {item.address && (
                                                <div className="item-detail">📍 {item.address}</div>
                                              )}
                                            </div>
                                          </div>
                                          <div className="item-actions">
                                            <Button
                                              variant="ghost"
                                              className="edit-button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(item);
                                              }}
                                            >
                                              <Edit2 size={16} />
                                            </Button>
                                            {!item.isCompanyLocation && (
                                              <Button
                                                variant="ghost"
                                                className="delete-button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDelete(item.id);
                                                }}
                                              >
                                                <Trash2 size={16} />
                                              </Button>
                                            )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            });
                          })()
                        : // Affichage normal pour les autres onglets
                          getCurrentList().map((item, _index) => (
                            <div key={item.id} className="item-card">
                              {editingItem?.id === item.id ? (
                                <div className="edit-form">
                                  <Input
                                    type="text"
                                    value={editingItem.name}
                                    onChange={(e) =>
                                      setEditingItem({ ...editingItem, name: e.target.value })
                                    }
                                    onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                                    placeholder="Nom"
                                  />
                                  <div className="edit-actions">
                                    <Button variant="primary" onClick={handleSaveEdit}>
                                      Enregistrer
                                    </Button>
                                    <Button variant="ghost" onClick={() => setEditingItem(null)}>
                                      Annuler
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="item-content">
                                    <div>
                                      <div className="item-name">{item.name}</div>
                                      {activeTab === 'locations' && (
                                        <>
                                          {item.type && (
                                            <div className="item-detail">🏢 {item.type}</div>
                                          )}
                                          {item.address && (
                                            <div className="item-detail">📍 {item.address}</div>
                                          )}
                                          {item.lat && item.lng && (
                                            <div className="item-detail coordinates-detail">
                                              🗺️ {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                                              <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="map-link"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                Voir sur Google Maps
                                              </a>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="item-actions">
                                    <Button
                                      variant="ghost"
                                      className="edit-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(item);
                                      }}
                                    >
                                      <Edit2 size={16} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="delete-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(item.id);
                                      }}
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}

                      {getCurrentList().length === 0 && activeTab !== 'locations' && (
                        <div className="empty-state">
                          <p>Aucun élément pour le moment</p>
                          <p className="empty-hint">
                            Utilisez le formulaire ci-dessus pour en ajouter
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
        </div>
      </ModalBody>

      {/* Dialog pour les lieux */}
      {showLocationDialog && (
        <LocationDialog
          location={locationToEdit}
          onSave={handleSaveLocation}
          onClose={() => {
            setShowLocationDialog(false);
            setLocationToEdit(null);
          }}
          companyAddress={companyAddress}
        />
      )}

      {/* Dialog pour les clients */}
      {showClientDialog && (
        <ClientDialog
          client={clientToEdit}
          onSave={handleSaveClient}
          onClose={() => {
            setShowClientDialog(false);
            setClientToEdit(null);
          }}
          companyAddress={companyAddress}
        />
      )}

      {/* Modal de maintenance des véhicules */}
      {showMaintenanceModal && vehicleToMaintain && (
        <VehicleMaintenanceModal
          key={`${vehicleToMaintain.id}-${vehicleToMaintain.controlesTechniques || 'empty'}`}
          vehicle={vehicleToMaintain}
          onSave={handleSaveMaintenance}
          onClose={() => {
            setShowMaintenanceModal(false);
            setVehicleToMaintain(null);
          }}
        />
      )}

      {/* Panneau cartographie des lieux */}
      {showMapPanel && (
        <LocationsMapPanel
          locations={getCurrentList()}
          onClose={() => setShowMapPanel(false)}
          onEditLocation={(loc) => {
            setShowMapPanel(false);
            setLocationToEdit(loc);
            setShowLocationDialog(true);
          }}
        />
      )}

      {ConfirmDialogRenderer}
    </Modal>
  );
};

export default React.memo(ManagementPanel);
