import React, { useState, useRef, useEffect } from 'react';
import './PhoneInput.css';
import { Input } from '@/design-system';

const COUNTRY_CODES = [
  { code: '+262', flag: '🇷🇪', label: 'Réunion', format: '0692 XX XX XX', maxDigits: 10 },
  { code: '+33', flag: '🇫🇷', label: 'France', format: '06 XX XX XX XX', maxDigits: 10 },
  { code: '+590', flag: '🇬🇵', label: 'Guadeloupe', format: '0690 XX XX XX', maxDigits: 10 },
  { code: '+594', flag: '🇬🇫', label: 'Guyane', format: '0694 XX XX XX', maxDigits: 10 },
  { code: '+596', flag: '🇲🇶', label: 'Martinique', format: '0696 XX XX XX', maxDigits: 10 },
  { code: '+269', flag: '🇰🇲', label: 'Comores', format: '', maxDigits: 10 },
  { code: '+261', flag: '🇲🇬', label: 'Madagascar', format: '', maxDigits: 10 },
  { code: '+230', flag: '🇲🇺', label: 'Maurice', format: '', maxDigits: 8 },
  { code: '+32', flag: '🇧🇪', label: 'Belgique', format: '04XX XX XX XX', maxDigits: 10 },
  { code: '+41', flag: '🇨🇭', label: 'Suisse', format: '07X XXX XX XX', maxDigits: 10 },
  { code: '+352', flag: '🇱🇺', label: 'Luxembourg', format: '', maxDigits: 9 },
  { code: '+377', flag: '🇲🇨', label: 'Monaco', format: '', maxDigits: 8 },
];

/**
 * Normalise un numéro de téléphone :
 * - supprime espaces, tirets, points, parenthèses
 * - formate en groupes de 2 chiffres (français)
 */
export function normalizePhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/[^\d+]/g, '');
  return digits;
}

export function formatPhoneDisplay(raw) {
  if (!raw) return '';
  
  // Si format stocké +XXX|06XXXXXXXX, extraire le numéro local
  let local = raw;
  let prefix = '';
  if (raw.includes('|')) {
    const parts = raw.split('|', 2);
    prefix = parts[0];
    local = parts[1] || '';
  }
  
  // Retirer tout sauf chiffres
  let digits = local.replace(/[^\d]/g, '');
  if (!digits) return raw;
  
  // Format français : 0X XX XX XX XX
  if (digits.length === 10 && digits.startsWith('0')) {
    const formatted = digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    return prefix && prefix !== '+33' && prefix !== '+262' ? `(${prefix}) ${formatted}` : formatted;
  }
  // Format sans le 0 initial (9 chiffres)
  if (digits.length === 9 && !digits.startsWith('0')) {
    digits = '0' + digits;
    const formatted = digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    return prefix && prefix !== '+33' && prefix !== '+262' ? `(${prefix}) ${formatted}` : formatted;
  }
  // Défaut : groupes de 2
  const formatted = digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  return prefix && prefix !== '+33' && prefix !== '+262' ? `(${prefix}) ${formatted}` : formatted;
}

/**
 * Parse une valeur stockée pour extraire le préfixe et le numéro local  
 * Format stocké : "+33|0612345678" ou juste "0612345678"
 */
function parseStoredValue(value) {
  if (!value) return { prefix: '+262', local: '' };
  if (value.includes('|')) {
    const [prefix, local] = value.split('|', 2);
    return { prefix, local: local || '' };
  }
  // Pas de préfixe stocké, garder tel quel
  return { prefix: '+262', local: value };
}

/**
 * Composant PhoneInput avec sélection du préfixe international
 */
export default function PhoneInput({ value, onChange, placeholder, id, className, disabled }) {
  const { prefix: initPrefix, local: initLocal } = parseStoredValue(value);
  const [selectedPrefix, setSelectedPrefix] = useState(initPrefix);
  const [localNumber, setLocalNumber] = useState(initLocal);
  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Sync when external value changes
  useEffect(() => {
    const { prefix, local } = parseStoredValue(value);
    setSelectedPrefix(prefix);
    setLocalNumber(local);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  const selectedCountry = COUNTRY_CODES.find(c => c.code === selectedPrefix) || COUNTRY_CODES[0];

  const handlePrefixChange = (code) => {
    setSelectedPrefix(code);
    setShowDropdown(false);
    setSearch('');
    // Emit combined value
    if (onChange) {
      const combined = localNumber ? `${code}|${localNumber}` : '';
      onChange(combined);
    }
  };

  const handleLocalChange = (e) => {
    let raw = e.target.value;
    // Garder seulement chiffres et espaces pour la saisie
    raw = raw.replace(/[^\d\s\-.()]/g, '');
    setLocalNumber(raw);
    if (onChange) {
      const digits = raw.replace(/[^\d]/g, '');
      const combined = digits ? `${selectedPrefix}|${digits}` : '';
      onChange(combined);
    }
  };

  // Auto-format pendant la saisie
  const displayLocal = (() => {
    const digits = localNumber.replace(/[^\d]/g, '');
    if (!digits) return '';
    // Format 0X XX XX XX XX
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    }
    return digits;
  })();

  const filteredCountries = search
    ? COUNTRY_CODES.filter(c =>
        c.label.toLowerCase().includes(search.toLowerCase()) ||
        c.code.includes(search)
      )
    : COUNTRY_CODES;

  return (
    <div className={`phone-input-container ${className || ''}`}>
      <div className="phone-input-wrapper" ref={dropdownRef}>
        <button
          type="button"
          className="phone-prefix-btn"
          onClick={() => !disabled && setShowDropdown(!showDropdown)}
          disabled={disabled}
          title={`${selectedCountry.flag} ${selectedCountry.label} (${selectedCountry.code})`}
        >
          <span className="phone-prefix-flag">{selectedCountry.flag}</span>
          <span className="phone-prefix-code">{selectedCountry.code}</span>
          <span className="phone-prefix-arrow">▾</span>
        </button>

        {showDropdown && (
          <div className="phone-dropdown">
            <Input
              type="text"
              className="phone-dropdown-search"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <div className="phone-dropdown-list">
              {filteredCountries.map(c => (
                <button
                  key={c.code}
                  type="button"
                  className={`phone-dropdown-item ${c.code === selectedPrefix ? 'active' : ''}`}
                  onClick={() => handlePrefixChange(c.code)}
                >
                  <span className="phone-dropdown-flag">{c.flag}</span>
                  <span className="phone-dropdown-label">{c.label}</span>
                  <span className="phone-dropdown-code">{c.code}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Input
        ref={inputRef}
        id={id}
        type="tel"
        className="phone-local-input"
        value={displayLocal}
        onChange={handleLocalChange}
        placeholder={placeholder || selectedCountry.format || '0X XX XX XX XX'}
        disabled={disabled}
      />
    </div>
  );
}
