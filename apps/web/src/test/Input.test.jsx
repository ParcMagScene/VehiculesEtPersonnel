import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import Input from '../components/ui/Input';

describe('Input', () => {
  /* ─── Rendu de base ─── */
  it('renders an input element', () => {
    render(<Input placeholder="Saisir" />);
    expect(screen.getByPlaceholderText('Saisir')).toBeInTheDocument();
  });

  it('forwards ref', () => {
    const ref = createRef();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  /* ─── Mode bare (pas de prefix/suffix) ─── */
  it('renders bare input without wrapper div', () => {
    const { container } = render(<Input data-testid="bare" />);
    expect(container.querySelector('.ui-input-wrapper')).toBeNull();
    expect(container.querySelector('.ui-input')).toBeInTheDocument();
  });

  /* ─── Tailles ─── */
  it.each(['sm', 'md', 'lg'])('applies size class ui-input--%s', (size) => {
    const { container } = render(<Input size={size} />);
    expect(container.querySelector(`.ui-input--${size}`)).toBeInTheDocument();
  });

  it('has no size class when size is omitted', () => {
    const { container } = render(<Input />);
    const input = container.querySelector('.ui-input');
    expect(input.className).not.toMatch(/ui-input--sm|ui-input--md|ui-input--lg/);
  });

  /* ─── État error ─── */
  it('applies error class and aria-invalid', () => {
    const { container } = render(<Input error placeholder="err" />);
    const input = screen.getByPlaceholderText('err');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('.ui-input--error')).toBeInTheDocument();
  });

  it('does not set aria-invalid when no error', () => {
    render(<Input placeholder="ok" />);
    expect(screen.getByPlaceholderText('ok')).not.toHaveAttribute('aria-invalid');
  });

  /* ─── État disabled ─── */
  it('applies disabled class when disabled', () => {
    const { container } = render(<Input disabled placeholder="dis" />);
    expect(screen.getByPlaceholderText('dis')).toBeDisabled();
    expect(container.querySelector('.ui-input--disabled')).toBeInTheDocument();
  });

  /* ─── className custom ─── */
  it('merges custom className', () => {
    const { container } = render(<Input className="custom-class" />);
    expect(container.querySelector('.ui-input.custom-class')).toBeInTheDocument();
  });

  /* ─── Mode wrapper (prefix / suffix) ─── */
  it('renders wrapper div when prefix is provided', () => {
    const { container } = render(<Input prefix={<span>€</span>} placeholder="prix" />);
    expect(container.querySelector('.ui-input-wrapper')).toBeInTheDocument();
    expect(container.querySelector('.ui-input__prefix')).toBeInTheDocument();
    expect(container.querySelector('.ui-input-wrapper--has-prefix')).toBeInTheDocument();
  });

  it('renders wrapper div when suffix is provided', () => {
    const { container } = render(<Input suffix={<span>kg</span>} placeholder="poids" />);
    expect(container.querySelector('.ui-input-wrapper')).toBeInTheDocument();
    expect(container.querySelector('.ui-input__suffix')).toBeInTheDocument();
    expect(container.querySelector('.ui-input-wrapper--has-suffix')).toBeInTheDocument();
  });

  it('renders both prefix and suffix', () => {
    const { container } = render(<Input prefix={<span>A</span>} suffix={<span>B</span>} />);
    expect(container.querySelector('.ui-input__prefix')).toBeInTheDocument();
    expect(container.querySelector('.ui-input__suffix')).toBeInTheDocument();
  });

  it('applies wrapper size class (defaults to md)', () => {
    const { container } = render(<Input prefix={<span>X</span>} />);
    expect(container.querySelector('.ui-input-wrapper--md')).toBeInTheDocument();
  });

  it('applies wrapper error class', () => {
    const { container } = render(<Input prefix={<span>X</span>} error />);
    expect(container.querySelector('.ui-input-wrapper--error')).toBeInTheDocument();
  });

  it('applies wrapper disabled class', () => {
    const { container } = render(<Input prefix={<span>X</span>} disabled />);
    expect(container.querySelector('.ui-input-wrapper--disabled')).toBeInTheDocument();
  });

  /* ─── Interaction ─── */
  it('calls onChange when typing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input placeholder="type" onChange={onChange} />);
    await user.type(screen.getByPlaceholderText('type'), 'a');
    expect(onChange).toHaveBeenCalled();
  });
});
