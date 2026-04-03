/**
 * DetailRow — Ligne label : valeur pour les fiches détail
 *
 * <DetailRow label="Client" value={affaire.client || '—'} />
 * <DetailRow label="Période" icon={<Calendar size={12} />}>contenu complexe</DetailRow>
 */
import './DetailRow.css';

export default function DetailRow({ label, value, icon, className, children }) {
  return (
    <div className={`ui-detail-row${className ? ' ' + className : ''}`}>
      {icon && <span className="ui-detail-row__icon">{icon}</span>}
      <span className="ui-detail-row__label">{label}</span>
      <span className="ui-detail-row__value">{children || value}</span>
    </div>
  );
}
