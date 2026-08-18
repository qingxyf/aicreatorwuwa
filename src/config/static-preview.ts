export interface StaticPreviewEnvironment {
  DEV: boolean;
  VITE_STATIC_PREVIEW?: string;
}

export function canUseDemoPreview(environment: StaticPreviewEnvironment): boolean {
  return environment.DEV || environment.VITE_STATIC_PREVIEW === 'true';
}
