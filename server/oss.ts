import OSS from 'ali-oss';
import type { UploadedMedia } from '../src/types/platform';

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const videoMimeTypes = new Set(['video/mp4', 'video/webm']);
const maxImageBytes = 20 * 1024 * 1024;
const maxVideoBytes = 100 * 1024 * 1024;

export interface OssConfig {
  region: string;
  bucket: string;
  accessKeyId?: string;
  accessKeySecret?: string;
  ramRoleName?: string;
  endpoint?: string;
}

export function mediaObjectHeaders(contentType: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'private, no-store',
    'x-oss-object-acl': 'private'
  };
}

function hasBytes(bytes: Uint8Array, expected: number[], offset = 0): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

export async function hasMatchingMediaSignature(file: Pick<File, 'type' | 'slice'>): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  switch (file.type) {
    case 'image/jpeg': return hasBytes(bytes, [0xff, 0xd8, 0xff]);
    case 'image/png': return hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/webp': return hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8);
    case 'video/mp4': return hasBytes(bytes, [0x66, 0x74, 0x79, 0x70], 4);
    case 'video/webm': return hasBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
    default: return false;
  }
}

export class OssMediaStore {
  private readonly client: OSS;

  constructor(private readonly config: OssConfig) {
    if ((!config.accessKeyId || !config.accessKeySecret) && !config.ramRoleName) throw new Error('oss_credentials_required');
    const options = {
      region: config.region,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId ?? 'bootstrap',
      accessKeySecret: config.accessKeySecret ?? 'bootstrap',
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      secure: true,
      timeout: 120_000
    } as ConstructorParameters<typeof OSS>[0];
    if (config.ramRoleName) {
      options.stsToken = 'bootstrap';
      options.refreshSTSTokenInterval = 0;
      options.refreshSTSToken = async () => {
        const response = await fetch(`http://100.100.100.200/latest/meta-data/ram/security-credentials/${encodeURIComponent(config.ramRoleName!)}`);
        if (!response.ok) throw new Error('oss_ram_role_unavailable');
        const credentials = await response.json() as { AccessKeyId?: string; AccessKeySecret?: string; SecurityToken?: string };
        if (!credentials.AccessKeyId || !credentials.AccessKeySecret || !credentials.SecurityToken) throw new Error('oss_ram_role_invalid');
        return { accessKeyId: credentials.AccessKeyId, accessKeySecret: credentials.AccessKeySecret, stsToken: credentials.SecurityToken };
      };
    }
    this.client = new OSS({
      ...options
    });
  }

  async save(file: File): Promise<UploadedMedia> {
    const kind = imageMimeTypes.has(file.type) ? 'image' : videoMimeTypes.has(file.type) ? 'video' : null;
    if (!kind) throw new Error('unsupported_media_type');
    if (file.size > (kind === 'image' ? maxImageBytes : maxVideoBytes)) throw new Error('media_too_large');
    if (!(await hasMatchingMediaSignature(file))) throw new Error('invalid_media_signature');
    const id = crypto.randomUUID();
    const bytes = Buffer.from(await file.arrayBuffer());
    await this.client.put(id, bytes, { headers: mediaObjectHeaders(file.type) });
    return { id, url: `/api/v1/media/${id}`, kind, mimeType: file.type };
  }

  async read(id: string): Promise<{ content: Buffer; type?: string } | null> {
    try {
      const result = await this.client.get(id);
      return { content: Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content), type: result.res.headers['content-type'] };
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      if (code === 'NoSuchKey' || code === 'NoSuchBucket') return null;
      throw error;
    }
  }

  async makePrivate(id: string): Promise<void> {
    try {
      await this.client.putACL(id, 'private');
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      if (code !== 'NoSuchKey') throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.client.delete(id);
  }
}
