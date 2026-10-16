import { TestBed } from '@angular/core/testing';
import { HttpEvent, HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Track } from '../models/track.model';
import { TrackService } from './track.service';

const track: Track = {
  id: 't1',
  title: 'Blues en La',
  originalName: 'blues.mp3',
  mimeType: 'audio/mpeg',
  size: 1024,
  createdAt: '2026-10-01T10:00:00.000Z',
};

describe('TrackService', () => {
  let service: TrackService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TrackService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() transmet page et limit en paramètres de GET /api/tracks', () => {
    let total = 0;
    service.list(3, 10).subscribe((page) => (total = page.total));

    const request = http.expectOne((req) => req.url === '/api/tracks');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('3');
    expect(request.request.params.get('limit')).toBe('10');
    expect(request.request.urlWithParams).toBe('/api/tracks?page=3&limit=10');

    request.flush({ items: [track], page: 3, limit: 10, total: 21, pages: 3 });
    expect(total).toBe(21);
  });

  it('delete() envoie DELETE /api/tracks/:id', () => {
    let completed = false;
    service.delete('t1').subscribe({ complete: () => (completed = true) });

    const request = http.expectOne('/api/tracks/t1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('upload() envoie un FormData et émet les événements de progression puis la réponse', () => {
    const file = new File(['abc'], 'blues.mp3', { type: 'audio/mpeg' });
    const events: HttpEvent<Track>[] = [];
    service.upload(file, 'Blues en La').subscribe((event) => events.push(event));

    const request = http.expectOne('/api/tracks');
    expect(request.request.method).toBe('POST');
    expect(request.request.reportProgress).toBe(true);
    const body = request.request.body as FormData;
    expect(body.get('title')).toBe('Blues en La');
    expect((body.get('audio') as File).name).toBe('blues.mp3');

    request.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
    request.flush(track, { status: 201, statusText: 'Created' });

    // Sent (requête partie), UploadProgress (octets envoyés), Response (201 + Track).
    expect(events.map((event) => event.type)).toEqual([
      HttpEventType.Sent,
      HttpEventType.UploadProgress,
      HttpEventType.Response,
    ]);
  });
});
