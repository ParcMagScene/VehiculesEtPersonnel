import './AffaireLegend.css';

import { Info } from 'lucide-react';

import { Button, Tooltip } from '@/design-system';

import { AFFAIRE_TYPES } from '../utils/affaireConstants';

/**
 * AffaireLegend — Petit bouton d'aide qui affiche au survol la legende
 * des couleurs/types d'affaires. A poser dans les toolbars Calendar.
 */
const legendContent = (
  <div className="affaire-legend">
    <div className="affaire-legend-title">Types d&apos;affaires</div>
    {AFFAIRE_TYPES.map((t) => (
      <div key={t.value} className="affaire-legend-row">
        <span className="affaire-legend-dot" style={{ background: t.color }} aria-hidden="true" />
        <span className="affaire-legend-icon" aria-hidden="true">
          {t.icon}
        </span>
        <span className="affaire-legend-label">{t.label}</span>
      </div>
    ))}
  </div>
);

function AffaireLegend({ className = '' }) {
  return (
    <Tooltip content={legendContent} position="bottom">
      <Button
        className={`affaire-legend-trigger ${className}`.trim()}
        aria-label="Legende des couleurs d'affaires"
      >
        <Info size={14} />
        <span>Légende</span>
      </Button>
    </Tooltip>
  );
}

export default AffaireLegend;
