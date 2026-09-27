import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';
import { ALLOWED_AUDIO_TYPES, validateAudioFile } from '../../shared/utils/audio-file';
import { TrackCardComponent } from '../track-card/track-card';

@Component({
  imports: [ReactiveFormsModule, TrackCardComponent],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent {
  private readonly service = inject(TrackService);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  /** Valeur de l'attribut `accept` : mêmes types MIME que le backend. */
  readonly accept = ALLOWED_AUDIO_TYPES.join(',');

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly limit = signal(5);
  readonly pages = signal(1);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly title = new FormControl('', { nonNullable: true });
  readonly file = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');

  readonly audioUrl = signal('');
  readonly currentTrack = signal<Track | null>(null);
  readonly loadingTrackId = signal('');
  readonly audioError = signal('');

  /** Requête de liste en cours, annulée si une nouvelle page est demandée entre-temps. */
  private listRequest?: Subscription;
  /** Téléchargement audio en cours, annulé si l'utilisateur choisit un autre morceau. */
  private audioRequest?: Subscription;

  constructor() {
    this.load();
    // L'ObjectURL garde le Blob en mémoire tant qu'il n'est pas révoqué :
    // on libère la dernière URL quand l'utilisateur quitte la page.
    inject(DestroyRef).onDestroy(() => {
      this.audioRequest?.unsubscribe();
      this.revokeAudioUrl();
    });
  }

  choose(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    console.debug('[TracksPage] Fichier sélectionné', file?.name, file?.type, file?.size);
    this.file.set(file);
    this.uploadSuccess.set('');
    this.uploadError.set(file ? validateAudioFile(file) : '');
  }

  /** Demande au serveur la page courante : aucune découpe locale n'est faite côté Angular. */
  load(): void {
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.listRequest = this.service.list(this.page(), this.limit()).subscribe({
      next: (response) => {
        console.debug('[TracksPage] Pistes chargées', response.items.length);
        this.tracks.set(response.items);
        this.page.set(response.page);
        this.pages.set(response.pages);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Chargement impossible', error);
        this.tracks.set([]);
        this.error.set(this.listErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  go(page: number): void {
    if (page < 1 || page > this.pages() || page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  private listErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) return 'Serveur injoignable. Vérifiez que le backend est lancé.';
    if (error.status === 401) return 'Session expirée. Veuillez vous reconnecter.';
    return error.error?.message ?? 'Impossible de charger vos pistes.';
  }

  upload(): void {
    const file = this.file();
    // Empêche les doubles soumissions même si le bouton est réactivé par le DOM.
    if (!file || this.uploading()) return;

    const invalid = validateAudioFile(file);
    if (invalid) {
      this.uploadError.set(invalid);
      return;
    }

    this.uploading.set(true);
    this.uploadError.set('');
    this.uploadSuccess.set('');
    this.title.disable();

    this.service.upload(file, this.title.value.trim() || file.name).subscribe({
      next: (track) => {
        console.debug('[TracksPage] Piste envoyée', track.id);
        this.uploading.set(false);
        this.uploadSuccess.set(`« ${track.title} » a bien été ajoutée.`);
        this.resetUploadForm();
        this.page.set(1);
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Envoi impossible', error);
        this.uploading.set(false);
        this.title.enable();
        this.uploadError.set(this.uploadErrorMessage(error));
      },
    });
  }

  private resetUploadForm(): void {
    this.title.enable();
    this.title.reset();
    this.file.set(null);
    this.fileInput().nativeElement.value = '';
  }

  private uploadErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) return 'Serveur injoignable. Réessayez plus tard.';
    if (error.status === 401) return 'Session expirée. Veuillez vous reconnecter.';
    const message = error.error?.message ?? "L'envoi a échoué.";
    return error.status === 400 ? `Fichier refusé par le serveur : ${message}` : message;
  }

  play(track: Track): void {
    this.audioRequest?.unsubscribe();
    this.loadingTrackId.set(track.id);
    this.audioError.set('');

    // HttpClient passe par l'intercepteur, qui ajoute le JWT : c'est pourquoi
    // on télécharge un Blob au lieu de mettre l'URL de l'API dans <audio src>.
    this.audioRequest = this.service.audio(track.id).subscribe({
      next: (blob) => {
        console.debug('[TracksPage] Audio chargé', track.id, blob.type, blob.size);
        this.revokeAudioUrl();
        this.audioUrl.set(URL.createObjectURL(blob));
        this.currentTrack.set(track);
        this.loadingTrackId.set('');
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Lecture impossible', error);
        this.loadingTrackId.set('');
        this.audioError.set(this.audioErrorMessage(error, track));
      },
    });
  }

  /** Erreur levée par l'élément <audio> lui-même (format non décodable, fichier corrompu…). */
  onAudioError(): void {
    const title = this.currentTrack()?.title ?? 'ce morceau';
    console.error('[TracksPage] Erreur du lecteur audio', title);
    this.audioError.set(
      `Le navigateur ne parvient pas à lire « ${title} » : format non supporté ou fichier endommagé.`,
    );
  }

  private audioErrorMessage(error: HttpErrorResponse, track: Track): string {
    if (error.status === 0) return 'Serveur injoignable. Impossible de charger le morceau.';
    if (error.status === 401) return 'Session expirée. Veuillez vous reconnecter.';
    // Avec responseType 'blob', le corps d'erreur JSON arrive aussi sous forme de Blob :
    // on s'appuie donc sur le statut HTTP plutôt que sur error.error.message.
    if (error.status === 404) {
      return `« ${track.title} » est introuvable ou ne vous appartient pas.`;
    }
    return `Impossible de charger « ${track.title} ».`;
  }

  private revokeAudioUrl(): void {
    const url = this.audioUrl();
    if (url) {
      URL.revokeObjectURL(url);
      console.debug('[TracksPage] ObjectURL révoquée', url);
    }
    this.audioUrl.set('');
  }
}
