import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Adds the bearer token to protected API requests and handles expired sessions. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();

  return next(
    token
      ? request.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        })
      : request,
  ).pipe(
    catchError((error: unknown) => {
      // Un 401 sur une requête sans token (ex. mauvais mot de passe au login)
      // n'est pas une session expirée : on ne redirige que si un token était envoyé.
      if (token && error instanceof HttpErrorResponse && error.status === 401) {
        console.warn('[authInterceptor] Session invalide ou expirée, déconnexion');
        auth.logout();
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
