import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Page } from '../models/page.model';
import { Track } from '../models/track.model';

/** Encapsulates all HTTP operations for backing tracks. */
@Injectable({ providedIn: 'root' })
export class TrackService {
  private readonly http = inject(HttpClient);

  list(page = 1, limit = 5) {
    return this.http.get<Page<Track>>('/api/tracks', {
      params: { page, limit },
    });
  }

  /**
   * `observe: 'events'` + `reportProgress: true` : l'Observable émet chaque
   * HttpEvent (Sent, UploadProgress…, Response) au lieu de la seule réponse finale.
   */
  upload(file: File, title: string) {
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    return this.http.post<Track>('/api/tracks', body, {
      observe: 'events',
      reportProgress: true,
    });
  }

  audio(id: string) {
    return this.http.get(`/api/tracks/${id}/audio`, {
      responseType: 'blob',
    });
  }

  /** Le backend répond `204` sans corps, ou `404` si la piste n'existe plus ou appartient à un autre utilisateur. */
  delete(id: string) {
    return this.http.delete<void>(`/api/tracks/${id}`);
  }
}
