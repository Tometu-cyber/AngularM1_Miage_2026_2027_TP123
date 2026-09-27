/**
 * Règles d'upload alignées sur le backend (backend/src/app.js : `allowed` et `MAX_FILE_SIZE`).
 * Cette vérification améliore l'expérience utilisateur ; elle ne remplace jamais celle du serveur.
 */
export const ALLOWED_AUDIO_TYPES: readonly string[] = [
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
];

/** 25 Mo, comme `limits.fileSize` de Multer. */
export const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

/** Libellés courts affichés dans les cards à partir du type MIME. */
const FORMAT_LABELS: Record<string, string> = {
  'audio/mpeg': 'MP3',
  'audio/wav': 'WAV',
  'audio/x-wav': 'WAV',
  'audio/ogg': 'OGG',
  'audio/mp4': 'M4A',
  'audio/x-m4a': 'M4A',
};

/** Retourne un message d'erreur si le fichier sera refusé par le backend, sinon une chaîne vide. */
export function validateAudioFile(file: File): string {
  if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
    return `Format non accepté (${file.type || 'inconnu'}). Formats autorisés : MP3, WAV, OGG, M4A.`;
  }
  if (file.size > MAX_AUDIO_SIZE) {
    return `Fichier trop volumineux (${formatSize(file.size)}). Taille maximale : 25 Mo.`;
  }
  if (file.size === 0) {
    return 'Le fichier est vide.';
  }
  return '';
}

/** Convertit une taille en octets en texte lisible (Ko, Mo). */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function formatLabel(mimeType: string): string {
  return FORMAT_LABELS[mimeType] ?? mimeType;
}
