import React from 'react';
import './ui.css';

/**
 * Table — Tableau standardisé
 *
 * Mode bare (children fournis) :
 *   <Table className="my-table">
 *     <thead>…</thead><tbody>…</tbody>
 *   </Table>
 *   → rend un <table> nu avec className passé directement.
 *
 * Mode déclaratif (columns + data) :
 *   <Table columns={cols} data={rows} striped compact />
 *   → rend un <table> enveloppé dans un wrapper scrollable.
 */
function Table({
  columns,
  data = [],
  rowKey,
  striped = false,
  compact = false,
  onRowClick,
  emptyMessage = 'Aucune donnée',
  className = '',
  maxHeight,
  style,
  children,
  ...rest
}) {
  /* ── Mode bare : children pass-through ── */
  if (children) {
    const cls = [className].filter(Boolean).join(' ');
    return (
      <table className={cls || undefined} style={style} {...rest}>
        {children}
      </table>
    );
  }

  /* ── Mode déclaratif : columns + data ── */
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
            {(columns || []).map((col) => (
              <th key={col.key} style={{ width: col.width, textAlign: col.align || 'left' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={(columns || []).length} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--theme-text-muted)' }}>
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
                {(columns || []).map((col) => (
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
