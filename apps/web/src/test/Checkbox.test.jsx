import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox, Toggle } from '../components/ui/Checkbox';

describe('Checkbox', () => {
  it('renders with label', () => {
    render(<Checkbox label="Activer" checked={false} onChange={() => {}} />);
    expect(screen.getByLabelText('Activer')).toBeInTheDocument();
  });

  it('is checked when checked prop is true', () => {
    render(<Checkbox label="Option" checked={true} onChange={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('calls onChange on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Cliquer" checked={false} onChange={onChange} />);
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Checkbox label="Désactivé" checked={false} onChange={() => {}} disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('has aria-checked="mixed" when indeterminate', () => {
    render(<Checkbox label="Mixte" checked={false} onChange={() => {}} indeterminate />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
  });

  it('renders in bare mode (no label)', () => {
    const { container } = render(<Checkbox checked={true} onChange={() => {}} />);
    // Bare mode: wrapper is a <span> not a <label>
    expect(container.querySelector('span.ui-checkbox')).toBeInTheDocument();
    expect(container.querySelector('label')).not.toBeInTheDocument();
  });
});

describe('Toggle', () => {
  it('renders with label', () => {
    render(<Toggle label="Notifications" checked={false} onChange={() => {}} />);
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
  });

  it('has role="switch"', () => {
    render(<Toggle label="Switch" checked={false} onChange={() => {}} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('calls onChange on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle label="Toggle" checked={false} onChange={onChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('applies size class', () => {
    const { container } = render(<Toggle label="Petit" size="sm" checked={false} onChange={() => {}} />);
    expect(container.querySelector('.ui-toggle--sm')).toBeInTheDocument();
  });

  it('is disabled when disabled', () => {
    render(<Toggle label="Off" checked={false} onChange={() => {}} disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
