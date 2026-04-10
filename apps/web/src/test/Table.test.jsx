import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Table from '../components/ui/Table';

const columns = [
  { key: 'name', label: 'Nom' },
  { key: 'age', label: 'Âge', align: 'right', width: '80px' },
];

const data = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
  { id: 3, name: 'Charlie', age: 35 },
];

describe('Table', () => {
  /* ─── Mode bare (children) ─── */
  it('renders bare table with children', () => {
    const { container } = render(
      <Table className="my-table">
        <thead><tr><th>Col</th></tr></thead>
        <tbody><tr><td>Val</td></tr></tbody>
      </Table>
    );
    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
    expect(table).toHaveClass('my-table');
    expect(container.querySelector('.ui-table-wrapper')).toBeNull();
  });

  it('passes style and rest props in bare mode', () => {
    render(
      <Table style={{ border: '1px solid red' }} data-testid="bare">
        <tbody><tr><td>X</td></tr></tbody>
      </Table>
    );
    expect(screen.getByTestId('bare')).toBeInTheDocument();
  });

  /* ─── Mode déclaratif (columns + data) ─── */
  it('renders wrapper and table in declarative mode', () => {
    const { container } = render(<Table columns={columns} data={data} />);
    expect(container.querySelector('.ui-table-wrapper')).toBeInTheDocument();
    expect(container.querySelector('.ui-table')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<Table columns={columns} data={data} />);
    expect(screen.getByText('Nom')).toBeInTheDocument();
    expect(screen.getByText('Âge')).toBeInTheDocument();
  });

  it('renders all data rows', () => {
    render(<Table columns={columns} data={data} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('renders cell values from data keys', () => {
    render(<Table columns={columns} data={data} />);
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  /* ─── Variantes ─── */
  it('applies striped class', () => {
    const { container } = render(<Table columns={columns} data={data} striped />);
    expect(container.querySelector('.ui-table--striped')).toBeInTheDocument();
  });

  it('applies compact class', () => {
    const { container } = render(<Table columns={columns} data={data} compact />);
    expect(container.querySelector('.ui-table--compact')).toBeInTheDocument();
  });

  it('applies both striped and compact', () => {
    const { container } = render(<Table columns={columns} data={data} striped compact />);
    const table = container.querySelector('.ui-table');
    expect(table).toHaveClass('ui-table--striped');
    expect(table).toHaveClass('ui-table--compact');
  });

  /* ─── Message vide ─── */
  it('shows default empty message when data is empty', () => {
    render(<Table columns={columns} data={[]} />);
    expect(screen.getByText('Aucune donnée')).toBeInTheDocument();
  });

  it('shows custom empty message', () => {
    render(<Table columns={columns} data={[]} emptyMessage="Pas de résultats" />);
    expect(screen.getByText('Pas de résultats')).toBeInTheDocument();
  });

  it('empty row spans all columns', () => {
    const { container } = render(<Table columns={columns} data={[]} />);
    const td = container.querySelector('tbody td');
    expect(td).toHaveAttribute('colspan', '2');
  });

  /* ─── maxHeight ─── */
  it('applies maxHeight to wrapper', () => {
    const { container } = render(<Table columns={columns} data={data} maxHeight={300} />);
    const wrapper = container.querySelector('.ui-table-wrapper');
    expect(wrapper.style.maxHeight).toBe('300px');
    expect(wrapper.style.overflowY).toBe('auto');
  });

  /* ─── Alignement colonnes ─── */
  it('applies column alignment', () => {
    const { container } = render(<Table columns={columns} data={data} />);
    const ths = container.querySelectorAll('th');
    expect(ths[0].style.textAlign).toBe('left');
    expect(ths[1].style.textAlign).toBe('right');
  });

  it('applies column width', () => {
    const { container } = render(<Table columns={columns} data={data} />);
    const ths = container.querySelectorAll('th');
    expect(ths[1].style.width).toBe('80px');
  });

  /* ─── onRowClick ─── */
  it('calls onRowClick with row and index', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Table columns={columns} data={data} onRowClick={onClick} />);
    await user.click(screen.getByText('Bob'));
    expect(onClick).toHaveBeenCalledWith(data[1], 1);
  });

  it('adds cursor pointer when onRowClick is provided', () => {
    const { container } = render(<Table columns={columns} data={data} onRowClick={() => {}} />);
    const row = container.querySelector('tbody tr');
    expect(row.style.cursor).toBe('pointer');
  });

  /* ─── Custom render ─── */
  it('uses column render function', () => {
    const cols = [
      { key: 'name', label: 'Nom', render: (val) => `**${val}**` },
    ];
    render(<Table columns={cols} data={[{ id: 1, name: 'Test' }]} />);
    expect(screen.getByText('**Test**')).toBeInTheDocument();
  });

  /* ─── rowKey ─── */
  it('uses rowKey function for key generation', () => {
    const rowKey = (row) => `row-${row.name}`;
    // Should not throw even with duplicate IDs
    const dupeData = [
      { id: 1, name: 'A', age: 1 },
      { id: 1, name: 'B', age: 2 },
    ];
    const { container } = render(<Table columns={columns} data={dupeData} rowKey={rowKey} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  /* ─── className custom ─── */
  it('merges custom className in declarative mode', () => {
    const { container } = render(<Table columns={columns} data={data} className="extra" />);
    expect(container.querySelector('.ui-table.extra')).toBeInTheDocument();
  });
});
