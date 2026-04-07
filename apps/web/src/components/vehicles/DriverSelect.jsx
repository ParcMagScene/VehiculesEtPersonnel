import React, { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Check } from 'lucide-react';
import { Avatar, Button } from '@/design-system';
import './DriverSelect.css';

/**
 * Sélecteur de conducteur avec avatars (photo ou initiales).
 * 
 * @param {string} value - Nom du conducteur sélectionné
 * @param {Function} onChange - Callback (driverName: string)
 * @param {Array} qualifiedDrivers - [{id, name, photo, skills: string[]}]
 * @param {Array} historySuggestions - string[] noms historiques
 * @param {string} placeholder - Texte placeholder
 * @param {boolean} disabled - Désactiver le sélecteur
 */
const DriverSelect = ({ value, onChange, qualifiedDrivers = [], historySuggestions = [], placeholder = 'Sélectionner un conducteur', disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Fermer au clic en dehors
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Fermer sur Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  // Suggestions historiques non qualifiées
  const otherDrivers = historySuggestions.filter(s => !qualifiedDrivers.some(q => q.name === s));

  // Trouver le conducteur sélectionné
  const selectedDriver = qualifiedDrivers.find(d => d.name === value);

  const handleSelect = (name) => {
    onChange(name);
    setIsOpen(false);
  };

  const renderAvatar = (driver, size = 28) => (
    <Avatar name={driver?.name || ''} avatar={driver?.photo ? `/avatars/${driver.photo}` : undefined} size={size} />
  );

  return (
    <div className={`driver-select ${disabled ? 'disabled' : ''}`} ref={containerRef}>
      {/* Bouton trigger */}
      <Button variant="ghost"         type="button"
        className={`driver-select-trigger ${isOpen ? 'open' : ''} ${value ? 'has-value' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        {value ? (
          <div className="driver-select-value">
            {renderAvatar(selectedDriver || { name: value }, 24)}
            <span className="driver-select-name">{value}</span>
            {selectedDriver?.skills?.length > 0 && (
              <span className="driver-select-skill">{selectedDriver.skills.join(', ')}</span>
            )}
          </div>
        ) : (
          <span className="driver-select-placeholder">{placeholder}</span>
        )}
        <ChevronDown size={16} className={`driver-select-chevron ${isOpen ? 'rotated' : ''}`} />
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="driver-select-dropdown">
          {/* Option vide */}
          <div
            className={`driver-select-option ${!value ? 'selected' : ''}`}
            onClick={() => handleSelect('')}
          >
            <div className="driver-select-option-avatar">
              <User size={16} style={{ color: 'var(--theme-text-muted)' }} />
            </div>
            <span className="driver-select-option-label" style={{ color: 'var(--theme-text-muted)' }}>
              Aucun conducteur
            </span>
          </div>

          {/* Section qualifiés */}
          {qualifiedDrivers.length > 0 && (
            <>
              <div className="driver-select-group-label">Personnel qualifié</div>
              {qualifiedDrivers.map((driver) => (
                <div
                  key={`q-${driver.id}`}
                  className={`driver-select-option ${value === driver.name ? 'selected' : ''}`}
                  onClick={() => handleSelect(driver.name)}
                >
                  <div className="driver-select-option-avatar">
                    {renderAvatar(driver, 28)}
                  </div>
                  <div className="driver-select-option-info">
                    <span className="driver-select-option-name">{driver.name}</span>
                    {driver.skills?.length > 0 && (
                      <span className="driver-select-option-skill">{driver.skills.join(', ')}</span>
                    )}
                  </div>
                  {value === driver.name && <Check size={16} className="driver-select-check" />}
                </div>
              ))}
            </>
          )}

          {/* Section historique */}
          {otherDrivers.length > 0 && (
            <>
              <div className="driver-select-group-label">Historique</div>
              {otherDrivers.map((name, idx) => (
                <div
                  key={`h-${idx}`}
                  className={`driver-select-option ${value === name ? 'selected' : ''}`}
                  onClick={() => handleSelect(name)}
                >
                  <div className="driver-select-option-avatar">
                    {renderAvatar({ name }, 28)}
                  </div>
                  <div className="driver-select-option-info">
                    <span className="driver-select-option-name">{name}</span>
                    <span className="driver-select-option-skill">historique</span>
                  </div>
                  {value === name && <Check size={16} className="driver-select-check" />}
                </div>
              ))}
            </>
          )}

          {qualifiedDrivers.length === 0 && otherDrivers.length === 0 && (
            <div className="driver-select-empty">Aucun conducteur disponible</div>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverSelect;
