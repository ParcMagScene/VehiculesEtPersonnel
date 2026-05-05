import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import ScrollArea from '../components/ui/ScrollArea';

describe('ScrollArea', () => {
  it('rend les enfants', () => {
    const { container } = render(
      <ScrollArea>
        <p>Contenu</p>
      </ScrollArea>,
    );
    expect(container.querySelector('p')).toHaveTextContent('Contenu');
  });

  it('applique la classe de base', () => {
    const { container } = render(<ScrollArea>x</ScrollArea>);
    expect(container.firstChild).toHaveClass('ui-scroll-area');
  });

  it('thin ajoute la classe', () => {
    const { container } = render(<ScrollArea thin>x</ScrollArea>);
    expect(container.firstChild).toHaveClass('ui-scroll-area--thin');
  });

  it('horizontal ajoute la classe', () => {
    const { container } = render(<ScrollArea horizontal>x</ScrollArea>);
    expect(container.firstChild).toHaveClass('ui-scroll-area--horizontal');
  });

  it('both ajoute la classe', () => {
    const { container } = render(<ScrollArea both>x</ScrollArea>);
    expect(container.firstChild).toHaveClass('ui-scroll-area--both');
  });

  it('maxHeight applique le style inline', () => {
    const { container } = render(<ScrollArea maxHeight={300}>x</ScrollArea>);
    expect(container.firstChild).toHaveStyle({ maxHeight: '300px' });
  });

  it('sans maxHeight pas de style maxHeight', () => {
    const { container } = render(<ScrollArea>x</ScrollArea>);
    expect(container.firstChild.style.maxHeight).toBe('');
  });

  it('forward ref', () => {
    const ref = createRef();
    render(<ScrollArea ref={ref}>x</ScrollArea>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('applique className supplémentaire', () => {
    const { container } = render(<ScrollArea className="extra">x</ScrollArea>);
    expect(container.firstChild).toHaveClass('ui-scroll-area', 'extra');
  });
});
