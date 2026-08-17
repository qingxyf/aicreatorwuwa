import type { UploadedMedia } from '../../types/platform';

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const videoMimeTypes = new Set(['video/mp4', 'video/webm']);
const maxImageBytes = 20 * 1024 * 1024;
const maxVideoBytes = 100 * 1024 * 1024;

export class R2MediaStore {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly publicBaseUrl: string
  ) {}

  async save(file: File): Promise<UploadedMedia> {
    const kind = imageMimeTypes.has(file.type) ? 'image' : videoMimeTypes.has(file.type) ? 'video' : null;
    if (!kind) throw new Error('unsupported_media_type');
    if (file.size > (kind === 'image' ? maxImageBytes : maxVideoBytes)) throw new Error('media_too_large');
    const id = crypto.randomUUID();
    await this.bucket.put(id, file.stream(), { httpMetadata: { contentType: file.type } });
    return { id, url: `${this.publicBaseUrl.replace(/\/$/, '')}/api/v1/media/${id}`, kind, mimeType: file.type };
  }

  async read(id: string): Promise<R2ObjectBody | null> {
    return this.bucket.get(id);
  }
}
