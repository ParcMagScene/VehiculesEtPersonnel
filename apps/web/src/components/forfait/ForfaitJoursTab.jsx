// Sous-onglet dédié Forfait-jours (module Personnel).
// Réf. avenant n° 3 du 22-4-2025 (JO 12-6-2026, applicable au 17-5-2025).
import './ForfaitJoursTab.css';

import { AlertTriangle, Info, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

import { InlineAlert } from '@/design-system';

import ForfaitJoursPanel from './ForfaitJoursPanel';

export default function ForfaitJoursTab({ persons = [], currentUser }) {
  const isAdmin = Boolean(currentUser?.isAdmin);
  const currentUserId = currentUser?.id ?? null;

  // Non-admin : seul son propre profil est accessible (backend renvoie 403 sinon).
  const eligibleCandidates = useMemo(() => {
    const permanents = (persons || []).filter((p) => p.type === 'permanent');
    if (isAdmin) return permanents;
    return permanents.filter((p) => p.user_id === currentUserId);
  }, [persons, isAdmin, currentUserId]);

  const [selectedPersonId, setSelectedPersonId] = useState(() => {
    if (!isAdmin) return eligibleCandidates[0]?.id ?? null;
    const activated = eligibleCandidates.find((p) => p.is_forfait_jours);
    return activated?.id ?? eligibleCandidates[0]?.id ?? null;
  });

  const selectedPerson = persons.find((p) => p.id === selectedPersonId) || null;

  if (!selectedPerson) {
    return (
      <div className="forfait-tab-wrapper">
        <InlineAlert variant="info">
          <Info size={14} />{' '}
          {isAdmin
            ? "Aucun personnel permanent disponible. Le forfait-jours s'applique uniquement aux cadres permanents ayant signé un avenant (art. L.3121-58)."
            : "Vous n'êtes pas configuré en forfait annuel en jours. Contactez votre administrateur RH si vous devez y être basculé (art. 5.7.1)."}
        </InlineAlert>
      </div>
    );
  }

  return (
    <div className="forfait-tab-wrapper">
      <div className="forfait-tab-header">
        <div>
          <h2 className="forfait-tab-title">
            <Users size={18} /> Forfait annuel en jours
          </h2>
          <p className="forfait-tab-subtitle">
            Art. 5.7 conventionnel · avenant n° 3 du 22-4-2025 (JO 12-6-2026)
          </p>
        </div>
        {isAdmin && eligibleCandidates.length > 1 && (
          <div className="forfait-tab-picker">
            <label htmlFor="forfait-tab-person">Salarié :</label>
            <select
              id="forfait-tab-person"
              value={selectedPersonId ?? ''}
              onChange={(e) => setSelectedPersonId(Number(e.target.value))}
            >
              {eligibleCandidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                  {p.is_forfait_jours ? ' • Forfait actif' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedPerson.type !== 'permanent' && (
        <InlineAlert variant="warning">
          <AlertTriangle size={14} /> {selectedPerson.first_name} {selectedPerson.last_name} n'est
          pas de type "permanent" : le forfait-jours ne peut être activé.
        </InlineAlert>
      )}

      <ForfaitJoursPanel person={selectedPerson} isAdmin={isAdmin} />
    </div>
  );
}
