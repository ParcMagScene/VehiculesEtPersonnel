/**
 * ListItem — Élément de liste structuré
 *
 * Usage :
 *   <ListItem
 *     icon={<Package size={18}/>}
 *     title="Équipement #1234"
 *     description="Perceuse électrique"
 *     meta="Il y a 2h"
 *     actions={<Button variant="ghost" iconOnly size="xs"><Trash size={14}/></Button>}
 *     onClick={() => openDetail(1234)}
 *   />
 */
export default function ListItem({
  icon,
  avatar,
  title,
  description,
  meta,
  actions,
  selected = false,
  onClick,
  className = '',
  ...props
}) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`ui-list-item ${selected ? 'ui-list-item--selected' : ''} ${onClick ? 'ui-list-item--clickable' : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {(icon || avatar) && (
        <span className="ui-list-item__visual">
          {icon || avatar}
        </span>
      )}
      <div className="ui-list-item__content">
        {title && <span className="ui-list-item__title">{title}</span>}
        {description && <span className="ui-list-item__desc">{description}</span>}
        {meta && <span className="ui-list-item__meta">{meta}</span>}
      </div>
      {actions && (
        <div className="ui-list-item__actions" onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </Tag>
  );
}
