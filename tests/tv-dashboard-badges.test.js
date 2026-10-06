import test from 'node:test';
import assert from 'node:assert/strict';

import { getEventBadges } from '../apps/tv-client/eventBadges.js';

test('affiche le badge véhicule vert avant le badge affaire sur les lignes de chargement', () => {
  const badges = getEventBadges({
    section: 'chargement',
    affaireNum: 'AF-1245',
    affaireType: 'Location',
    reservationVehicleReg: 'AB-123-CD',
  });

  assert.match(badges.vehicleBadge, /tv-vehicle-badge/);
  assert.match(badges.vehicleBadge, /AB-123-CD/);
  assert.ok(badges.vehicleBadge.indexOf('AB-123-CD') < badges.affaireBadge.indexOf('AF-1245'));
  assert.match(badges.affaireBadge, /tv-affaire-badge/);
  assert.match(badges.affaireBadge, /AF-1245/);
});

test('n affiche pas le badge véhicule hors chargement', () => {
  const badges = getEventBadges({
    section: 'depart',
    affaireNum: 'AF-1245',
    affaireType: 'Location',
    reservationVehicleReg: 'AB-123-CD',
  });

  assert.equal(badges.vehicleBadge, '');
  assert.match(badges.affaireBadge, /AF-1245/);
});

test('n affiche pas le badge véhicule sans immatriculation liée', () => {
  const badges = getEventBadges({
    section: 'chargement',
    affaireNum: 'AF-1245',
    affaireType: 'Location',
    reservationVehicleReg: '',
  });

  assert.equal(badges.vehicleBadge, '');
  assert.match(badges.affaireBadge, /AF-1245/);
});
