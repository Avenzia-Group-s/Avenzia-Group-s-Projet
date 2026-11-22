export function resolveInstaller(release, target, repo) {
  const prefix = 'https://github.com/' + repo + '/releases/download/' + encodeURIComponent(release.tag_name) + '/';
  const installer = release.assets.find(entry => entry.name.endsWith('-setup.exe') &&
    [entry.url, entry.browser_download_url, prefix + encodeURIComponent(entry.name)].includes(target.url));
  if (!installer || installer.url !== 'https://api.github.com/repos/' + repo + '/releases/assets/' + installer.id) {
    throw new Error('Adresse de téléchargement non conforme à cette release.');
  }
  return { installer, publicUrl: prefix + encodeURIComponent(installer.name) };
}
