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

test('affiche le badge véhicule vert sur les lignes de courses', () => {
  const badges = getEventBadges({
    section: 'courses',
    affaireNum: 'AF-1245',
    affaireType: 'Location',
    reservationVehicleReg: 'AB-123-CD',
  });

  assert.match(badges.vehicleBadge, /tv-vehicle-badge/);
  assert.match(badges.vehicleBadge, /AB-123-CD/);
  assert.match(badges.affaireBadge, /AF-1245/);
});

test('n affiche pas le badge véhicule sur les sections non prévues', () => {
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

test('affiche une pastille par véhicule lié avec son immatriculation et son nom', () => {
  const badges = getEventBadges({
    section: 'chargement',
    affaireNum: 'AF-1245',
    reservationVehicles: [
      { registration: 'AB-123-CD', name: 'Camion 1' },
      { registration: 'EF-456-GH', name: 'Camion 2' },
    ],
    reservationVehicleReg: 'AB-123-CD, EF-456-GH, IJ-789-KL',
  });

  assert.equal((badges.vehicleBadge.match(/tv-vehicle-badge/g) || []).length, 2);
  assert.match(badges.vehicleBadge, /AB-123-CD · Camion 1/);
  assert.match(badges.vehicleBadge, /EF-456-GH · Camion 2/);
  assert.doesNotMatch(badges.vehicleBadge, /IJ-789-KL/);
});

test('une liste de véhicules vide ne réaffiche pas l’ancienne liste agrégée', () => {
  const badges = getEventBadges({
    section: 'chargement',
    reservationVehicles: [],
    reservationVehicleReg: 'AB-123-CD, EF-456-GH',
  });

  assert.equal(badges.vehicleBadge, '');
});

test('échappe les noms de véhicules injectés dans le HTML des pastilles', () => {
  const badges = getEventBadges({
    section: 'chargement',
    reservationVehicles: [{ registration: 'AB-123-CD', name: '<Camion>' }],
  });

  assert.match(badges.vehicleBadge, /&lt;Camion&gt;/);
  assert.doesNotMatch(badges.vehicleBadge, /<Camion>/);
});
