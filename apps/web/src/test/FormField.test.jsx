import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import FormField from '../components/ui/FormField';

describe('FormField', () => {
  it('affiche le label', () => {
    render(
      <FormField label="Nom" htmlFor="name">
        <input id="name" />
      </FormField>,
    );
    expect(screen.getByText('Nom')).toBeInTheDocument();
  });

  it('label est un <label> avec htmlFor', () => {
    render(
      <FormField label="Nom" htmlFor="name">
        <input id="name" />
      </FormField>,
    );
    expect(screen.getByText('Nom').tagName).toBe('LABEL');
    expect(screen.getByText('Nom')).toHaveAttribute('for', 'name');
  });

  it('required ajoute la classe', () => {
    render(
      <FormField label="Nom" required>
        <input />
      </FormField>,
    );
    expect(screen.getByText('Nom')).toHaveClass('ui-form-label--required');
  });

  it('affiche le hint', () => {
    render(
      <FormField label="Nom" hint="Aide">
        <input />
      </FormField>,
    );
    expect(screen.getByText('Aide')).toHaveClass('ui-form-hint');
  });

  it("affiche l'erreur et masque le hint", () => {
    render(
      <FormField label="Nom" hint="Aide" error="Obligatoire">
        <input />
      </FormField>,
    );
    expect(screen.getByText('Obligatoire')).toHaveClass('ui-form-error');
    expect(screen.queryByText('Aide')).not.toBeInTheDocument();
  });

  it("pas de hint ni d'erreur sans ces props", () => {
    const { container } = render(
      <FormField label="Nom">
        <input />
      </FormField>,
    );
    expect(container.querySelector('.ui-form-hint')).toBeNull();
    expect(container.querySelector('.ui-form-error')).toBeNull();
  });

  it('horizontal ajoute la classe', () => {
    const { container } = render(
      <FormField label="Nom" horizontal>
        <input />
      </FormField>,
    );
    expect(container.firstChild).toHaveClass('ui-form-field--horizontal');
  });

  it('rend les enfants', () => {
    render(
      <FormField label="Nom">
        <input data-testid="input" />
      </FormField>,
    );
    expect(screen.getByTestId('input')).toBeInTheDocument();
  });

  it('applique className supplémentaire', () => {
    const { container } = render(
      <FormField label="Nom" className="extra">
        <input />
      </FormField>,
    );
    expect(container.firstChild).toHaveClass('ui-form-field', 'extra');
  });

  it('sans label ne rend pas de <label>', () => {
    const { container } = render(
      <FormField>
        <input />
      </FormField>,
    );
    expect(container.querySelector('label')).toBeNull();
  });

  it('auto-injecte un id sur le child et le lie au label via htmlFor', () => {
    const { container } = render(
      <FormField label="Email">
        <input />
      </FormField>,
    );
    const input = container.querySelector('input');
    const label = container.querySelector('label');
    expect(input.id).toBeTruthy();
    expect(label.getAttribute('for')).toBe(input.id);
  });

  it("n'écrase pas l'id existant du child", () => {
    const { container } = render(
      <FormField label="Email" htmlFor="custom">
        <input id="custom" />
      </FormField>,
    );
    expect(container.querySelector('input').id).toBe('custom');
    expect(container.querySelector('label').getAttribute('for')).toBe('custom');
  });

  it("injecte aria-describedby vers l'erreur", () => {
    const { container } = render(
      <FormField label="Nom" error="Requis">
        <input />
      </FormField>,
    );
    const input = container.querySelector('input');
    const errorId = container.querySelector('.ui-form-error').id;
    expect(input.getAttribute('aria-describedby')).toBe(errorId);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});
