import './ui.css';

import React from 'react';

/**
 * ScrollArea — Conteneur scrollable avec scrollbars unifiées
 *
 * @param {number}  maxHeight  Hauteur max en px
 * @param {boolean} thin       Scrollbar fine (4px)
 * @param {boolean} horizontal Scroll horizontal au lieu de vertical
 * @param {boolean} both       Scroll dans les deux axes
 * @param {string}  className  Classes additionnelles
 */
const ScrollArea = React.forwardRef(function ScrollArea(
  {
    maxHeight,
    thin = false,
    horizontal = false,
    both = false,
    className = '',
    style,
    children,
    ...rest
  },
  ref,
) {
  const cls = [
    'ui-scroll-area',
    thin && 'ui-scroll-area--thin',
    horizontal && 'ui-scroll-area--horizontal',
    both && 'ui-scroll-area--both',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const mergedStyle = maxHeight ? { ...style, maxHeight: `${maxHeight}px` } : style;

  return (
    <div ref={ref} className={cls} style={mergedStyle} {...rest}>
      {children}
    </div>
  );
});

export default ScrollArea;
