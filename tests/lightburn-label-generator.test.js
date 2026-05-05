import { buildLightburnLabelSvg, buildLightburnPlateSvg, buildQrLogoPng } from '../apps/api/services/lightburnLabelGenerator.js';
import fs from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('LightBurn — PNG QR+logo composite', () => {
  const dataUri = buildQrLogoPng('https://emag.local/equipment/EMAG-S00882');
  assert.match(dataUri, /^data:image\/png;base64,/);
  const buf = Buffer.from(dataUri.split(',')[1], 'base64');
  assert.ok(buf.length > 1000, 'PNG must be > 1KB');
  // PNG magic
  assert.equal(buf[0], 0x89);
  assert.equal(buf[1], 0x50);
  fs.writeFileSync('/tmp/lb-qr-logo.png', buf);
});

test('LightBurn — SVG étiquette unitaire', () => {
  const svg = buildLightburnLabelSvg({
    uid: 'EMAG-S00882',
    serial: '002203R E00D315',
    magNumber: 'T01',
    qrPayload: 'https://emag.local/equipment/EMAG-S00882',
  });
  fs.writeFileSync('/tmp/lb-label-one.svg', svg);

  // 3 calques nommés
  assert.ok(svg.includes('id="QR_IMAGE"'));
  assert.ok(svg.includes('id="TEXT_FILL"'));
  assert.ok(svg.includes('id="FRAME_LINE"'));
  assert.ok(svg.includes('inkscape:label="QR_IMAGE"'));
  assert.ok(svg.includes('inkscape:label="TEXT_FILL"'));
  assert.ok(svg.includes('inkscape:label="FRAME_LINE"'));

  // Interdictions strictes
  assert.ok(!svg.includes('clipPath'), 'no clipPath');
  assert.ok(!svg.includes('<filter'), 'no filter');
  assert.ok(!svg.includes('<mask'), 'no mask');
  assert.ok(!svg.includes('opacity'), 'no opacity');
  assert.ok(!/transparent/i.test(svg), 'no transparent');

  // Couleurs strictes
  const colorMatches = svg.match(/#[0-9A-Fa-f]{6}/g) || [];
  for (const c of colorMatches) {
    const up = c.toUpperCase();
    assert.ok(['#000000', '#FFFFFF'].includes(up), `Color ${c} must be #000000 or #FFFFFF`);
  }

  // Image PNG raster + pixelated
  assert.ok(svg.includes('image-rendering:pixelated'));
  assert.ok(svg.includes('href="data:image/png;base64,'));

  // Cadre 0.1 mm stroke
  assert.ok(svg.includes('stroke-width="0.1"'));
  assert.ok(svg.includes('fill="none"'));

  // Dimensions
  assert.ok(svg.includes('width="50mm"'));
  assert.ok(svg.includes('height="25mm"'));
});

test('LightBurn — Plaque 200×200 mm 4×8 = 32 étiquettes', () => {
  const items = Array.from({ length: 32 }, (_, i) => ({
    uid: 'EMAG-S' + String(i + 1).padStart(5, '0'),
    serial: 'SN' + String(i * 1234).padStart(8, '0'),
    magNumber: i % 3 === 0 ? 'M' + String(i).padStart(2, '0') : '',
    qrPayload: 'https://emag.local/equipment/EMAG-S' + String(i + 1).padStart(5, '0'),
  }));
  const svg = buildLightburnPlateSvg(items);
  fs.writeFileSync('/tmp/lb-plate.svg', svg);

  assert.ok(svg.includes('width="200mm"'));
  assert.ok(svg.includes('height="200mm"'));

  // EXACTEMENT 3 calques globaux pour toute la plaque (pas 32 × 3 = 96).
  const qrLayers = (svg.match(/inkscape:label="QR_IMAGE"/g) || []).length;
  const textLayers = (svg.match(/inkscape:label="TEXT_FILL"/g) || []).length;
  const frameLayers = (svg.match(/inkscape:label="FRAME_LINE"/g) || []).length;
  assert.equal(qrLayers, 1, 'plaque doit avoir 1 seul calque QR_IMAGE global');
  assert.equal(textLayers, 1, 'plaque doit avoir 1 seul calque TEXT_FILL global');
  assert.equal(frameLayers, 1, 'plaque doit avoir 1 seul calque FRAME_LINE global');

  // Mais 32 éléments dans chaque calque (1 par étiquette).
  const rectCount = (svg.match(/<rect /g) || []).length;
  const imageCount = (svg.match(/<image /g) || []).length;
  assert.equal(rectCount, 32, '32 cadres rect attendus');
  assert.equal(imageCount, 32, '32 images QR attendues');

  // Positions : marge 5mm + (50+1)*col → première étiquette x=5
  assert.ok(svg.includes('translate(5.000,5.000)'));
  // Dernière étiquette : col=3, row=7 → x=5+3*51=158, y=5+7*26=187
  assert.ok(svg.includes('translate(158.000,187.000)'));
});
