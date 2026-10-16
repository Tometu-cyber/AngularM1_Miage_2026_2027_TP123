import { Track } from './track.model';

/**
 * États possibles d'un upload. `progress` vaut `null` si le navigateur
 * ne connaît pas la taille totale à envoyer (pourcentage indéterminé).
 */
export type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number | null }
  | { status: 'success'; track: Track }
  | { status: 'error'; message: string };
