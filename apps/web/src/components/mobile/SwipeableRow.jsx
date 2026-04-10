import React from 'react';
import './SwipeableRow.css';

/**
 * Ligne swipeable avec actions gauche/droite.
 * @param {{ swipeState, itemId, leftAction, rightAction, children, onReset }} props
 * leftAction / rightAction : { label, icon, color, onClick }
 */
export default function SwipeableRow({ swipeState, itemId, leftAction, rightAction, children, getSwipeProps, onReset }) {
  const isActive = swipeState.id === itemId;
  const offset = isActive ? swipeState.offset : 0;
  const direction = isActive ? swipeState.direction : null;

  const translateX = direction === 'right' ? offset : direction === 'left' ? -offset : 0;

  const handleAction = (action) => {
    if (action?.onClick) action.onClick();
    if (onReset) onReset();
  };

  return (
    <div className="swipeable-row" {...(getSwipeProps ? getSwipeProps(itemId) : {})}>
      {/* Action gauche (swipe vers la droite) */}
      {leftAction && (
        <div
          className="swipeable-action swipeable-action-left"
          style={{ backgroundColor: leftAction.color || 'var(--accent)', width: offset, opacity: direction === 'right' ? 1 : 0 }}
          onClick={() => handleAction(leftAction)}
        >
          {leftAction.icon && <span className="swipeable-action-icon">{leftAction.icon}</span>}
          {offset > 50 && <span className="swipeable-action-label">{leftAction.label}</span>}
        </div>
      )}

      {/* Contenu principal */}
      <div
        className="swipeable-row-content"
        style={{ transform: `translateX(${translateX}px)`, transition: isActive && offset > 0 ? 'none' : 'transform 0.25s ease' }}
      >
        {children}
      </div>

      {/* Action droite (swipe vers la gauche) */}
      {rightAction && (
        <div
          className="swipeable-action swipeable-action-right"
          style={{ backgroundColor: rightAction.color || '#e74c3c', width: offset, opacity: direction === 'left' ? 1 : 0 }}
          onClick={() => handleAction(rightAction)}
        >
          {rightAction.icon && <span className="swipeable-action-icon">{rightAction.icon}</span>}
          {offset > 50 && <span className="swipeable-action-label">{rightAction.label}</span>}
        </div>
      )}
    </div>
  );
}
