import { describe, expect, it } from 'vitest';

import { getDisplayEventSteps, TASK_STEPS } from '../components/planning/EventTaskModal';

describe('EventTaskModal task type choices', () => {
  it('offers additional task types as standalone choices', () => {
    const sections = TASK_STEPS.map((step) => step.defaultSection);
    expect(sections).toEqual(
      expect.arrayContaining([
        'prep_tournees',
        'taches_prioritaires',
        'taches_secondaires',
        'intervention',
        'manual',
      ]),
    );
  });

  it('does not create display events for generic task types', () => {
    const steps = [
      { key: 'chargement' },
      { key: 'taches_prioritaires' },
      { key: 'taches_secondaires' },
      { key: 'intervention' },
      { key: 'manual' },
    ];

    expect(getDisplayEventSteps(steps).map((step) => step.key)).toEqual(['chargement']);
  });
});
