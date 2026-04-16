import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import Select from '../components/ui/Select';

describe('Select', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
    { value: 'c', label: 'Option C', disabled: true },
  ];

  /* ─── Mode bare (children) ─── */
  it('renders bare select with children', () => {
    const { container } = render(
      <Select>
        <option value="x">X</option>
      </Select>,
    );
    expect(container.querySelector('.ui-select')).toBeInTheDocument();
    expect(container.querySelector('.ui-select-wrapper')).toBeNull();
  });

  it('forwards ref in bare mode', () => {
    const ref = createRef();
    render(
      <Select ref={ref}>
        <option value="1">Un</option>
      </Select>,
    );
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  it('applies size class in bare mode', () => {
    const { container } = render(
      <Select size="lg">
        <option value="1">Un</option>
      </Select>,
    );
    expect(container.querySelector('.ui-select--lg')).toBeInTheDocument();
  });

  it('applies error class and aria-invalid in bare mode', () => {
    const { container } = render(
      <Select error>
        <option value="1">Un</option>
      </Select>,
    );
    expect(container.querySelector('.ui-select--error')).toBeInTheDocument();
    expect(container.querySelector('.ui-select')).toHaveAttribute('aria-invalid', 'true');
  });

  it('applies fullWidth class in bare mode', () => {
    const { container } = render(
      <Select fullWidth>
        <option value="1">Un</option>
      </Select>,
    );
    expect(container.querySelector('.ui-select--full')).toBeInTheDocument();
  });

  it('applies disabled class in bare mode', () => {
    const { container } = render(
      <Select disabled>
        <option value="1">Un</option>
      </Select>,
    );
    expect(container.querySelector('.ui-select--disabled')).toBeInTheDocument();
    expect(container.querySelector('.ui-select')).toBeDisabled();
  });

  /* ─── Mode options (wrapper + chevron) ─── */
  it('renders wrapper with chevron in options mode', () => {
    const { container } = render(<Select options={options} />);
    expect(container.querySelector('.ui-select-wrapper')).toBeInTheDocument();
    expect(container.querySelector('.ui-select-chevron')).toBeInTheDocument();
  });

  it('renders all options from options prop', () => {
    render(<Select options={options} />);
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
  });

  it('renders placeholder as first option', () => {
    render(<Select options={options} placeholder="Choisir..." />);
    const placeholderOpt = screen.getByText('Choisir...');
    expect(placeholderOpt).toBeInTheDocument();
    expect(placeholderOpt).toHaveAttribute('value', '');
  });

  it('disables individual options', () => {
    render(<Select options={options} />);
    expect(screen.getByText('Option C').closest('option')).toBeDisabled();
  });

  it('applies wrapper size class (defaults to md)', () => {
    const { container } = render(<Select options={options} />);
    expect(container.querySelector('.ui-select-wrapper--md')).toBeInTheDocument();
  });

  it('applies wrapper size class when specified', () => {
    const { container } = render(<Select options={options} size="sm" />);
    expect(container.querySelector('.ui-select-wrapper--sm')).toBeInTheDocument();
  });

  it('applies wrapper error class', () => {
    const { container } = render(<Select options={options} error />);
    expect(container.querySelector('.ui-select-wrapper--error')).toBeInTheDocument();
  });

  it('applies wrapper disabled class', () => {
    const { container } = render(<Select options={options} disabled />);
    expect(container.querySelector('.ui-select-wrapper--disabled')).toBeInTheDocument();
  });

  it('applies wrapper fullWidth class', () => {
    const { container } = render(<Select options={options} fullWidth />);
    expect(container.querySelector('.ui-select-wrapper--full')).toBeInTheDocument();
  });

  it('chevron is aria-hidden', () => {
    const { container } = render(<Select options={options} />);
    expect(container.querySelector('.ui-select-chevron')).toHaveAttribute('aria-hidden', 'true');
  });

  it('forwards ref in options mode', () => {
    const ref = createRef();
    render(<Select ref={ref} options={options} />);
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  /* ─── Interaction ─── */
  it('calls onChange when selecting', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'b');
    expect(onChange).toHaveBeenCalled();
  });

  /* ─── className custom ─── */
  it('merges custom className in bare mode', () => {
    const { container } = render(
      <Select className="my-class">
        <option value="1">Un</option>
      </Select>,
    );
    expect(container.querySelector('.ui-select.my-class')).toBeInTheDocument();
  });
});
