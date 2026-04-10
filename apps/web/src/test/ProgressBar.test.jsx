import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressBar from '../components/ui/ProgressBar';

describe('ProgressBar', () => {
  it('renders with role progressbar', () => {
    render(<ProgressBar value={50} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('sets aria-valuenow', () => {
    render(<ProgressBar value={75} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  });

  it('clamps value to 0–100', () => {
    render(<ProgressBar value={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('applies fill width as percentage', () => {
    const { container } = render(<ProgressBar value={40} />);
    const fill = container.querySelector('.ui-progress__fill');
    expect(fill.style.width).toBe('40%');
  });

  it('applies size class', () => {
    const { container } = render(<ProgressBar value={50} size="lg" />);
    expect(container.querySelector('.ui-progress--lg')).toBeInTheDocument();
  });

  it('applies color class', () => {
    const { container } = render(<ProgressBar value={50} color="success" />);
    expect(container.querySelector('.ui-progress--success')).toBeInTheDocument();
  });

  it('defaults to md size and primary color', () => {
    const { container } = render(<ProgressBar value={50} />);
    expect(container.querySelector('.ui-progress--md')).toBeInTheDocument();
    expect(container.querySelector('.ui-progress--primary')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<ProgressBar value={50} label="50%" />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('does not render label when omitted', () => {
    const { container } = render(<ProgressBar value={50} />);
    expect(container.querySelector('.ui-progress__label')).toBeNull();
  });

  it('handles indeterminate mode', () => {
    const { container } = render(<ProgressBar indeterminate />);
    expect(container.querySelector('.ui-progress--indeterminate')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });

  it('indeterminate fill has no width style', () => {
    const { container } = render(<ProgressBar indeterminate />);
    const fill = container.querySelector('.ui-progress__fill');
    expect(fill.style.width).toBe('');
  });

  it('computes percentage from value/max', () => {
    render(<ProgressBar value={25} max={50} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('merges custom className', () => {
    const { container } = render(<ProgressBar value={0} className="extra" />);
    expect(container.querySelector('.ui-progress.extra')).toBeInTheDocument();
  });
});
