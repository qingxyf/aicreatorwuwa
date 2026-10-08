import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const exhibitionSelection = [
  { id: 'cf755c91-8e1e-47b5-ae33-a834843cbdb8', title: '弥汐辞', authorName: '朴一文', mediaCount: 3 },
  { id: '17d73b60-6c28-4066-bbe9-da6a473ba162', title: '拉海洛全角色国风服装', authorName: 'ai凌时工作室', mediaCount: 9 }
];

const extensions = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm' };
const checksum = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function selectExhibitionWorks(submissions) {
  return exhibitionSelection.map((expected) => {
    const work = submissions.find((item) => item.id === expected.id);
    if (!work || work.title !== expected.title || work.authorName !== expected.authorName || work.trackId !== 'wardrobe-design' || work.media.length !== expected.mediaCount) {
      throw new Error(`Exhibition selection does not match the confirmed submission: ${expected.id}`);
    }
    if (work.media.some((media) => !extensions[media.mimeType])) throw new Error(`Unsupported exhibition media: ${work.id}`);
    return work;
  });
}

export async function verifyExhibitionArchive(root) {
  const manifest = JSON.parse(await readFile(resolve(root, 'src/config/exhibition-manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.works) || manifest.works.length !== exhibitionSelection.length || new Set(manifest.works.map((work) => work.id)).size !== exhibitionSelection.length) {
    throw new Error('Public exhibition manifest must contain exactly the two confirmed works, without extras or duplicates');
  }
  const works = selectExhibitionWorks(manifest.works);
  if (manifest.schemaVersion !== 1) throw new Error('Invalid exhibition manifest version');
  for (const work of works) {
    const assets = [work.avatar, ...work.media, ...work.media.flatMap((media) => media.preview ? [media.preview] : [])];
    for (const asset of assets) {
      if (!/^exhibition\/[a-zA-Z0-9_-]+\.(png|jpg|webp|mp4|webm)$/.test(asset.path)) throw new Error('Exhibition assets must be local relative paths');
      const bytes = await readFile(resolve(root, 'public', asset.path));
      if (!bytes.length || bytes.length !== asset.byteSize || checksum(bytes) !== asset.sha256) throw new Error(`Exhibition asset is missing or changed: ${asset.path}`);
    }
  }
  return manifest;
}

export function resolveExhibitionBackupDirectory(root, directory) {
  const backup = resolve(directory);
  const location = relative(resolve(root), backup);
  if (!location || (!isAbsolute(location) && location !== '..' && !location.startsWith(`..${sep}`))) {
    throw new Error('Exhibition backups must be outside the repository so private snapshots cannot be published');
  }
  return backup;
}

async function exportExhibition(root, apiBase, backupDirectory, password) {
  if (!password || !backupDirectory) throw new Error('Set OPS_PASSWORD and EXHIBITION_BACKUP_DIR before exporting');
  const backup = resolveExhibitionBackupDirectory(root, backupDirectory);
  const base = new URL(apiBase);
  if (base.protocol !== 'https:' || base.hostname !== 'qingxianyunfu.psdcut.com') throw new Error('Unexpected production API origin');
  const request = async (path, options = {}) => {
    const response = await fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Exhibition API request failed (${response.status}): ${path}`);
    return response.json();
  };
  const session = await request('/api/v1/ops/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
  const headers = { authorization: `Bearer ${session.token}` };
  const [submissions, settings] = await Promise.all([
    request('/api/v1/ops/submissions', { headers }),
    request('/api/v1/ops/activity-settings', { headers })
  ]);
  const selected = selectExhibitionWorks(submissions);
  const exportedAt = new Date().toISOString();
  await mkdir(backup, { recursive: true });
  const sanitizedSubmissions = submissions.map((work) => ({ ...work, media: work.media.map(({ url: _url, ...media }) => media) }));
  await writeFile(resolve(backup, 'operations-snapshot.json'), JSON.stringify({ exportedAt, settings, submissions: sanitizedSubmissions }, null, 2));

  const downloadAsset = async (urlValue, filename, expectedType, isAvatar = false) => {
    const url = new URL(urlValue, base);
    const allowedHost = isAvatar ? url.hostname.endsWith('.hdslb.com') : url.origin === base.origin && url.pathname.startsWith('/api/v1/media/');
    if (url.protocol !== 'https:' || !allowedHost) throw new Error(`Unexpected asset origin: ${filename}`);
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Exhibition asset download failed (${response.status}): ${filename}`);
    const mimeType = response.headers.get('content-type')?.split(';')[0];
    if (!extensions[mimeType] || (expectedType && mimeType !== expectedType) || (isAvatar && !mimeType.startsWith('image/'))) throw new Error(`Invalid exhibition asset content type: ${filename}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error(`Empty exhibition asset: ${filename}`);
    const path = `exhibition/${filename}${extensions[mimeType]}`;
    await mkdir(resolve(root, 'public/exhibition'), { recursive: true });
    await writeFile(resolve(backup, `${filename}${extensions[mimeType]}`), bytes);
    await writeFile(resolve(root, 'public', path), bytes);
    return { path, byteSize: bytes.length, sha256: checksum(bytes) };
  };

  const works = [];
  for (const work of selected) {
    const avatar = await downloadAsset(work.authorAvatar, `avatar-${work.id}`, undefined, true);
    const media = [];
    for (const item of work.media) media.push({ id: item.id, kind: item.kind, mimeType: item.mimeType, ...await downloadAsset(item.url, item.id, item.mimeType) });
    works.push({ id: work.id, title: work.title, authorName: work.authorName, trackId: work.trackId, avatar, media });
  }
  const manifest = { schemaVersion: 1, exportedAt, works };
  await writeFile(resolve(backup, 'exhibition-manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(resolve(root, 'src/config/exhibition-manifest.json'), JSON.stringify(manifest, null, 2));
  await verifyExhibitionArchive(root);
  const totalBytes = works.reduce((sum, work) => sum + work.avatar.byteSize + work.media.reduce((size, asset) => size + asset.byteSize, 0), 0);
  console.log(JSON.stringify({ workCount: works.length, mediaCount: works.reduce((sum, work) => sum + work.media.length, 0), totalBytes, backupDirectory: backup, note: 'Operations snapshot and selected original media saved; this is not a complete PostgreSQL dump.' }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    if (process.argv.includes('--verify')) {
      const manifest = await verifyExhibitionArchive(root);
      console.log(`Exhibition archive verified: ${manifest.works.length} works, ${manifest.works.reduce((sum, work) => sum + work.media.length, 0)} media files.`);
    } else await exportExhibition(root, process.env.EXHIBITION_API_BASE_URL ?? 'https://qingxianyunfu.psdcut.com', process.env.EXHIBITION_BACKUP_DIR, process.env.OPS_PASSWORD);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
