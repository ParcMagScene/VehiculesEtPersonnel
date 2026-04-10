import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import Card from '../components/ui/Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Contenu</Card>);
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });

  it('has ui-card class', () => {
    const { container } = render(<Card>X</Card>);
    expect(container.querySelector('.ui-card')).toBeInTheDocument();
  });

  it('forwards ref', () => {
    const ref = createRef();
    render(<Card ref={ref}>X</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('applies flat class', () => {
    const { container } = render(<Card flat>X</Card>);
    expect(container.querySelector('.ui-card--flat')).toBeInTheDocument();
  });

  it('applies compact class', () => {
    const { container } = render(<Card compact>X</Card>);
    expect(container.querySelector('.ui-card--compact')).toBeInTheDocument();
  });

  it('applies clickable class and role="button" when onClick', () => {
    const { container } = render(<Card onClick={() => {}}>X</Card>);
    expect(container.querySelector('.ui-card--clickable')).toBeInTheDocument();
    expect(container.querySelector('[role="button"]')).toBeInTheDocument();
  });

  it('has tabIndex=0 when clickable', () => {
    const { container } = render(<Card onClick={() => {}}>X</Card>);
    expect(container.querySelector('.ui-card')).toHaveAttribute('tabindex', '0');
  });

  it('calls onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Card onClick={onClick}>Click me</Card>);
    await user.click(screen.getByText('Click me'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('has no role or tabIndex when not clickable', () => {
    const { container } = render(<Card>X</Card>);
    const card = container.querySelector('.ui-card');
    expect(card).not.toHaveAttribute('role');
    expect(card).not.toHaveAttribute('tabindex');
  });

  it('merges custom className', () => {
    const { container } = render(<Card className="extra">X</Card>);
    expect(container.querySelector('.ui-card.extra')).toBeInTheDocument();
  });

  it('passes style prop', () => {
    const { container } = render(<Card style={{ background: 'red' }}>X</Card>);
    expect(container.querySelector('.ui-card').style.background).toBe('red');
  });
});
