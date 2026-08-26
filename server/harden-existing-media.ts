import { createPool } from './db';
import { hardenExistingMedia } from './media-hardening';
import { OssMediaStore } from './oss';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
for (const key of ['OSS_REGION', 'OSS_BUCKET'] as const) if (!process.env[key]) throw new Error(`${key} is required`);

const pool = createPool({ connectionString: databaseUrl, max: 2 });
const mediaStore = new OssMediaStore({
  region: process.env.OSS_REGION!,
  bucket: process.env.OSS_BUCKET!,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  ramRoleName: process.env.OSS_RAM_ROLE_NAME,
  endpoint: process.env.OSS_ENDPOINT
});

try {
  const updated = await hardenExistingMedia(pool, mediaStore);
  console.log(`existing media hardening complete (${updated} objects rewritten)`);
} finally {
  await pool.end();
}
