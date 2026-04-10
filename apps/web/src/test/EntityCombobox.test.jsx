import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityCombobox from '../components/ui/EntityCombobox';

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const options = [
  { id: '1', label: 'Alpha' },
  { id: '2', label: 'Bravo' },
  { id: '3', label: 'Charlie' },
];

describe('EntityCombobox', () => {
  it('affiche le placeholder par défaut', () => {
    render(<EntityCombobox value="" onChange={() => {}} options={options} />);
    expect(screen.getByText('— Choisir —')).toBeInTheDocument();
  });

  it('affiche le label de la valeur sélectionnée', () => {
    render(<EntityCombobox value="2" onChange={() => {}} options={options} />);
    expect(screen.getByText('Bravo')).toBeInTheDocument();
  });

  it('placeholder personnalisé', () => {
    render(<EntityCombobox value="" onChange={() => {}} options={options} placeholder="Choisir…" />);
    expect(screen.getByText('Choisir…')).toBeInTheDocument();
  });

  it('ouvre la liste au clic', async () => {
    const user = userEvent.setup();
    const { container } = render(<EntityCombobox value="" onChange={() => {}} options={options} />);
    await user.click(container.querySelector('.ecb-control'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('sélectionne une option au clic', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<EntityCombobox value="" onChange={onChange} options={options} />);
    await user.click(container.querySelector('.ecb-control'));
    // mouseDown sur l'option
    const opt = screen.getByRole('option', { name: 'Charlie' });
    await user.pointer({ keys: '[MouseLeft>]', target: opt });
    expect(onChange).toHaveBeenCalledWith('3');
  });

  it('filtre les options en tapant', async () => {
    const user = userEvent.setup();
    const { container } = render(<EntityCombobox value="" onChange={() => {}} options={options} />);
    await user.click(container.querySelector('.ecb-control'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Alp' } });
    const opts = screen.getAllByRole('option');
    expect(opts).toHaveLength(1);
    expect(opts[0]).toHaveTextContent('Alpha');
  });

  it('affiche "Aucun résultat" si filtre vide', async () => {
    const user = userEvent.setup();
    const { container } = render(<EntityCombobox value="" onChange={() => {}} options={options} />);
    await user.click(container.querySelector('.ecb-control'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('Aucun résultat')).toBeInTheDocument();
  });

  it('aria-selected sur l\'option active', async () => {
    const user = userEvent.setup();
    const { container } = render(<EntityCombobox value="1" onChange={() => {}} options={options} />);
    await user.click(container.querySelector('.ecb-control'));
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Bravo' })).toHaveAttribute('aria-selected', 'false');
  });

  it('bouton clear appelle onChange avec vide', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <EntityCombobox value="1" onChange={onChange} options={options} allowClear />
    );
    const clearBtn = container.querySelector('.ecb-clear');
    expect(clearBtn).toBeInTheDocument();
    await user.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('disabled empêche l\'ouverture', async () => {
    const user = userEvent.setup();
    const { container } = render(<EntityCombobox value="" onChange={() => {}} options={options} disabled />);
    await user.click(container.querySelector('.ecb-control'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('accepte des options avec name au lieu de label', () => {
    const opts = [{ id: '1', name: 'Fournisseur A' }];
    render(<EntityCombobox value="1" onChange={() => {}} options={opts} />);
    expect(screen.getByText('Fournisseur A')).toBeInTheDocument();
  });
});
