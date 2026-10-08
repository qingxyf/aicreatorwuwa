import type { ExhibitionManifest, ExhibitionWork } from '../src/types/exhibition';

export const exhibitionSelection: Array<{ id: string; title: string; authorName: string; mediaCount: number }>;
export function selectExhibitionWorks(submissions: ExhibitionWork[]): ExhibitionWork[];
export function verifyExhibitionArchive(root: string): Promise<ExhibitionManifest>;
export function resolveExhibitionBackupDirectory(root: string, directory: string): string;
