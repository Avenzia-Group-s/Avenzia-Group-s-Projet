import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInstaller } from './release-manifest.mjs';
const repo = 'Avenzia-Group-s/Avenzia-Group-s-Projet';
const entry = { id: 123, name: 'Avenzia_0.1.1_x64-setup.exe',
  url: 'https://api.github.com/repos/' + repo + '/releases/assets/123',
  browser_download_url: 'https://github.com/' + repo + '/releases/download/untagged-abc/Avenzia_0.1.1_x64-setup.exe' };
const release = { tag_name: 'v0.1.1', assets: [entry] };
const publicUrl = 'https://github.com/' + repo + '/releases/download/v0.1.1/' + entry.name;
test('convertit les adresses de brouillon en adresse publique du tag', () => {
  for (const url of [entry.url, entry.browser_download_url, publicUrl]) {
    const resolved = resolveInstaller(release, { url }, repo);
    assert.equal(resolved.installer, entry);
    assert.equal(resolved.publicUrl, publicUrl);
  }
});
test('rejette un artefact absent de cette release et une adresse externe', () => {
  for (const url of [entry.url + '4', 'https://example.com/' + entry.name, publicUrl.replace('v0.1.1', 'v9.0.0')]) {
    assert.throws(() => resolveInstaller(release, { url }, repo));
  }
});
test('rejette une adresse API provenant dun autre depot', () => {
  const foreign = { ...entry, url: entry.url.replace(repo, 'other/repo') };
  assert.throws(() => resolveInstaller({ ...release, assets: [foreign] }, { url: foreign.url }, repo));
});
