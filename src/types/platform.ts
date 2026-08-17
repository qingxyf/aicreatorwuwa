export interface Viewer {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface UploadedMedia {
  id: string;
  url: string;
  kind: 'image' | 'video';
  mimeType: string;
}

export interface ToyProfile {
  nickname: string;
  avatar: string;
  toyOpenId?: string;
}
