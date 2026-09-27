import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePageComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly saved = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.auth.profile().subscribe({
      next: (user) => {
        console.debug('[ProfilePage] Profil chargé', user.id);
        this.form.setValue({ name: user.name });
      },
      error: (error: { error?: { message?: string } }) => {
        console.error('[ProfilePage] Chargement impossible', error);
        this.error.set(error.error?.message ?? 'Impossible de charger le profil');
      },
    });
  }

  save(): void {
    this.saved.set(false);
    this.error.set('');
    this.auth.update(this.form.getRawValue().name).subscribe({
      next: (user) => {
        console.debug('[ProfilePage] Profil enregistré', user.id);
        this.saved.set(true);
      },
      error: (error: { error?: { message?: string } }) => {
        console.error('[ProfilePage] Enregistrement impossible', error);
        this.error.set(error.error?.message ?? 'Impossible d’enregistrer le profil');
      },
    });
  }
}
