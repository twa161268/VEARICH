/**
 * Asset URL versioning
 *
 * Vercel menyediakan VERCEL_GIT_COMMIT_SHA untuk deployment dari Git.
 * Dengan memakai commit SHA sebagai query string, browser akan meminta
 * asset baru setiap kali deployment/commit menghasilkan versi baru.
 *
 * Contoh:
 *   /js/transaksiPinKirimForm.js?v=40bdf05
 */
const version =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
  process.env.GIT_COMMIT_SHA?.slice(0, 8) ||
  process.env.ASSET_VERSION ||
  'dev';

function asset(filePath) {
  if (!filePath) return filePath;

  const separator = filePath.includes('?') ? '&' : '?';
  return `${filePath}${separator}v=${encodeURIComponent(version)}`;
}

module.exports = asset;
