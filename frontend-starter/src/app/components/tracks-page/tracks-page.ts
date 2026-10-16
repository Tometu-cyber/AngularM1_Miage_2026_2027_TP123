import { Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { Track } from '../../shared/models/track.model';
import { UploadState } from '../../shared/models/upload-state.model';
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
  private readonly snackBar = inject(MatSnackBar);
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
  readonly uploadState = signal<UploadState>({ status: 'idle' });
  readonly uploading = computed(() => this.uploadState().status === 'uploading');

  readonly audioUrl = signal('');
  readonly currentTrack = signal<Track | null>(null);
  readonly loadingTrackId = signal('');
  readonly audioError = signal('');

  /** Identifiant de la piste en cours de suppression ('' si aucune). */
  readonly deletingTrackId = signal('');

  /** Requête de liste en cours, annulée si une nouvelle page est demandée entre-temps. */
  private listRequest?: Subscription;
  /** Téléchargement audio en cours, annulé si l'utilisateur choisit un autre morceau. */
  private audioRequest?: Subscription;
  /** Upload en cours, annulé si l'utilisateur quitte la page. */
  private uploadRequest?: Subscription;

  constructor() {
    this.load();
    // L'ObjectURL garde le Blob en mémoire tant qu'il n'est pas révoqué :
    // on libère la dernière URL quand l'utilisateur quitte la page.
    inject(DestroyRef).onDestroy(() => {
      this.audioRequest?.unsubscribe();
      this.uploadRequest?.unsubscribe();
      this.revokeAudioUrl();
    });
  }

  choose(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    console.debug('[TracksPage] Fichier sélectionné', file?.name, file?.type, file?.size);
    this.file.set(file);
    const invalid = file ? validateAudioFile(file) : '';
    this.uploadState.set(invalid ? { status: 'error', message: invalid } : { status: 'idle' });
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
      this.uploadState.set({ status: 'error', message: invalid });
      return;
    }

    this.uploadState.set({ status: 'uploading', progress: 0 });
    this.title.disable();

    // Avec observe: 'events', next() est appelé plusieurs fois : une fois par
    // événement de progression, puis une dernière fois avec la réponse du serveur.
    this.uploadRequest = this.service.upload(file, this.title.value.trim() || file.name).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          // event.total est absent si le navigateur ne connaît pas la taille du corps.
          const progress = event.total ? Math.round((100 * event.loaded) / event.total) : null;
          this.uploadState.set({ status: 'uploading', progress });
        } else if (event.type === HttpEventType.Response && event.body) {
          const track = event.body;
          console.debug('[TracksPage] Piste envoyée', track.id);
          this.uploadState.set({ status: 'success', track });
          this.resetUploadForm();
          this.page.set(1);
          this.load();
        }
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Envoi impossible', error);
        this.title.enable();
        this.uploadState.set({ status: 'error', message: this.uploadErrorMessage(error) });
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

  /**
   * Supprime une piste après confirmation. Le composant ne connaît pas HttpClient :
   * l'appel passe par TrackService. C'est le backend qui vérifie le JWT et le propriétaire.
   */
  remove(track: Track): void {
    // Une seule suppression à la fois : protège contre les doubles clics.
    if (this.deletingTrackId()) return;
    if (!window.confirm(`Supprimer « ${track.title} » ? Cette action est définitive.`)) return;

    this.deletingTrackId.set(track.id);
    this.service.delete(track.id).subscribe({
      next: () => {
        console.debug('[TracksPage] Piste supprimée', track.id);
        this.deletingTrackId.set('');
        this.snackBar.open(`« ${track.title} » a été supprimée.`, 'OK', { duration: 4000 });
        this.afterDelete(track);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Suppression impossible', error);
        this.deletingTrackId.set('');
        this.snackBar.open(this.deleteErrorMessage(error, track), 'Fermer', { duration: 6000 });
        // 404 : la piste a déjà disparu (autre onglet) ou n'appartient pas à l'utilisateur.
        // 500 : la métadonnée est supprimée mais pas le fichier. Dans les deux cas,
        // la liste affichée n'est plus fiable : on la recharge.
        if (error.status === 404 || error.status === 500) this.afterDelete(track);
      },
    });
  }

  /** Arrête la lecture de la piste supprimée et recharge la page courante. */
  private afterDelete(track: Track): void {
    if (this.loadingTrackId() === track.id) {
      this.audioRequest?.unsubscribe();
      this.loadingTrackId.set('');
    }
    if (this.currentTrack()?.id === track.id) {
      this.revokeAudioUrl();
      this.currentTrack.set(null);
    }
    // Si c'était la dernière piste de la page, on recule d'une page.
    if (this.tracks().length === 1 && this.page() > 1) this.page.update((page) => page - 1);
    this.load();
  }

  private deleteErrorMessage(error: HttpErrorResponse, track: Track): string {
    if (error.status === 0) return 'Serveur injoignable. La piste n\'a pas été supprimée.';
    if (error.status === 401) return 'Session expirée. Veuillez vous reconnecter.';
    if (error.status === 404) {
      return `« ${track.title} » n'existe plus ou ne vous appartient pas. La liste a été actualisée.`;
    }
    return error.error?.message ?? `Impossible de supprimer « ${track.title} ».`;
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
