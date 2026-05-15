import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LoginForm from '../components/auth/LoginForm';

// Mock du module api utilisé dans LoginForm
vi.mock('../utils/api', () => ({
  default: {
    checkEmailAccessRequest: vi.fn().mockResolvedValue({ authorized: false }),
    getUsersPublic: vi.fn().mockResolvedValue([]),
    forceLogin: vi.fn(),
    selfResetPassword: vi.fn(),
  },
}));

// Évite de charger AccessRequestModal réel et son arborescence
vi.mock('../components/management/AccessRequestModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="access-request-modal">
      <button onClick={onClose}>fermer</button>
    </div>
  ),
}));

import api from '../utils/api';

describe('LoginForm', () => {
  beforeEach(() => {
    api.checkEmailAccessRequest.mockResolvedValue({ authorized: false });
    api.getUsersPublic.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rend le formulaire avec les champs email et mot de passe', async () => {
    render(<LoginForm onLogin={vi.fn()} onLoginPin={vi.fn()} />);
    expect(await screen.findByPlaceholderText(/email@exemple\.com/i)).toBeInTheDocument();
    // Bouton submit présent
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('appelle onLogin avec email + mot de passe en mode password', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<LoginForm onLogin={onLogin} onLoginPin={vi.fn()} />);

    const emailInput = await screen.findByPlaceholderText(/email@exemple\.com/i);
    await user.type(emailInput, 'jean@test.fr');

    // Champ password (autoComplete="current-password" sinon premier input type=password)
    const pwdInput = container.querySelector('input[type="password"]');
    expect(pwdInput).toBeTruthy();
    await user.type(pwdInput, 'monpass1234');

    const form = container.querySelector('form');
    expect(form).toBeTruthy();
    await user.click(container.querySelector('button[type="submit"]'));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith('jean@test.fr', 'monpass1234'));
  });

  it('charge la liste des utilisateurs publics au montage', async () => {
    api.getUsersPublic.mockResolvedValueOnce([
      { id: 1, name: 'Alice', email: 'a@x.fr', avatar: null },
    ]);
    render(<LoginForm onLogin={vi.fn()} onLoginPin={vi.fn()} />);
    await waitFor(() => expect(api.getUsersPublic).toHaveBeenCalled());
    expect(await screen.findByText(/Choisir un utilisateur/i)).toBeInTheDocument();
  });
});
