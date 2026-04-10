import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import Textarea from '../components/ui/Textarea';

describe('Textarea', () => {
  it('rend un textarea', () => {
    render(<Textarea data-testid="ta" />);
    expect(screen.getByTestId('ta').tagName).toBe('TEXTAREA');
  });

  it('applique la classe de base', () => {
    render(<Textarea data-testid="ta" />);
    expect(screen.getByTestId('ta')).toHaveClass('ui-textarea');
  });

  it.each(['sm', 'md', 'lg'])('size %s ajoute la classe', (s) => {
    render(<Textarea data-testid="ta" size={s} />);
    expect(screen.getByTestId('ta')).toHaveClass(`ui-textarea--${s}`);
  });

  it('sans size pas de classe de taille', () => {
    render(<Textarea data-testid="ta" />);
    const cls = screen.getByTestId('ta').className;
    expect(cls).not.toMatch(/ui-textarea--sm|ui-textarea--md|ui-textarea--lg/);
  });

  it('error ajoute la classe et aria-invalid', () => {
    render(<Textarea data-testid="ta" error />);
    expect(screen.getByTestId('ta')).toHaveClass('ui-textarea--error');
    expect(screen.getByTestId('ta')).toHaveAttribute('aria-invalid', 'true');
  });

  it('disabled ajoute la classe', () => {
    render(<Textarea data-testid="ta" disabled />);
    expect(screen.getByTestId('ta')).toHaveClass('ui-textarea--disabled');
    expect(screen.getByTestId('ta')).toBeDisabled();
  });

  it('forward ref', () => {
    const ref = createRef();
    render(<Textarea ref={ref} data-testid="ta" />);
    expect(ref.current).toBe(screen.getByTestId('ta'));
  });

  it('applique className supplémentaire', () => {
    render(<Textarea data-testid="ta" className="custom" />);
    expect(screen.getByTestId('ta')).toHaveClass('ui-textarea', 'custom');
  });

  it('passe les props au textarea natif', () => {
    render(<Textarea data-testid="ta" rows={5} placeholder="Tapez ici" />);
    const ta = screen.getByTestId('ta');
    expect(ta).toHaveAttribute('rows', '5');
    expect(ta).toHaveAttribute('placeholder', 'Tapez ici');
  });
});
