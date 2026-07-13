// apps/web/src/components/personnel/AssignmentConflictBadge.jsx
//
// Ticket : T-P1-05c (Conflicts v2 — badge conflits dans AssignmentDialog).
//
// Sous-composant leger de pre-check des conflits agenda personnel
// via le hook `useConflictsPrecheck` (T-P1-05b). Affichage
// conditionnel :
//
// - `available=false` : rien (le pre-check est indisponible ;
//   la creation POST v1 continue de remonter `warnings.conflicts`
//   comme avant, comportement legacy conserve).
// - `loading=true` : petit indicateur discret.
// - `hasConflict=false` : badge succes discret "Aucun conflit
//   detecte pour cette periode".
// - `hasConflict=true` : InlineAlert warning avec la liste des
//   conflits (source + label + dates) + hint "vous pouvez creer
//   quand meme, le serveur logera un warning".
//
// Le badge est **non-bloquant** : il n'empeche pas la creation.
// C'est une aide a la decision UX. Le blocage strict est du
// ressort d'un ticket ulterieur (T-P1-05d) qui ajouterait un
// `confirm=true` de contournement.

import { AlertTriangle, CheckCircle } from 'lucide-react';

import { InlineAlert, Spinner } from '@/design-system';

import { useConflictsPrecheck } from '../../hooks/useConflictsPrecheck.js';
import api from '../../utils/api';

/**
 * @param {object} props
 * @param {number|null} props.personId
 * @param {string|null} props.startDate ISO date `YYYY-MM-DD`.
 * @param {string|null} props.endDate   ISO date `YYYY-MM-DD`.
 * @param {number|null} [props.excludeMissionId] Mission courante
 *   a exclure en mode edition (evite le "faux conflit" avec soi-meme).
 * @returns {JSX.Element|null}
 */
export default function AssignmentConflictBadge({
  personId,
  startDate,
  endDate,
  excludeMissionId = null,
}) {
  const enabled = Boolean(personId && startDate && endDate);
  const params = enabled
    ? {
        personId,
        startDate,
        endDate,
        exclude:
          excludeMissionId != null
            ? [{ entityType: 'mission', entityId: excludeMissionId }]
            : undefined,
      }
    : { personId: null, startDate: null, endDate: null };

  const { conflicts, hasConflict, count, loading, available } = useConflictsPrecheck(api, params, {
    enabled,
    debounceMs: 300,
  });

  // Pre-check indisponible (flag off, FEATURE_DISABLED, methode
  // client absente, erreur reseau) : on ne montre rien pour ne
  // pas polluer l'UI legacy.
  if (!available && !loading) return null;
  // Manque de donnees d'entree : on ne montre rien.
  if (!enabled) return null;

  if (loading) {
    return (
      <div className="asd-conflicts-loading">
        <Spinner size="sm" />
        <span>Verification des conflits agenda…</span>
      </div>
    );
  }

  if (!hasConflict) {
    return (
      <InlineAlert variant="success">
        <span className="asd-conflicts-ok">
          <CheckCircle size={14} aria-hidden="true" /> Aucun conflit agenda detecte pour cette
          periode.
        </span>
      </InlineAlert>
    );
  }

  return (
    <InlineAlert variant="warning">
      <div className="asd-conflicts-warning">
        <div className="asd-conflicts-warning-header">
          <AlertTriangle size={14} aria-hidden="true" />
          <strong>
            {count} conflit{count > 1 ? 's' : ''} agenda detecte
            {count > 1 ? 's' : ''} pour cette periode
          </strong>
        </div>
        <ul className="asd-conflicts-list">
          {conflicts.slice(0, 5).map((c, idx) => (
            <li key={`${c.source ?? 'unknown'}-${c.entityId ?? idx}`}>
              <span className="asd-conflicts-source">{c.source ?? '—'}</span>
              {c.label ? <> : {c.label}</> : null}
              {c.startDate && c.endDate ? (
                <span className="asd-conflicts-dates">
                  {' '}
                  ({c.startDate} → {c.endDate})
                </span>
              ) : c.date ? (
                <span className="asd-conflicts-dates"> ({c.date})</span>
              ) : null}
            </li>
          ))}
          {conflicts.length > 5 && (
            <li className="asd-conflicts-more">… et {conflicts.length - 5} de plus</li>
          )}
        </ul>
        <div className="asd-conflicts-hint">
          Vous pouvez creer l&apos;affectation quand meme ; le serveur enregistrera un warning.
        </div>
      </div>
    </InlineAlert>
  );
}
