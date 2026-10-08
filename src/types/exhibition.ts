export interface ExhibitionAsset {
  path: string;
  byteSize: number;
  sha256: string;
}

export interface ExhibitionMedia extends ExhibitionAsset {
  id: string;
  kind: 'image' | 'video';
  mimeType: string;
  preview?: ExhibitionAsset;
}

export interface ExhibitionWork {
  id: string;
  title: string;
  authorName: string;
  trackId: string;
  avatar: ExhibitionAsset;
  media: ExhibitionMedia[];
}

export interface ExhibitionManifest {
  schemaVersion: number;
  exportedAt: string;
  works: ExhibitionWork[];
}
