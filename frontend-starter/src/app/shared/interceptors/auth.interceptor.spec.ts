import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../testing/memory-storage';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  it('ajoute Authorization: Bearer <token> lorsqu’un token existe', () => {
    auth.token.set('fake.jwt.token');

    client.get('/api/users/me').subscribe();

    const request = http.expectOne('/api/users/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer fake.jwt.token');
    request.flush({});
  });

  it('n’ajoute pas Authorization sans token', () => {
    client.post('/api/auth/login', {}).subscribe();

    const request = http.expectOne('/api/auth/login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('déconnecte et redirige vers /login sur un 401 alors qu’un token était envoyé', () => {
    auth.token.set('expired.jwt.token');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    let status = 0;

    client.get('/api/tracks').subscribe({ error: (error) => (status = error.status) });
    http.expectOne('/api/tracks').flush({ message: 'Token invalide' }, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(auth.token()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
