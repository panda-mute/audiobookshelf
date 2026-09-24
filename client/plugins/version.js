import packagejson from '../package.json'

export const currentVersion = packagejson.version

export async function checkForUpdate() {
  return {
    hasUpdate: false,
    latestVersion: packagejson.version,
    githubTagUrl: '',
    currentVersion: packagejson.version,
    releasesToShow: []
  }
}
