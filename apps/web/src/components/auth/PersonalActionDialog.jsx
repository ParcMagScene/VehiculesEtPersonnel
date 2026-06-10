/* ═══════════════════════════════════════════════════════════════
   PersonalActionDialog — Modal d'authentification éphémère
   pour validation d'actions personnelles (planning, congés, indispos)
   depuis le compte partagé « Equipe » (commun@magsav.com).
   ═══════════════════════════════════════════════════════════════

   Utilisation :
     <PersonalActionDialog
       isOpen={...}
       onClose={...}
       personnel={[]}                 // liste { id, first_name, last_name, ... }
       defaultPersonId={42}           // optionnel : pré-sélection
       actionLabel="Confirmer la disponibilité"
       onConfirm={async ({ personId, pin, password }) => { ... }}
     />

   Le composant n'effectue pas l'appel API lui-même : il délègue à
   `onConfirm` qui doit retourner une Promise. Cela permet au hook
   `usePersonalActionGuard` de centraliser la sémantique métier. */

import './PersonalActionDialog.css';

import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button, Dialog, Input, Select } from '@/design-system';

function PersonalActionDialog({
  isOpen,
  onClose,
  personnel = [],
  defaultPersonId = null,
  actionLabel = 'Valider en mon nom',
  description = 'Confirmez votre identité personnelle pour valider cette action depuis le compte Equipe.',
  title = 'Authentification personnelle',
  onConfirm,
}) {
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('pin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset à chaque ouverture / fermeture
  useEffect(() => {
    if (isOpen) {
      setSelectedPersonId(defaultPersonId ? String(defaultPersonId) : '');
      setPin('');
      setPassword('');
      setAuthMode('pin');
      setShowPassword(false);
      setLoading(false);
      setError(null);
    }
  }, [isOpen, defaultPersonId]);

  const sortedPersonnel = useMemo(() => {
    const list = Array.isArray(personnel) ? personnel.filter((p) => p && p.id) : [];
    return [...list].sort((a, b) => {
      const an = `${a.last_name || ''} ${a.first_name || ''}`.toLowerCase();
      const bn = `${b.last_name || ''} ${b.first_name || ''}`.toLowerCase();
      return an.localeCompare(bn, 'fr');
    });
  }, [personnel]);

  const selectedPersonName = useMemo(() => {
    const p = personnel.find((x) => x?.id === Number(selectedPersonId));
    if (!p) return '';
    return `${p.first_name || ''} ${p.last_name || ''}`.trim();
  }, [personnel, selectedPersonId]);

  const isFormValid =
    selectedPersonId &&
    ((authMode === 'pin' && pin.length === 4) || (authMode === 'password' && password.length > 0));

  const handleAuthModeChange = (mode) => {
    setAuthMode(mode);
    setPin('');
    setPassword('');
    setError(null);
  };

  const handleConfirm = async () => {
    if (!isFormValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm({
        personId: Number(selectedPersonId),
        pin: authMode === 'pin' ? pin : '',
        password: authMode === 'password' ? password : '',
      });
      // Sur succès, l'appelant ferme via onClose
    } catch (err) {
      setError(err?.message || 'Identifiants incorrects');
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      size="sm"
      title={title}
      description={description}
      showClose={!loading}
    >
      <div className="personal-action-dialog">
        {/* Sélection du personnel */}
        <div className="pad-field">
          <label htmlFor="pad-person" className="pad-label">
            Personnel
          </label>
          <Select
            id="pad-person"
            value={selectedPersonId}
            onChange={(e) => {
              setSelectedPersonId(e.target.value);
              setError(null);
            }}
            disabled={loading || Boolean(defaultPersonId)}
          >
            <option value="">— Sélectionnez un personnel —</option>
            {sortedPersonnel.map((p) => (
              <option key={p.id} value={p.id}>
                {`${p.first_name || ''} ${p.last_name || ''}`.trim() || `#${p.id}`}
              </option>
            ))}
          </Select>
          {selectedPersonName && (
            <div className="pad-selected-person">
              <ShieldCheck size={14} />
              <strong>{selectedPersonName}</strong>
            </div>
          )}
        </div>

        {/* Onglets PIN/Mot de passe */}
        <div className="pad-tabs">
          <button
            type="button"
            className={`pad-tab ${authMode === 'pin' ? 'pad-tab--active' : ''}`}
            onClick={() => handleAuthModeChange('pin')}
            disabled={loading}
          >
            Code PIN
          </button>
          <button
            type="button"
            className={`pad-tab ${authMode === 'password' ? 'pad-tab--active' : ''}`}
            onClick={() => handleAuthModeChange('password')}
            disabled={loading}
          >
            Mot de passe
          </button>
        </div>

        {/* Champ PIN */}
        {authMode === 'pin' && (
          <div className="pad-field">
            <label htmlFor="pad-pin" className="pad-label">
              Code PIN (4 chiffres)
            </label>
            <Input
              id="pad-pin"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0000"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 4));
                if (error) setError(null);
              }}
              disabled={loading}
            />
          </div>
        )}

        {/* Champ Mot de passe */}
        {authMode === 'password' && (
          <div className="pad-field">
            <label htmlFor="pad-password" className="pad-label">
              Mot de passe
            </label>
            <div className="pad-password-wrap">
              <Input
                id="pad-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="off"
                placeholder="Entrez votre mot de passe"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                disabled={loading}
              />
              <button
                type="button"
                className="pad-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="pad-error" role="alert">
            {error}
          </div>
        )}

        <div className="pad-actions">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!isFormValid || loading}
            isLoading={loading}
          >
            <Lock size={16} />
            {actionLabel}
          </Button>
        </div>

        <div className="pad-info">
          <Lock size={12} />
          <span>
            Le compte Equipe reste actif après validation. L&apos;action est tracée à votre nom.
          </span>
        </div>
      </div>
    </Dialog>
  );
}

export default PersonalActionDialog;
