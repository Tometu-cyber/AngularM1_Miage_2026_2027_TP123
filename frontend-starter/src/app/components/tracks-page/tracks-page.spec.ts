import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Page } from '../../shared/models/page.model';
import { Track } from '../../shared/models/track.model';
import { TracksPageComponent } from './tracks-page';

const blues: Track = {
  id: 't1',
  title: 'Blues en La',
  originalName: 'blues.mp3',
  mimeType: 'audio/mpeg',
  size: 1024,
  createdAt: '2026-10-01T10:00:00.000Z',
};
const funk: Track = { ...blues, id: 't2', title: 'Funk en Mi', originalName: 'funk.mp3' };

const page = (items: Track[]): Page<Track> => ({ items, page: 1, limit: 5, total: items.length, pages: 1 });

describe('TracksPageComponent', () => {
  let fixture: ComponentFixture<TracksPageComponent>;
  let component: TracksPageComponent;
  let http: HttpTestingController;
  const snackBar = { open: vi.fn() };

  /** Répond à la requête de liste attendue (au chargement ou après une action). */
  const expectList = (): TestRequest => {
    const request = http.expectOne((req) => req.method === 'GET' && req.url === '/api/tracks');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('limit')).toBe('5');
    return request;
  };

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    snackBar.open.mockReset();
    TestBed.configureTestingModule({
      imports: [TracksPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    fixture = TestBed.createComponent(TracksPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('affiche une erreur après un échec HTTP du chargement', async () => {
    expectList().flush({ message: 'Erreur interne' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(component.error()).toBe('Erreur interne');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Erreur interne');
  });

  it('la suppression confirmée appelle DELETE /api/tracks/:id puis recharge la liste', async () => {
    expectList().flush(page([blues, funk]));
    await fixture.whenStable();
    expect(text()).toContain('Blues en La');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.remove(blues);
    expect(component.deletingTrackId()).toBe('t1');

    // Un second clic pendant la suppression n'émet pas de nouvelle requête (http.verify le garantit).
    component.remove(blues);

    const request = http.expectOne('/api/tracks/t1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(component.deletingTrackId()).toBe('');
    expect(snackBar.open).toHaveBeenCalledWith('« Blues en La » a été supprimée.', 'OK', { duration: 4000 });

    expectList().flush(page([funk]));
    await fixture.whenStable();
    expect(text()).not.toContain('Blues en La');
    expect(text()).toContain('Funk en Mi');
  });

  it('n’envoie aucune requête si l’utilisateur annule la confirmation', () => {
    expectList().flush(page([blues]));
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.remove(blues);

    http.expectNone('/api/tracks/t1');
    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('une piste déjà supprimée (404) affiche un message et recharge la liste', () => {
    expectList().flush(page([blues]));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.remove(blues);
    http.expectOne('/api/tracks/t1').flush({ message: 'Piste inconnue' }, { status: 404, statusText: 'Not Found' });

    expect(snackBar.open).toHaveBeenCalledWith(
      '« Blues en La » n\'existe plus ou ne vous appartient pas. La liste a été actualisée.',
      'Fermer',
      { duration: 6000 },
    );
    expectList().flush(page([]));
  });

  it('l’upload met à jour la progression puis passe en succès', async () => {
    expectList().flush(page([]));
    component.file.set(new File(['abc'], 'blues.mp3', { type: 'audio/mpeg' }));

    component.upload();
    expect(component.uploadState()).toEqual({ status: 'uploading', progress: 0 });
    expect(component.title.disabled).toBe(true);

    // Une seconde soumission pendant l'envoi est ignorée.
    component.upload();
    const request = http.expectOne((req) => req.method === 'POST' && req.url === '/api/tracks');

    request.event({ type: HttpEventType.UploadProgress, loaded: 42, total: 100 });
    expect(component.uploadState()).toEqual({ status: 'uploading', progress: 42 });
    await fixture.whenStable();
    expect(text()).toContain('Envoi : 42 %');
    expect(fixture.nativeElement.querySelector('progress').value).toBe(42);

    request.flush(blues, { status: 201, statusText: 'Created' });
    expect(component.uploadState()).toEqual({ status: 'success', track: blues });
    expect(component.title.enabled).toBe(true);
    expect(component.file()).toBeNull();

    expectList().flush(page([blues]));
  });

  it('l’upload passe en erreur et réactive le formulaire si le serveur refuse le fichier', () => {
    expectList().flush(page([]));
    component.file.set(new File(['abc'], 'blues.mp3', { type: 'audio/mpeg' }));

    component.upload();
    http
      .expectOne((req) => req.method === 'POST' && req.url === '/api/tracks')
      .flush({ message: 'Format audio non accepté' }, { status: 400, statusText: 'Bad Request' });

    expect(component.uploadState()).toEqual({
      status: 'error',
      message: 'Fichier refusé par le serveur : Format audio non accepté',
    });
    expect(component.uploading()).toBe(false);
    expect(component.title.enabled).toBe(true);
  });
});
