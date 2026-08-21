import { serve } from '@hono/node-server';
import { createPool } from './db';
import { verifyIdentity } from './identity';
import { OssMediaStore } from './oss';
import { createServerApp } from './app';

const port = Number(process.env.PORT ?? 8787);
const mode = process.env.MODE === 'development' ? 'development' : 'production';
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
for (const key of ['OSS_REGION', 'OSS_BUCKET'] as const) if (!process.env[key]) throw new Error(`${key} is required`);

const pool = createPool({ connectionString: databaseUrl, max: Number(process.env.DB_POOL_MAX ?? 10) });
const mediaStore = new OssMediaStore({
  region: process.env.OSS_REGION!,
  bucket: process.env.OSS_BUCKET!,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  ramRoleName: process.env.OSS_RAM_ROLE_NAME,
  endpoint: process.env.OSS_ENDPOINT
});
const app = createServerApp({
  pool,
  mediaStore,
  mode,
  publicAppOrigin: process.env.PUBLIC_APP_ORIGIN,
  mediaBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL ?? `http://localhost:${port}`,
  identity: {
    mode,
    verificationUrl: process.env.IDENTITY_VERIFY_URL,
    verificationSecret: process.env.IDENTITY_VERIFY_SECRET,
    allowToyProfile: process.env.ALLOW_TOY_PROFILE_IDENTITY === 'true'
  },
  opsAuth: {
    passwordHash: process.env.OPS_ADMIN_PASSWORD_HASH,
    sessionSecret: process.env.OPS_SESSION_SECRET,
    sessionTtlSeconds: process.env.OPS_SESSION_TTL_SECONDS ? Number(process.env.OPS_SESSION_TTL_SECONDS) : undefined
  }
});

serve({ fetch: app.fetch, port }, (info) => console.log(`wuwa API listening on http://0.0.0.0:${info.port}`));

const shutdown = async () => { await pool.end(); process.exit(0); };
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
