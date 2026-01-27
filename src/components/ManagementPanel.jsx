import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Edit2, Trash2, Truck, Users, MapPin, Calendar, ChevronUp, ChevronDown } from 'lucide-react';
import { saveToIndexedDB, STORES } from '../utils/indexedDB';
import './ManagementPanel.css';

const ManagementPanel = ({
  vehicles,
  setVehicles,
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
  const autocompleteRef = useRef(null);
  const inputRef = useRef(null);

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
    { id: 'vehicles', label: 'Véhicules', icon: Truck },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'drivers', label: 'Conducteurs', icon: Users },
    { id: 'locations', label: 'Lieux', icon: MapPin },
    { id: 'garages', label: 'Garages', icon: MapPin },
    { id: 'sync', label: 'Synchronisation', icon: Calendar },
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
      case 'locations': setLocations(newList); break;
    }
  };

  const handleAdd = () => {
    if (!newItem.name.trim()) return;

    const currentList = getCurrentList();
    const maxId = currentList.length > 0 ? Math.max(...currentList.map(item => item.id)) : 0;
    
    const itemToAdd = {
      id: maxId + 1,
      name: newItem.name,
      ...(activeTab === 'vehicles' && { 
        type: newItem.type || 'Véhicule',
        color: newItem.color,
        immatriculation: newItem.immatriculation || '',
        marque: newItem.marque || '',
        couleurVehicule: newItem.couleurVehicule || '',
        photo: newItem.photo || ''
      }),
      ...(activeTab === 'locations' && {
        address: newItem.address || '',
        lat: newItem.lat || null,
        lng: newItem.lng || null,
        placeId: newItem.placeId || ''
      })
    };

    setCurrentList([...currentList, itemToAdd]);
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
  };

  const handleEdit = (item) => {
    setEditingItem({ ...item });
  };

  const handleSaveEdit = () => {
    if (!editingItem.name.trim()) return;

    const currentList = getCurrentList();
    setCurrentList(
      currentList.map(item => item.id === editingItem.id ? editingItem : item)
    );
    setEditingItem(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) {
      const currentList = getCurrentList();
      setCurrentList(currentList.filter(item => item.id !== id));
    }
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const currentList = [...getCurrentList()];
    [currentList[index - 1], currentList[index]] = [currentList[index], currentList[index - 1]];
    
    // Mettre à jour les ordre si c'est des véhicules
    if (activeTab === 'vehicles') {
      currentList.forEach((v, i) => v.order = i);
      saveToIndexedDB(STORES.vehicles, currentList);
    }
    
    setCurrentList(currentList);
  };

  const handleMoveDown = (index) => {
    const currentList = [...getCurrentList()];
    if (index === currentList.length - 1) return;
    [currentList[index], currentList[index + 1]] = [currentList[index + 1], currentList[index]];
    
    // Mettre à jour les ordre si c'est des véhicules
    if (activeTab === 'vehicles') {
      currentList.forEach((v, i) => v.order = i);
      saveToIndexedDB(STORES.vehicles, currentList);
    }
    
    setCurrentList(currentList);
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
              >
                <Icon size={20} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="management-content">
          {/* Formulaire d'ajout */}
          {activeTab !== 'sync' && (
            <div className="add-section">
              <h3>Ajouter</h3>
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
                  <select
                    value={newItem.photo}
                    onChange={(e) => setNewItem({ ...newItem, photo: e.target.value })}
                  >
                    <option value="">Pas de photo</option>
                    <option value="BM-038-NY.jpg">BM-038-NY.jpg</option>
                    <option value="DL-622-TF.jpg">DL-622-TF.jpg</option>
                    <option value="DQ-055-LG.jpg">DQ-055-LG.jpg</option>
                    <option value="DS-377-RL.jpg">DS-377-RL.jpg</option>
                    <option value="DT-406-TJ.jpg">DT-406-TJ.jpg</option>
                    <option value="DT-692-RE.jpg">DT-692-RE.jpg</option>
                    <option value="EB-855-VR.jpg">EB-855-VR.jpg</option>
                    <option value="EE-446-NG.jpg">EE-446-NG.jpg</option>
                    <option value="EL-720-CX.jpg">EL-720-CX.jpg</option>
                    <option value="MOV160.jpg">MOV160.jpg</option>
                    <option value="MOV60.jpg">MOV60.jpg</option>
                    <option value="MOV80.jpg">MOV80.jpg</option>
                  </select>
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
          </div>
          )}

          {/* Configuration Google Calendar */}
          {activeTab === 'sync' && (
            <div className="sync-section">
              <h3>🗓️ Synchronisation Google Calendar</h3>
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

          {/* Liste des éléments */}
          {activeTab !== 'sync' && (
          <div className="items-section">
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
                          <select
                            value={editingItem.photo || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, photo: e.target.value })}
                          >
                            <option value="">Pas de photo</option>
                            <option value="BM-038-NY.jpg">BM-038-NY.jpg</option>
                            <option value="DL-622-TF.jpg">DL-622-TF.jpg</option>
                            <option value="DQ-055-LG.jpg">DQ-055-LG.jpg</option>
                            <option value="DS-377-RL.jpg">DS-377-RL.jpg</option>
                            <option value="DT-406-TJ.jpg">DT-406-TJ.jpg</option>
                            <option value="DT-692-RE.jpg">DT-692-RE.jpg</option>
                            <option value="EB-855-VR.jpg">EB-855-VR.jpg</option>
                            <option value="EE-446-NG.jpg">EE-446-NG.jpg</option>
                            <option value="EL-720-CX.jpg">EL-720-CX.jpg</option>
                            <option value="MOV160.jpg">MOV160.jpg</option>
                            <option value="MOV60.jpg">MOV60.jpg</option>
                            <option value="MOV80.jpg">MOV80.jpg</option>
                          </select>
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
                        {activeTab === 'vehicles' && (
                          <div className="move-buttons">
                            <button 
                              className="move-button" 
                              onClick={() => handleMoveUp(index)}
                              disabled={index === 0}
                              title="Déplacer vers le haut"
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button 
                              className="move-button" 
                              onClick={() => handleMoveDown(index)}
                              disabled={index === getCurrentList().length - 1}
                              title="Déplacer vers le bas"
                            >
                              <ChevronDown size={16} />
                            </button>
                          </div>
                        )}
                        <button className="edit-button" onClick={() => handleEdit(item)}>
                          <Edit2 size={16} />
                        </button>
                        <button className="delete-button" onClick={() => handleDelete(item.id)}>
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
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagementPanel;
