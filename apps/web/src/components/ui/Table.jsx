import React from 'react';
import './ui.css';

/**
 * Table — Tableau standardisé avec striping, hover, sticky header
 *
 * @param {Array<{key, label, width?, align?, render?}>} columns  Définition des colonnes
 * @param {Array<Object>} data      Données (chaque objet doit avoir un `id` ou utiliser `rowKey`)
 * @param {function} rowKey         Fonction (row, index) => key unique
 * @param {boolean}  striped        Alternance de couleurs
 * @param {boolean}  compact        Padding réduit
 * @param {function} onRowClick     Callback (row, index) au clic sur une ligne
 * @param {string}   emptyMessage   Message quand data est vide
 * @param {string}   className      Classes additionnelles
 * @param {number}   maxHeight      Hauteur max avec scroll (px)
 */
function Table({
  columns = [],
  data = [],
  rowKey,
  striped = false,
  compact = false,
  onRowClick,
  emptyMessage = 'Aucune donnée',
  className = '',
  maxHeight,
  style,
  ...rest
}) {
  const tableCls = [
    'ui-table',
    striped && 'ui-table--striped',
    compact && 'ui-table--compact',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const wrapperStyle = maxHeight
    ? { ...style, maxHeight: `${maxHeight}px`, overflowY: 'auto' }
    : style;

  const getKey = (row, idx) => {
    if (rowKey) return rowKey(row, idx);
    return row.id ?? idx;
  };

  return (
    <div className="ui-table-wrapper ui-scroll-area" style={wrapperStyle} {...rest}>
      <table className={tableCls}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ width: col.width, textAlign: col.align || 'left' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--theme-text-muted)' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={getKey(row, idx)}
                onClick={onRowClick ? () => onRowClick(row, idx) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                    {col.render ? col.render(row[col.key], row, idx) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
