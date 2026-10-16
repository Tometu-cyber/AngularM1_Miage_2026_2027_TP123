import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../testing/memory-storage';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  // Échoue si une requête inattendue a été émise ou si une requête attendue n'a pas été traitée.
  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  it('login() envoie POST /api/auth/login avec email et mot de passe, puis mémorise le token', () => {
    let userName = '';
    service.login('demo@example.com', 'secret123').subscribe((response) => (userName = response.user.name));

    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'demo@example.com', password: 'secret123' });

    request.flush({
      token: 'fake.jwt.token',
      user: { id: 'u1', name: 'Demo', email: 'demo@example.com' },
    });

    expect(userName).toBe('Demo');
    expect(service.token()).toBe('fake.jwt.token');
    expect(service.currentUser()?.email).toBe('demo@example.com');
    expect(localStorage.getItem('gpc_token')).toBe('fake.jwt.token');
  });

  it('login() ne stocke rien si le backend répond 401', () => {
    let status = 0;
    service.login('demo@example.com', 'mauvais').subscribe({ error: (error) => (status = error.status) });

    http
      .expectOne({ method: 'POST', url: '/api/auth/login' })
      .flush({ message: 'Identifiants incorrects' }, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(service.token()).toBeNull();
    expect(localStorage.getItem('gpc_token')).toBeNull();
  });
});
