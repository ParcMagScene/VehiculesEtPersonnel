import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ModuleLayout,
  ModuleToolbar,
  ModuleContent,
  ModuleFooter,
  SplitLayout,
} from '../components/ui/ModuleLayout';

describe('ModuleLayout', () => {
  it('rend les enfants avec la classe', () => {
    const { container } = render(<ModuleLayout>contenu</ModuleLayout>);
    expect(container.firstChild).toHaveClass('ui-module-layout');
    expect(screen.getByText('contenu')).toBeInTheDocument();
  });

  it('applique className supplémentaire', () => {
    const { container } = render(<ModuleLayout className="extra">x</ModuleLayout>);
    expect(container.firstChild).toHaveClass('ui-module-layout', 'extra');
  });
});

describe('ModuleToolbar', () => {
  it('rend avec la classe', () => {
    const { container } = render(<ModuleToolbar>toolbar</ModuleToolbar>);
    expect(container.firstChild).toHaveClass('ui-module-toolbar');
  });
});

describe('ModuleContent', () => {
  it('rend les enfants', () => {
    render(<ModuleContent>body</ModuleContent>);
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('noPadding ajoute la classe', () => {
    const { container } = render(<ModuleContent noPadding>x</ModuleContent>);
    expect(container.firstChild).toHaveClass('ui-module-content--no-padding');
  });
});

describe('ModuleFooter', () => {
  it('rend avec la classe', () => {
    const { container } = render(<ModuleFooter>pied</ModuleFooter>);
    expect(container.firstChild).toHaveClass('ui-module-footer');
  });
});

describe('SplitLayout', () => {
  it('rend sidebar et contenu', () => {
    render(<SplitLayout sidebar={<nav>Menu</nav>}>Main</SplitLayout>);
    expect(screen.getByText('Menu')).toBeInTheDocument();
    expect(screen.getByText('Main')).toBeInTheDocument();
  });

  it('side left par défaut', () => {
    const { container } = render(<SplitLayout sidebar={<nav>S</nav>}>M</SplitLayout>);
    expect(container.firstChild).toHaveClass('ui-split-layout--left');
  });

  it('side right', () => {
    const { container } = render(
      <SplitLayout sidebar={<nav>S</nav>} side="right">
        M
      </SplitLayout>,
    );
    expect(container.firstChild).toHaveClass('ui-split-layout--right');
  });

  it('sidebarWidth applique le style', () => {
    const { container } = render(
      <SplitLayout sidebar={<nav>S</nav>} sidebarWidth={350}>
        M
      </SplitLayout>,
    );
    const aside = container.querySelector('.ui-split-sidebar');
    expect(aside).toHaveStyle({ width: '350px' });
  });
});
