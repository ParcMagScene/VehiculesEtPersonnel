import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import MobileHome from '../components/mobile/MobileHome';

describe('MobileHome', () => {
  it('affiche Équipements sans droit de maintenance matériel', () => {
    render(<MobileHome onNavigate={vi.fn()} currentUser={{ permissions: {} }} />);

    expect(screen.getByText('Équipements')).toBeInTheDocument();
    expect(screen.queryByText('SAV')).not.toBeInTheDocument();
  });
});
