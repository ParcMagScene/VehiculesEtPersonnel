import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Badge, Tag } from '../components/ui/Tag';

describe('Tag', () => {
  it('renders children text', () => {
    render(<Tag>React</Tag>);
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('applies color class', () => {
    const { container } = render(<Tag color="success">OK</Tag>);
    expect(container.querySelector('.ui-tag--success')).toBeInTheDocument();
  });

  it('defaults to primary color', () => {
    const { container } = render(<Tag>X</Tag>);
    expect(container.querySelector('.ui-tag--primary')).toBeInTheDocument();
  });

  it('applies size class', () => {
    const { container } = render(<Tag size="sm">X</Tag>);
    expect(container.querySelector('.ui-tag--sm')).toBeInTheDocument();
  });

  it('shows close button when closeable', () => {
    render(<Tag closeable>X</Tag>);
    expect(screen.getByLabelText('Supprimer')).toBeInTheDocument();
  });

  it('does not show close button by default', () => {
    render(<Tag>X</Tag>);
    expect(screen.queryByLabelText('Supprimer')).toBeNull();
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Tag closeable onClose={onClose}>
        X
      </Tag>,
    );
    await user.click(screen.getByLabelText('Supprimer'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('merges custom className', () => {
    const { container } = render(<Tag className="extra">X</Tag>);
    expect(container.querySelector('.ui-tag.extra')).toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge count={5}>Notifications</Badge>);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('displays count', () => {
    render(<Badge count={42}>X</Badge>);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('caps count at max (default 99)', () => {
    render(<Badge count={150}>X</Badge>);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('caps count at custom max', () => {
    render(
      <Badge count={15} max={10}>
        X
      </Badge>,
    );
    expect(screen.getByText('10+')).toBeInTheDocument();
  });

  it('does not show badge when count is 0', () => {
    const { container } = render(<Badge count={0}>X</Badge>);
    expect(container.querySelector('.ui-badge--count')).toBeNull();
  });

  it('does not show badge when count is null', () => {
    const { container } = render(<Badge>X</Badge>);
    expect(container.querySelector('.ui-badge--count')).toBeNull();
  });

  it('renders dot badge', () => {
    const { container } = render(<Badge dot>X</Badge>);
    expect(container.querySelector('.ui-badge--dot')).toBeInTheDocument();
  });

  it('applies color class', () => {
    const { container } = render(
      <Badge count={1} color="success">
        X
      </Badge>,
    );
    expect(container.querySelector('.ui-badge--success')).toBeInTheDocument();
  });

  it('defaults to danger color', () => {
    const { container } = render(<Badge count={1}>X</Badge>);
    expect(container.querySelector('.ui-badge--danger')).toBeInTheDocument();
  });
});
