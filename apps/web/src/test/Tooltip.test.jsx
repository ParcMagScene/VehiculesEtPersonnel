import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Tooltip from '../components/ui/Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children', () => {
    render(<Tooltip content="Info">Hover me</Tooltip>);
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('does not show tooltip by default', () => {
    render(<Tooltip content="Info">Hover me</Tooltip>);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows tooltip on mouseEnter after delay', () => {
    render(
      <Tooltip content="Info" delay={200}>
        Hover me
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByText('Hover me'));
    // Pas encore visible
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Info');
  });

  it('hides tooltip on mouseLeave', () => {
    render(
      <Tooltip content="Info" delay={0}>
        Hover me
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByText('Hover me'));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByText('Hover me'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('applies position class', () => {
    render(
      <Tooltip content="Info" position="bottom" delay={0}>
        Hover me
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByText('Hover me'));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByRole('tooltip')).toHaveClass('ui-tooltip--bottom');
  });

  it('defaults to top position', () => {
    render(
      <Tooltip content="Info" delay={0}>
        Hover me
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByText('Hover me'));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByRole('tooltip')).toHaveClass('ui-tooltip--top');
  });

  it('renders children directly when no content', () => {
    const { container } = render(<Tooltip>Just text</Tooltip>);
    expect(screen.getByText('Just text')).toBeInTheDocument();
    expect(container.querySelector('.ui-tooltip-trigger')).toBeNull();
  });

  it('shows tooltip on focus', () => {
    render(
      <Tooltip content="Focus info" delay={0}>
        <button>Click</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByText('Click'));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Focus info');
  });

  it('merges custom className', () => {
    const { container } = render(
      <Tooltip content="X" className="custom">
        Text
      </Tooltip>,
    );
    expect(container.querySelector('.ui-tooltip-trigger.custom')).toBeInTheDocument();
  });
});
