import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DetailRow from '../components/ui/DetailRow';

describe('DetailRow', () => {
  it('affiche le label et la valeur', () => {
    render(<DetailRow label="Client" value="Dupont SA" />);
    expect(screen.getByText('Client')).toHaveClass('ui-detail-row__label');
    expect(screen.getByText('Dupont SA')).toHaveClass('ui-detail-row__value');
  });

  it('children prime sur value', () => {
    render(
      <DetailRow label="Période" value="fallback">
        <strong>Custom</strong>
      </DetailRow>,
    );
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });

  it("affiche l'icône", () => {
    render(<DetailRow label="L" value="V" icon={<span data-testid="ico">📅</span>} />);
    expect(screen.getByTestId('ico')).toBeInTheDocument();
  });

  it("pas d'icône par défaut", () => {
    const { container } = render(<DetailRow label="L" value="V" />);
    expect(container.querySelector('.ui-detail-row__icon')).toBeNull();
  });

  it('applique className supplémentaire', () => {
    const { container } = render(<DetailRow label="L" value="V" className="extra" />);
    expect(container.firstChild).toHaveClass('ui-detail-row', 'extra');
  });

  it('structure correcte (label + value)', () => {
    const { container } = render(<DetailRow label="L" value="V" />);
    expect(container.firstChild).toHaveClass('ui-detail-row');
    expect(container.querySelectorAll('.ui-detail-row__label')).toHaveLength(1);
    expect(container.querySelectorAll('.ui-detail-row__value')).toHaveLength(1);
  });
});
