/**
 * Tests d'intégration cross-module pour refreshBus (Phase E audit).
 *
 * Vérifie que le bus relaie correctement les mutations d'un composant
 * "Publisher" vers un composant "Subscriber" monté en parallèle, en
 * simulant le cas réel : un panneau de saisie déclenche un
 * `refreshBus.publish(key)` et une vue liste abonnée recharge ses
 * données sans rerender depuis le parent.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useRefreshSubscription } from '../hooks/useRefreshSubscription';
import { refreshBus } from '../utils/refresh-bus';

function Publisher({ busKey }) {
  return (
    <button type="button" onClick={() => refreshBus.publish(busKey)}>
      publish-{busKey}
    </button>
  );
}

function Subscriber({ busKey, loader }) {
  const [count, setCount] = useState(0);
  useRefreshSubscription(busKey, () => {
    loader();
    setCount((c) => c + 1);
  });
  return <div data-testid={`sub-${busKey}`}>count:{count}</div>;
}

describe('refreshBus — intégration cross-module', () => {
  it("un publish dans un composant déclenche le loader d'un autre composant", () => {
    const loader = vi.fn();
    render(
      <>
        <Publisher busKey="vehicles" />
        <Subscriber busKey="vehicles" loader={loader} />
      </>,
    );

    expect(loader).not.toHaveBeenCalled();
    expect(screen.getByTestId('sub-vehicles').textContent).toBe('count:0');

    fireEvent.click(screen.getByText('publish-vehicles'));
    expect(loader).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sub-vehicles').textContent).toBe('count:1');

    fireEvent.click(screen.getByText('publish-vehicles'));
    expect(loader).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('sub-vehicles').textContent).toBe('count:2');
  });

  it('plusieurs subscribers indépendants sont tous notifiés', () => {
    const loaderA = vi.fn();
    const loaderB = vi.fn();
    render(
      <>
        <Publisher busKey="equipment" />
        <Subscriber busKey="equipment" loader={loaderA} />
        <Subscriber busKey="equipment" loader={loaderB} />
      </>,
    );

    fireEvent.click(screen.getByText('publish-equipment'));
    expect(loaderA).toHaveBeenCalledTimes(1);
    expect(loaderB).toHaveBeenCalledTimes(1);
  });

  it('un publish sur une autre clé ne déclenche pas le subscriber', () => {
    const loader = vi.fn();
    render(
      <>
        <Publisher busKey="orders" />
        <Subscriber busKey="stock" loader={loader} />
      </>,
    );

    fireEvent.click(screen.getByText('publish-orders'));
    expect(loader).not.toHaveBeenCalled();
  });

  it('un subscriber démonté ne reçoit plus de notifications', () => {
    const loader = vi.fn();
    function Wrapper() {
      const [visible, setVisible] = useState(true);
      return (
        <>
          <Publisher busKey="annuaire" />
          <button type="button" onClick={() => setVisible(false)}>
            unmount
          </button>
          {visible && <Subscriber busKey="annuaire" loader={loader} />}
        </>
      );
    }
    render(<Wrapper />);

    fireEvent.click(screen.getByText('publish-annuaire'));
    expect(loader).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('unmount'));
    fireEvent.click(screen.getByText('publish-annuaire'));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('publish hors composant React (mutation API) est aussi reçu', () => {
    const loader = vi.fn();
    render(<Subscriber busKey="affaires" loader={loader} />);

    act(() => {
      refreshBus.publish('affaires');
    });
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
