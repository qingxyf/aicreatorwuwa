import type { UploadedMedia } from '../../types/platform';

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const videoMimeTypes = new Set(['video/mp4', 'video/webm']);
const maxImageBytes = 20 * 1024 * 1024;
const maxVideoBytes = 100 * 1024 * 1024;

function hasBytes(bytes: Uint8Array, expected: number[], offset = 0): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

export async function hasMatchingMediaSignature(file: Pick<File, 'type' | 'slice'>): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  switch (file.type) {
    case 'image/jpeg':
      return hasBytes(bytes, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/webp':
      return hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8);
    case 'video/mp4':
      return hasBytes(bytes, [0x66, 0x74, 0x79, 0x70], 4);
    case 'video/webm':
      return hasBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
    default:
      return false;
  }
}

export class R2MediaStore {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly publicBaseUrl: string
  ) {}

  async save(file: File): Promise<UploadedMedia> {
    const kind = imageMimeTypes.has(file.type) ? 'image' : videoMimeTypes.has(file.type) ? 'video' : null;
    if (!kind) throw new Error('unsupported_media_type');
    if (file.size > (kind === 'image' ? maxImageBytes : maxVideoBytes)) throw new Error('media_too_large');
    if (!(await hasMatchingMediaSignature(file))) throw new Error('invalid_media_signature');
    const id = crypto.randomUUID();
    await this.bucket.put(id, file.stream(), { httpMetadata: { contentType: file.type } });
    return { id, url: `${this.publicBaseUrl.replace(/\/$/, '')}/api/v1/media/${id}`, kind, mimeType: file.type };
  }

  async read(id: string): Promise<R2ObjectBody | null> {
    return this.bucket.get(id);
  }
}
