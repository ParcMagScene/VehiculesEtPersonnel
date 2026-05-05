import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FormActions, FormLayout, FormRow, FormSection } from '../components/ui/FormLayout';

describe('FormLayout', () => {
  it('rend un div sans onSubmit', () => {
    const { container } = render(<FormLayout>contenu</FormLayout>);
    expect(container.firstChild.tagName).toBe('DIV');
    expect(container.firstChild).toHaveClass('ui-form-layout');
  });

  it('rend un form avec onSubmit', () => {
    const { container } = render(<FormLayout onSubmit={() => {}}>contenu</FormLayout>);
    expect(container.firstChild.tagName).toBe('FORM');
  });

  it('onSubmit empêche le comportement par défaut', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <FormLayout onSubmit={onSubmit}>
        <button type="submit">Go</button>
      </FormLayout>,
    );
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('applique className', () => {
    const { container } = render(<FormLayout className="extra">x</FormLayout>);
    expect(container.firstChild).toHaveClass('ui-form-layout', 'extra');
  });
});

describe('FormSection', () => {
  it('rend un fieldset', () => {
    const { container } = render(<FormSection>champs</FormSection>);
    expect(container.firstChild.tagName).toBe('FIELDSET');
    expect(container.firstChild).toHaveClass('ui-form-section');
  });

  it('affiche le titre dans une legend', () => {
    render(<FormSection title="Identité">champs</FormSection>);
    expect(screen.getByText('Identité')).toBeInTheDocument();
  });

  it('affiche la description', () => {
    render(
      <FormSection title="T" description="desc">
        x
      </FormSection>,
    );
    expect(screen.getByText('desc')).toHaveClass('ui-form-section-desc');
  });
});

describe('FormRow', () => {
  it('rend les enfants dans une rangée', () => {
    render(
      <FormRow>
        <span>A</span>
        <span>B</span>
      </FormRow>,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('applique grid-template-columns avec columns numérique', () => {
    const { container } = render(<FormRow columns={3}>x</FormRow>);
    expect(container.firstChild).toHaveStyle({ gridTemplateColumns: 'repeat(3, 1fr)' });
  });
});

describe('FormActions', () => {
  it('rend les boutons', () => {
    render(
      <FormActions>
        <button>OK</button>
      </FormActions>,
    );
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('align end par défaut', () => {
    const { container } = render(<FormActions>x</FormActions>);
    expect(container.firstChild).toHaveClass('ui-form-actions--end');
  });

  it('align start', () => {
    const { container } = render(<FormActions align="start">x</FormActions>);
    expect(container.firstChild).toHaveClass('ui-form-actions--start');
  });
});
