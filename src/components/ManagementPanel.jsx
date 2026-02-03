import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Edit2, Trash2, Truck, Users, MapPin, Calendar, ChevronUp, ChevronDown, RefreshCw, GripVertical, Upload, Download, Shield, Lock, Settings, Smartphone, UserCircle2, Wrench, Map, Cloud, Building2 } from 'lucide-react';
import { saveToIndexedDB, STORES, loadFromIndexedDB } from '../utils/indexedDB';
import { getAvailablePhotos, getPhotosSync } from '../utils/photoList';
import UserManagement from './UserManagement';
import GoogleCalendarConfig from './GoogleCalendarConfig';
import ChangePassword from './ChangePassword';
import MobileAccess from './MobileAccess';
import LocationDialog from './LocationDialog';
import api from '../utils/api';
import './ManagementPanel.css';

const ManagementPanel = ({
  vehicles,
  setVehicles,
  reservations,
  setReservations,
  clients,
  setClients,
  drivers,
  setDrivers,
  locations,
  setLocations,
  calendarConfig,
  setCalendarConfig,
  garages,
  setGarages,
  maintenances,
  setMaintenances,
  currentUser,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState('vehicles');
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({ 
    name: '', 
    type: '', 
    color: '#3b82f6',
    immatriculation: '',
    marque: '',
    couleurVehicule: '',
    photo: '',
    address: '',
    lat: null,
    lng: null,
    placeId: ''
  });
  const [availablePhotos, setAvailablePhotos] = useState(getPhotosSync());
  const [isRefreshingPhotos, setIsRefreshingPhotos] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedSection, setDraggedSection] = useState(null);
  const [importStatus, setImportStatus] = useState('');
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [locationToEdit, setLocationToEdit] = useState(null);
  const [companyAddress, setCompanyAddress] = useState('');
  const autocompleteRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Charger l'adresse de MagScène depuis la config
  useEffect(() => {
    const loadCompanyAddress = async () => {
      try {
        const config = await loadFromIndexedDB('calendarConfig', {});
        setCompanyAddress(config.companyAddress || '');
      } catch (error) {
        console.error('Erreur chargement adresse entreprise:', error);
      }
    };
    loadCompanyAddress();
  }, []);

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

  // Initialiser Google Maps Autocomplete pour les lieux
  useEffect(() => {
    if (activeTab !== 'locations') return;

    // Charger le script Google Maps si pas déjà chargé
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places&language=fr`;
      script.async = true;
      script.defer = true;
      script.onload = initAutocomplete;
      document.head.appendChild(script);
    } else {
      initAutocomplete();
    }

    function initAutocomplete() {
      const input = document.getElementById('location-autocomplete-input');
      if (!input || !window.google) return;

      autocompleteRef.current = new window.google.maps.places.Autocomplete(input, {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: 'fr' },
        fields: ['place_id', 'geometry', 'name', 'formatted_address']
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        
        if (place.geometry && place.geometry.location) {
          setNewItem(prev => ({
            ...prev,
            name: place.name || prev.name,
            address: place.formatted_address || '',
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            placeId: place.place_id || ''
          }));
        }
      });
    }

    return () => {
      if (autocompleteRef.current && window.google) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [activeTab]);

  const tabs = [
    { id: 'vehicles', label: 'Véhicules', icon: Truck, color: '#3b82f6' },
    { id: 'clients', label: 'Clients', icon: UserCircle2, color: '#8b5cf6' },
    { id: 'drivers', label: 'Conducteurs', icon: Users, color: '#06b6d4' },
    { id: 'locations', label: 'Lieux', icon: Map, color: '#10b981' },
    { id: 'garages', label: 'Garages', icon: Building2, color: '#f59e0b' },
    { id: 'sync', label: 'Synchronisation', icon: Cloud, color: '#ec4899' },
    { id: 'account', label: 'Mon compte', icon: Lock, color: '#6b7280' },
    ...(currentUser?.isAdmin ? [
      { id: 'users', label: 'Utilisateurs', icon: Shield, color: '#ef4444' },
      { id: 'google-config', label: 'Config Google', icon: Settings, color: '#14b8a6' },
      { id: 'mobile', label: 'Accès Mobile', icon: Smartphone, color: '#a855f7' },
    ] : []),
  ];

  const getCurrentList = () => {
    switch (activeTab) {
      case 'vehicles': return vehicles;
      case 'clients': return clients;
      case 'drivers': return drivers;
      case 'locations': return locations;
      case 'garages': return garages;
      default: return [];
    }
  };

  const setCurrentList = (newList) => {
    switch (activeTab) {
      case 'vehicles': setVehicles(newList); break;
      case 'clients': setClients(newList); break;
      case 'drivers': setDrivers(newList); break;
      case 'locations': setLocations(newList); break;
      case 'garages': setGarages(newList); break;
    }
  };

  const generateUUID = () => {
    // Fonction compatible avec tous les navigateurs
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
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
        .map(item => typeof item.id === 'number' ? item.id : 0)
        .filter(id => id > 0);
      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      newId = maxId + 1;
    }
    
    const itemToAdd = {
      id: newId,
      name: newItem.name,
      ...(activeTab === 'vehicles' && { 
        type: newItem.type || 'Véhicule',
        color: newItem.color,
        displayColor: newItem.color,
        registration: newItem.immatriculation || '',
        brand: newItem.marque || '',
        model: '',
        owner: '',
        comment: '',
        photo: newItem.photo || '',
        order: currentList.length,
        isLocation: false
      }),
      ...(activeTab === 'locations' && {
        address: newItem.address || '',
        lat: newItem.lat || null,
        lng: newItem.lng || null,
        placeId: newItem.placeId || ''
      })
    };

    // Appeler l'API backend pour créer l'élément
    try {
      console.log('🔄 Création élément:', activeTab, itemToAdd);
      
      if (activeTab === 'vehicles') {
        const createdVehicle = await api.createVehicle(itemToAdd);
        console.log('✅ Véhicule créé:', createdVehicle);
        const vehicleWithId = { ...itemToAdd, id: createdVehicle.id || itemToAdd.id };
        const newList = [...currentList, vehicleWithId];
        setVehicles(newList);
        saveToIndexedDB(STORES.vehicles, newList);
      } else if (activeTab === 'clients') {
        const createdClient = await api.createClient(itemToAdd);
        console.log('✅ Client créé:', createdClient);
        const clientWithId = { ...itemToAdd, id: createdClient.id || itemToAdd.id };
        const newList = [...currentList, clientWithId];
        setClients(newList);
        saveToIndexedDB(STORES.clients, newList);
      } else if (activeTab === 'drivers') {
        const createdDriver = await api.createDriver(itemToAdd);
        console.log('✅ Conducteur créé:', createdDriver);
        const driverWithId = { ...itemToAdd, id: createdDriver.id || itemToAdd.id };
        const newList = [...currentList, driverWithId];
        setDrivers(newList);
        saveToIndexedDB(STORES.drivers, newList);
      } else if (activeTab === 'locations') {
        const createdLocation = await api.createLocation(itemToAdd);
        console.log('✅ Lieu créé:', createdLocation);
        const locationWithId = { ...itemToAdd, id: createdLocation.id || itemToAdd.id };
        const newList = [...currentList, locationWithId];
        setLocations(newList);
        saveToIndexedDB(STORES.locations, newList);
      } else if (activeTab === 'garages') {
        const createdGarage = await api.createGarage(itemToAdd);
        console.log('✅ Garage créé:', createdGarage);
        const garageWithId = { ...itemToAdd, id: createdGarage.id || itemToAdd.id };
        const newList = [...currentList, garageWithId];
        setGarages(newList);
        saveToIndexedDB(STORES.garages, newList);
      }
    } catch (error) {
      console.error('❌ Erreur création:', error);
      alert(`Erreur lors de la création: ${error.message}`);
      return;
    }
    
    setNewItem({ 
      name: '', 
      type: '', 
      color: '#3b82f6',
      immatriculation: '',
      marque: '',
      couleurVehicule: '',
      photo: '',
      address: '',
      lat: null,
      lng: null,
      placeId: ''
    });
    setShowAddForm(false);
  };

  const handleEdit = (item) => {
    if (activeTab === 'locations') {
      setLocationToEdit(item);
      setShowLocationDialog(true);
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
      if (locationToEdit) {
        // Mise à jour
        await api.updateLocation(locationToEdit.id, locationData);
        const newList = locations.map(loc => 
          loc.id === locationToEdit.id ? { ...locationData, id: locationToEdit.id } : loc
        );
        setLocations(newList);
        saveToIndexedDB(STORES.locations, newList);
      } else {
        // Création
        const createdLocation = await api.createLocation(locationData);
        const newLocation = { ...locationData, id: createdLocation.id || Date.now() };
        const newList = [...locations, newLocation];
        setLocations(newList);
        saveToIndexedDB(STORES.locations, newList);
      }
      setShowLocationDialog(false);
      setLocationToEdit(null);
    } catch (error) {
      console.error('❌ Erreur sauvegarde lieu:', error);
      alert(`Erreur lors de la sauvegarde: ${error.message}`);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem.name.trim()) return;

    const currentList = getCurrentList();
    const newList = currentList.map(item => item.id === editingItem.id ? editingItem : item);
    
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
      } else if (activeTab === 'garages') {
        await api.updateGarage(editingItem.id, editingItem);
        setGarages(newList);
        saveToIndexedDB(STORES.garages, newList);
      }
    } catch (error) {
      console.error('❌ Erreur modification:', error);
      alert(`Erreur lors de la modification: ${error.message}`);
      return;
    }
    
    setEditingItem(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) {
      const currentList = getCurrentList();
      const newList = currentList.filter(item => item.id !== id);
      
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
        } else if (activeTab === 'garages') {
          await api.deleteGarage(id);
          setGarages(newList);
          saveToIndexedDB(STORES.garages, newList);
        }
      } catch (error) {
        console.error('❌ Erreur suppression:', error);
        alert(`Erreur lors de la suppression: ${error.message}`);
      }
    }
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const currentList = [...getCurrentList()];
    [currentList[index - 1], currentList[index]] = [currentList[index], currentList[index - 1]];
    
    // Mettre à jour les ordre si c'est des véhicules
    if (activeTab === 'vehicles') {
      currentList.forEach((v, i) => v.order = i);
      setVehicles(currentList);
      saveToIndexedDB(STORES.vehicles, currentList);
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

  const handleMoveDown = (index) => {
    const currentList = [...getCurrentList()];
    if (index === currentList.length - 1) return;
    [currentList[index], currentList[index + 1]] = [currentList[index + 1], currentList[index]];
    
    // Mettre à jour les ordre si c'est des véhicules
    if (activeTab === 'vehicles') {
      currentList.forEach((v, i) => v.order = i);
      setVehicles(currentList);
      saveToIndexedDB(STORES.vehicles, currentList);
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

  const handleDragStart = (index, section) => {
    setDraggedIndex(index);
    setDraggedSection(section);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (dropIndex, dropSection) => {
    if (draggedIndex === null || draggedSection !== dropSection) return;
    
    if (activeTab === 'vehicles') {
      const allVehicles = [...vehicles];
      const sectionVehicles = allVehicles.filter(v => 
        dropSection === 'magscene' ? !v.isLocation : v.isLocation
      );
      
      if (draggedIndex === dropIndex) return;
      
      const [movedItem] = sectionVehicles.splice(draggedIndex, 1);
      sectionVehicles.splice(dropIndex, 0, movedItem);
      
      // Reconstruire la liste complète en conservant l'ordre des deux sections
      const otherVehicles = allVehicles.filter(v => 
        dropSection === 'magscene' ? v.isLocation : !v.isLocation
      );
      
      const newList = dropSection === 'magscene' 
        ? [...sectionVehicles, ...otherVehicles]
        : [...otherVehicles, ...sectionVehicles];
      
      newList.forEach((v, i) => v.order = i);
      setVehicles(newList);
      saveToIndexedDB(STORES.vehicles, newList);
    }
    
    setDraggedIndex(null);
    setDraggedSection(null);
  };

  // Fonction d'export des données
  const handleExportData = async () => {
    try {
      const stores = ['vehicles', 'reservations', 'clients', 'drivers', 'locations', 'garages', 'maintenances', 'calendarConfig'];
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
      setImportStatus('❌ Erreur lors de l\'export : ' + err.message);
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
      
      setImportStatus(`⏳ Import de ${backupData.reservations?.length || 0} réservations en cours...`);
      
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
      if (backupData.garages) setGarages(backupData.garages);
      if (backupData.maintenances) setMaintenances(backupData.maintenances);
      if (backupData.calendarConfig) setCalendarConfig(backupData.calendarConfig);
      
      setImportStatus(`✅ ${backupData.reservations?.length || 0} réservations sauvegardées ! Rechargement...`);
      
      // Attendre 500ms pour que l'utilisateur voie le message, puis recharger
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error('Erreur import:', err);
      setImportStatus('❌ Erreur lors de l\'import : ' + err.message);
      setTimeout(() => setImportStatus(''), 5000);
    }
  };

  const colors = [
    // Bleus
    '#3b82f6', '#2563eb', '#1d4ed8', '#60a5fa', '#93c5fd',
    // Violets
    '#8b5cf6', '#7c3aed', '#6366f1', '#a78bfa', '#c4b5fd',
    // Roses/Rouges
    '#ec4899', '#db2777', '#ef4444', '#dc2626', '#f87171',
    // Oranges/Jaunes
    '#f59e0b', '#f97316', '#fb923c', '#fbbf24', '#fcd34d',
    // Verts
    '#10b981', '#059669', '#14b8a6', '#22c55e', '#4ade80',
    // Cyans
    '#06b6d4', '#0891b2', '#22d3ee', '#67e8f9', '#a5f3fc',
    // Gris
    '#6b7280', '#4b5563', '#374151', '#9ca3af', '#d1d5db',
    // Noirs/Blancs
    '#1f2937', '#111827', '#000000', '#e5e7eb', '#f3f4f6',
  ];

  return (
    <div className="management-overlay" onClick={onClose}>
      <div className="management-panel" onClick={(e) => e.stopPropagation()}>
        <div className="management-header">
          <h2>Gestion des données</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="management-tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  '--tab-color': tab.color
                }}
              >
                <div className="tab-icon" style={{ backgroundColor: activeTab === tab.id ? tab.color : 'transparent' }}>
                  <Icon size={20} style={{ color: activeTab === tab.id ? 'white' : tab.color }} />
                </div>
                <span className="tab-label">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="management-content">
          {/* Formulaire d'ajout */}
          {activeTab !== 'sync' && (
            <div className="add-section">
              <div className="add-section-header">
                <h3>Ajouter {activeTab === 'vehicles' ? 'un véhicule' : activeTab === 'clients' ? 'un client' : activeTab === 'drivers' ? 'un conducteur' : activeTab === 'garages' ? 'un garage' : 'un lieu'}</h3>
                <button 
                  className="toggle-add-form-btn"
                  onClick={() => {
                    if (activeTab === 'locations') {
                      handleAddLocation();
                    } else {
                      setShowAddForm(!showAddForm);
                    }
                  }}
                  title={activeTab === 'locations' ? 'Ajouter un lieu' : (showAddForm ? 'Masquer le formulaire' : 'Afficher le formulaire')}
                >
                  {activeTab === 'locations' ? <Plus size={20} /> : (showAddForm ? <ChevronUp size={20} /> : <ChevronDown size={20} />)}
                </button>
              </div>
            {showAddForm && activeTab !== 'locations' && (
              <div className="add-form">
              <input
                type="text"
                placeholder={`Nom du ${activeTab === 'vehicles' ? 'véhicule' : activeTab === 'clients' ? 'client' : activeTab === 'drivers' ? 'conducteur' : activeTab === 'garages' ? 'garage' : 'lieu'}`}
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                id={activeTab === 'locations' ? 'location-autocomplete-input' : undefined}
              />
              
              {activeTab === 'locations' && (
                <div className="location-details">
                  <small className="help-text">
                    Tapez une adresse et sélectionnez-la dans la liste pour obtenir les coordonnées GPS
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
                  <input
                    type="text"
                    placeholder="Type (VL 20m3, Porteur...)"
                    value={newItem.type}
                    onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Immatriculation"
                    value={newItem.immatriculation}
                    onChange={(e) => setNewItem({ ...newItem, immatriculation: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Marque"
                    value={newItem.marque}
                    onChange={(e) => setNewItem({ ...newItem, marque: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Couleur véhicule"
                    value={newItem.couleurVehicule}
                    onChange={(e) => setNewItem({ ...newItem, couleurVehicule: e.target.value })}
                  />
                  <div className="photo-select-wrapper">
                    <select
                      value={newItem.photo}
                      onChange={(e) => setNewItem({ ...newItem, photo: e.target.value })}
                    >
                      <option value="">Pas de photo</option>
                      {availablePhotos.map(photo => (
                        <option key={photo} value={photo}>{photo}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={`refresh-photos-btn ${isRefreshingPhotos ? 'refreshing' : ''}`}
                      onClick={refreshPhotoList}
                      title="Rafraîchir la liste des photos"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                  <div className="color-picker">
                    <label>Couleur d'affichage:</label>
                    <div className="color-options-grid">
                      {colors.map(color => (
                        <button
                          key={color}
                          className={`color-option ${newItem.color === color ? 'selected' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewItem({ ...newItem, color, displayColor: color })}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
              
              <button className="add-button" onClick={handleAdd}>
                <Plus size={20} />
                Ajouter
              </button>
            </div>
            )}
            </div>
          )}

          {/* Configuration Google Calendar */}
          {activeTab === 'sync' && (
            <div className="sync-section">
              <h3>� Import / Export des données</h3>
              <div className="sync-info">
                <p>Sauvegardez ou restaurez toutes vos données (véhicules, réservations, clients, etc.)</p>
              </div>
              
              <div className="sync-form">
                <div className="import-export-buttons">
                  <button className="export-button" onClick={handleExportData}>
                    <Download size={20} />
                    Exporter toutes les données
                  </button>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleImportData}
                  />
                  <button className="import-button" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={20} />
                    Importer des données
                  </button>
                </div>
                
                {importStatus && (
                  <div className={`sync-status ${importStatus.includes('✅') ? 'success' : 'error'}`}>
                    {importStatus}
                  </div>
                )}
                
                <div className="sync-tips">
                  <h4>ℹ️ Utilisation :</h4>
                  <ul>
                    <li><strong>Export :</strong> Télécharge un fichier JSON avec toutes vos données</li>
                    <li><strong>Import :</strong> Remplace toutes les données actuelles par celles du fichier</li>
                    <li><strong>⚠️ Attention :</strong> L'import écrase complètement les données existantes</li>
                    <li>Utile pour transférer vos données entre différents navigateurs ou appareils</li>
                  </ul>
                </div>
              </div>

              <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />

              <h3>�🗓️ Synchronisation Google Calendar</h3>
              <div className="sync-info">
                <p>Affichez vos événements Google Calendar personnels au-dessus du planning de réservation.</p>
              </div>
              
              <div className="sync-form">
                <div className="form-group">
                  <label>
                    Client ID OAuth 2.0
                    <span className="label-hint">
                      (<a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Obtenir un Client ID</a>)
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="1234567890-abcdefgh.apps.googleusercontent.com"
                    value={calendarConfig?.clientId || ''}
                    onChange={(e) => setCalendarConfig({ ...calendarConfig, clientId: e.target.value })}
                  />
                  <small className="help-text">
                    Créez un "ID client OAuth 2.0" de type "Application Web" dans Google Cloud Console
                  </small>
                </div>

                <div className="form-group">
                  <label>
                    ID du Calendrier (optionnel)
                    <span className="label-hint">
                      (laissez vide pour utiliser votre calendrier principal)
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="primary (par défaut) ou votre.email@gmail.com"
                    value={calendarConfig?.calendarId || ''}
                    onChange={(e) => {
                      let value = e.target.value;
                      // Extraire l'ID si c'est une URL
                      const srcMatch = value.match(/src=([^&]+)/);
                      if (srcMatch) {
                        value = decodeURIComponent(srcMatch[1]);
                      }
                      setCalendarConfig({ ...calendarConfig, calendarId: value });
                    }}
                  />
                  <small className="help-text">
                    Par défaut, votre calendrier principal sera utilisé
                  </small>
                </div>

                {calendarConfig?.clientId && (
                  <div className="sync-status success">
                    ✅ Configuration enregistrée - Connectez-vous depuis le bandeau pour voir vos événements
                  </div>
                )}
                
                {!calendarConfig?.clientId && (
                  <div className="sync-status info">
                    ℹ️ Remplissez le Client ID pour activer la synchronisation OAuth
                  </div>
                )}

                <div className="sync-tips">
                  <h4>🔍 Dépannage :</h4>
                  <ul>
                    <li><strong>Erreur OAuth :</strong> Vérifiez que l'origine JavaScript est bien configurée dans Google Cloud Console</li>
                    <li><strong>Pas de bouton de connexion :</strong> Vérifiez que le Client ID est correct</li>
                    <li><strong>Pas d'événements :</strong> Le calendrier par défaut sera utilisé (laissez le champ ID vide)</li>
                    <li>Ouvrez la console du navigateur (F12) pour voir les logs détaillés</li>
                  </ul>
                </div>
              </div>

              <div className="sync-instructions">
                <h4>📋 Instructions de configuration OAuth 2.0 :</h4>
                <ol>
                  <li>Allez sur <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
                  <li>Créez un nouveau projet ou sélectionnez-en un existant</li>
                  <li>Activez l'<strong>API Google Calendar</strong></li>
                  <li>Allez dans <strong>Identifiants → Créer des identifiants → ID client OAuth 2.0</strong></li>
                  <li>Type d'application : <strong>Application Web</strong></li>
                  <li><strong>⚠️ IMPORTANT - Origines JavaScript autorisées :</strong>
                    <div className="origins-box">
                      <code>http://localhost:5174</code>
                    </div>
                    Ajoutez exactement cette URL (sans slash à la fin)
                  </li>
                  <li><strong>URI de redirection :</strong> Laissez vide ou ignorez ce champ</li>
                  <li>Cliquez sur <strong>Créer</strong></li>
                  <li>Copiez le <strong>Client ID</strong> (format: xxx.apps.googleusercontent.com)</li>
                  <li>Collez-le dans le champ ci-dessus et sauvegardez</li>
                  <li>Rechargez complètement la page (Ctrl+Shift+R ou Cmd+Shift+R)</li>
                </ol>
                <div className="sync-example">
                  <strong>🔒 Sécurisé :</strong> Avec OAuth 2.0, vous vous connectez avec votre compte Google et autorisez l'application à lire votre calendrier. Votre calendrier reste privé et vous pouvez révoquer l'accès à tout moment depuis <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">vos paramètres Google</a>.
                </div>
              </div>
            </div>
          )}

          {/* Mon compte */}
          {activeTab === 'account' && (
            <ChangePassword />
          )}

          {/* Gestion des utilisateurs (Admin uniquement) */}
          {activeTab === 'users' && currentUser?.isAdmin && (
            <UserManagement />
          )}

          {/* Configuration Google Calendar (Admin uniquement) */}
          {activeTab === 'google-config' && currentUser?.isAdmin && (
            <>
              <GoogleCalendarConfig />
              
              <div className="company-address-section" style={{ marginTop: '2rem', padding: '1.5rem', background: '#f9fafb', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={20} />
                  Adresse de MagScène
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                  Cette adresse sera utilisée pour calculer les distances et temps de trajet vers les lieux enregistrés.
                </p>
                <input
                  id="company-address-input"
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="Adresse complète de MagScène"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    marginBottom: '0.75rem'
                  }}
                />
                <button
                  onClick={async () => {
                    try {
                      const config = await loadFromIndexedDB('calendarConfig', {});
                      config.companyAddress = companyAddress;
                      await saveToIndexedDB('calendarConfig', config);
                      alert('Adresse de MagScène sauvegardée !');
                    } catch (error) {
                      console.error('Erreur sauvegarde adresse:', error);
                      alert('Erreur lors de la sauvegarde');
                    }
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Enregistrer l'adresse
                </button>
              </div>
            </>
          )}

          {/* Accès Mobile (Admin uniquement) */}
          {activeTab === 'mobile' && currentUser?.isAdmin && (
            <MobileAccess />
          )}

          {/* Liste des éléments */}
          {activeTab !== 'sync' && activeTab !== 'account' && activeTab !== 'users' && activeTab !== 'google-config' && activeTab !== 'mobile' && (
          <div className="items-section">
            {activeTab === 'vehicles' ? (
              <>
                {/* Véhicules Mag Scène */}
                <div className="vehicles-subsection">
                  <h3>Véhicules Mag Scène ({vehicles.filter(v => !v.isLocation).length})</h3>
                  <div className="items-list">
                    {vehicles.filter(v => !v.isLocation).map((item, index) => (
                      <div 
                        key={item.id} 
                        className={`item-card ${draggedSection === 'magscene' && draggedIndex === index ? 'dragging' : ''}`}
                        draggable={!editingItem}
                        onDragStart={() => handleDragStart(index, 'magscene')}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(index, 'magscene')}
                      >
                        {editingItem?.id === item.id ? (
                    <div className="edit-form">
                      <input
                        type="text"
                        value={editingItem.name}
                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                        onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                        placeholder="Nom"
                      />
                      {activeTab === 'vehicles' && (
                        <>
                          <input
                            type="text"
                            value={editingItem.type || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, type: e.target.value })}
                            placeholder="Type"
                          />
                          <input
                            type="text"
                            value={editingItem.immatriculation || editingItem.registration || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, immatriculation: e.target.value, registration: e.target.value })}
                            placeholder="Immatriculation"
                          />
                          <input
                            type="text"
                            value={editingItem.marque || editingItem.brand || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, marque: e.target.value, brand: e.target.value })}
                            placeholder="Marque"
                          />
                          <input
                            type="text"
                            value={editingItem.couleurVehicule || editingItem.color || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, couleurVehicule: e.target.value, color: e.target.value })}
                            placeholder="Couleur véhicule"
                          />
                          <div className="photo-select-wrapper">
                            <select
                              value={editingItem.photo || ''}
                              onChange={(e) => setEditingItem({ ...editingItem, photo: e.target.value })}
                            >
                              <option value="">Pas de photo</option>
                              {availablePhotos.map(photo => (
                                <option key={photo} value={photo}>{photo}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className={`refresh-photos-btn ${isRefreshingPhotos ? 'refreshing' : ''}`}
                              onClick={refreshPhotoList}
                              title="Rafraîchir la liste des photos"
                            >
                              <RefreshCw size={16} />
                            </button>
                          </div>
                          <div className="color-picker-inline">
                            <label>Couleur d'affichage:</label>
                            <div className="color-options-grid">
                              {colors.map(color => (
                                <button
                                  key={color}
                                  className={`color-option ${(editingItem.displayColor || editingItem.color) === color ? 'selected' : ''}`}
                                  style={{ backgroundColor: color }}
                                  onClick={() => setEditingItem({ ...editingItem, color, displayColor: color })}
                                />
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                      <div className="edit-actions">
                        <button className="save-button" onClick={handleSaveEdit}>
                          Enregistrer
                        </button>
                        <button className="cancel-edit-button" onClick={() => setEditingItem(null)}>
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="item-info">
                        {activeTab === 'vehicles' && (
                          <div className="item-color" style={{ backgroundColor: item.displayColor || item.color || '#3b82f6' }} />
                        )}
                          <div>
                          <div className="item-name">{item.name}</div>
                          {activeTab === 'vehicles' && (
                            <>
                              <div className="item-type">{item.type}</div>
                              {(item.immatriculation || item.registration) && (
                                <div className="item-detail">📋 {item.immatriculation || item.registration}</div>
                              )}
                              {item.marque && (
                                <div className="item-detail">🚗 {item.marque} {item.couleurVehicule}</div>
                              )}
                              {item.brand && (
                                <div className="item-detail">🚗 {item.brand} {item.model}</div>
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
                        {activeTab === 'vehicles' && item.photo && (
                          <div className="item-photo">
                            <img src={`/Photos/${item.photo}`} alt={item.name} />
                          </div>
                        )}
                      </div>
                      <div className="item-actions">
                        <div className="drag-handle" title="Glisser pour réorganiser">
                          <GripVertical size={20} />
                        </div>
                        <button className="edit-button" onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>
                          <Edit2 size={16} />
                        </button>
                        <button className="delete-button" onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              
              {vehicles.filter(v => !v.isLocation).length === 0 && (
                <div className="empty-state">
                  <p>Aucun véhicule Mag Scène</p>
                </div>
              )}
            </div>
                </div>

                {/* Véhicules de location */}
                <div className="vehicles-subsection">
                  <h3>Véhicules de location ({vehicles.filter(v => v.isLocation).length})</h3>
                  <div className="items-list">
                    {vehicles.filter(v => v.isLocation).map((item, index) => (
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
                            <input
                              type="text"
                              value={editingItem.name}
                              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                              onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                              placeholder="Nom"
                            />
                            <input
                              type="text"
                              value={editingItem.type || ''}
                              onChange={(e) => setEditingItem({ ...editingItem, type: e.target.value })}
                              placeholder="Type"
                            />
                            <input
                              type="text"
                              value={editingItem.immatriculation || editingItem.registration || ''}
                              onChange={(e) => setEditingItem({ ...editingItem, immatriculation: e.target.value, registration: e.target.value })}
                              placeholder="Immatriculation"
                            />
                            <input
                              type="text"
                              value={editingItem.marque || editingItem.brand || ''}
                              onChange={(e) => setEditingItem({ ...editingItem, marque: e.target.value, brand: e.target.value })}
                              placeholder="Marque"
                            />
                            <input
                              type="text"
                              value={editingItem.couleurVehicule || editingItem.color || ''}
                              onChange={(e) => setEditingItem({ ...editingItem, couleurVehicule: e.target.value, color: e.target.value })}
                              placeholder="Couleur véhicule"
                            />
                            <div className="photo-select-wrapper">
                              <select
                                value={editingItem.photo || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, photo: e.target.value })}
                              >
                                <option value="">Pas de photo</option>
                                {availablePhotos.map(photo => (
                                  <option key={photo} value={photo}>{photo}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className={`refresh-photos-btn ${isRefreshingPhotos ? 'refreshing' : ''}`}
                                onClick={refreshPhotoList}
                                title="Rafraîchir la liste des photos"
                              >
                                <RefreshCw size={16} />
                              </button>
                            </div>
                            <div className="color-picker-inline">
                              <label>Couleur d'affichage:</label>
                              <div className="color-options-grid">
                                {colors.map(color => (
                                  <button
                                    key={color}
                                    className={`color-option ${(editingItem.displayColor || editingItem.color) === color ? 'selected' : ''}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setEditingItem({ ...editingItem, color, displayColor: color })}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="edit-actions">
                              <button className="save-button" onClick={handleSaveEdit}>
                                Enregistrer
                              </button>
                              <button className="cancel-edit-button" onClick={() => setEditingItem(null)}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="item-content">
                              <div className="item-color" style={{ backgroundColor: item.displayColor || item.color || '#3b82f6' }} />
                              <div>
                                <div className="item-name">{item.name}</div>
                                <div className="item-type">{item.type}</div>
                                {(item.immatriculation || item.registration) && (
                                  <div className="item-detail">📋 {item.immatriculation || item.registration}</div>
                                )}
                                {item.marque && (
                                  <div className="item-detail">🚗 {item.marque} {item.couleurVehicule}</div>
                                )}
                                {item.brand && (
                                  <div className="item-detail">🏭 {item.brand} {item.model || ''}</div>
                                )}
                              </div>
                              {item.photo && (
                                <div className="item-photo">
                                  <img src={`/Photos/${item.photo}`} alt={item.name} />
                                </div>
                              )}
                            </div>
                            <div className="item-actions">
                              <div className="drag-handle" title="Glisser pour réorganiser">
                                <GripVertical size={20} />
                              </div>
                              <button className="edit-button" onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>
                                <Edit2 size={16} />
                              </button>
                              <button className="delete-button" onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    
                    {vehicles.filter(v => v.isLocation).length === 0 && (
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
                  {getCurrentList().map((item, index) => (
                    <div key={item.id} className="item-card">
                      {editingItem?.id === item.id ? (
                        <div className="edit-form">
                          <input
                            type="text"
                            value={editingItem.name}
                            onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                            onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                            placeholder="Nom"
                          />
                          <div className="edit-actions">
                            <button className="save-button" onClick={handleSaveEdit}>
                              Enregistrer
                            </button>
                            <button className="cancel-edit-button" onClick={() => setEditingItem(null)}>
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="item-content">
                            <div>
                              <div className="item-name">{item.name}</div>
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
                            <button className="edit-button" onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>
                              <Edit2 size={16} />
                            </button>
                            <button className="delete-button" onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  
                  {getCurrentList().length === 0 && (
                    <div className="empty-state">
                      <p>Aucun élément pour le moment</p>
                      <p className="empty-hint">Utilisez le formulaire ci-dessus pour en ajouter</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </div>

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
    </div>
  );
};

export default ManagementPanel;
