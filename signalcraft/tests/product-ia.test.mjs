import test from 'node:test';
import assert from 'node:assert/strict';
import { languageCopy } from '../src/lib/ui-language.ts';

for (const [locale, copy] of Object.entries(languageCopy)) {
  test(`${locale} product navigation keeps trend, evaluation, and deep search distinct`, () => {
    assert.notEqual(copy.primaryNav.radar, copy.primaryNav.research);
    assert.notEqual(copy.studioNav[1], copy.primaryNav.research);
    assert.notEqual(copy.studioNav[1], copy.primaryNav.radar);

    const researchLabels = Object.values(copy.researchViews).map(view => view.label);
    assert.equal(new Set(researchLabels).size, researchLabels.length);

    // The home card routes to /longform, so its label must describe evaluation,
    // not the recent-change radar at /radar.
    assert.equal(copy.home.radar, copy.primaryNav.research);
    assert.notEqual(copy.home.radar, copy.primaryNav.radar);
  });
}

test('Chinese labels state each job instead of repeating generic research names', () => {
  const copy = languageCopy.zh;
  assert.match(copy.primaryNav.radar, /趋势/);
  assert.match(copy.primaryNav.research, /评估/);
  assert.match(copy.studioNav[1], /检索/);
  assert.match(copy.researchViews.shortformRadar.label, /Shorts/);
});
