// Quick smoke test: import all modified modules to check for syntax/import errors
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('Testing imports...');

try {
  const { normalizeBrand, enrichArticle, resolveBrand, listBrandsWithStats, linkBrandIds, applyUnifiedFamilyBatch, invalidateBrandCache } = await import('./brandHelpers.js');
  console.log('✅ brandHelpers.js — all exports OK');

  // Test normalizeBrand
  const r1 = normalizeBrand('L-ACOUSTICS');
  console.log(`  normalizeBrand('L-ACOUSTICS') → brand:${r1.brand}, brand_id:${r1.brand_id}`);

  const r2 = normalizeBrand('NEUTRICK');
  console.log(`  normalizeBrand('NEUTRICK') → brand:${r2.brand}, brand_id:${r2.brand_id}`);

  const r3 = normalizeBrand('UnknownBrand123');
  console.log(`  normalizeBrand('UnknownBrand123') → brand:${r3.brand}, brand_id:${r3.brand_id}`);

  // Test enrichArticle
  const art = enrichArticle({ brand: 'yamaha', designation: 'Console numérique TF5', family: 'Son' });
  console.log(`  enrichArticle → brand:${art.brand}, brand_id:${art.brand_id}, unified_family:${art.unified_family}`);

  // Test resolveBrand
  const r4 = resolveBrand('shure');
  console.log(`  resolveBrand('shure') → ${r4 ? r4.name + ' (id:' + r4.id + ')' : 'null'}`);

  // Test listBrandsWithStats
  const brands = listBrandsWithStats();
  console.log(`  listBrandsWithStats() → ${brands.length} brands`);
  const top3 = brands.slice(0, 3).map(b => `${b.name}(eq:${b.equipment_count},art:${b.article_count})`);
  console.log(`    Top 3: ${top3.join(', ')}`);

  // Test linkBrandIds (read-only check)
  console.log('  linkBrandIds/applyUnifiedFamilyBatch — skipping (would modify data)');

  console.log('\n✅ All brandHelpers tests passed!\n');
} catch (err) {
  console.error('❌ brandHelpers.js FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
}

process.exit(0);
