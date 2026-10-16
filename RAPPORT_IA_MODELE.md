# Rapport d'usage de l'IA - TP1

Pour chaque mission, détailler et fournir des explications concernant : objectif; prompt principal; plan proposé par l'agent; vérifications réalisées par le binôme; erreurs ou propositions rejetées; fichiers effectivement modifiés; preuve de fonctionnement; ce que chaque membre sait maintenant expliquer sans l'agent.

## Outil et modèle utilisés

- **Outil :** Claude Code, extension VS Code, avec accès au workspace
- **Modèle :** Claude Opus 5.5 (`claude-opus-5-5`)
- **Suivre la consommation de tokens :** dans Claude Code, la commande `/cost` donne la consommation de la session et `/usage` montre l'utilisation par rapport aux limites de l'abonnement. La console Anthropic donne le détail pour un usage via l'API.
- **Qui peut conseiller le meilleur modèle pour une tâche :**
  - l'enseignant ;
  - la documentation de l'éditeur, qui compare les modèles (coût, vitesse, capacités) ;
  - le sélecteur `/model` de l'outil, qui décrit chaque modèle.

  En pratique, un petit modèle rapide suffit pour les explications et les tâches simples. Un modèle plus puissant est utile pour les modifications sur plusieurs fichiers et les vérifications.
- **Règles respectées :** l'URI MongoDB, le secret JWT (`backend/.env`), les mots de passe et les tokens n'ont jamais été transmis à l'assistant ni recopiés dans ce rapport.

## Mission 0 — Cartographier l'application

- **Objectif :** repérer le composant racine, les routes, l'enregistrement de `HttpClient`, les modèles, services et pages, et le mécanisme qui ajoute le JWT. Produire un schéma du flux « Se connecter ».
- **Prompt principal :** _À compléter_
- **Plan proposé par l'agent :** _À compléter_
- **Cartographie obtenue :**

  | Élément | Fichier |
  | --- | --- |
  | Composant racine | `src/app/components/app/app.ts` (`AppComponent`, sélecteur `app-root`) |
  | Configuration des routes | `src/app/routes.ts` |
  | Enregistrement de `HttpClient` et de l'intercepteur | `src/main.ts` : `provideHttpClient(withInterceptors([authInterceptor]))` |
  | Modèles | `src/app/shared/models/` (`user`, `auth-response`, `track`, `page`) |
  | Services | `src/app/shared/services/` (`auth.service.ts`, `track.service.ts`) |
  | Pages | `src/app/components/` (`login-page`, `register-page`, `profile-page`, `tracks-page`) |
  | Ajout du JWT | `src/app/shared/interceptors/auth.interceptor.ts` |
  | Protection des routes | `src/app/shared/guards/auth.guard.ts` |

- **Routes publiques et protégées** (d'après `API_CONTRACT.md`) :
  - publiques : `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login` ;
  - protégées (en-tête `Authorization: Bearer …`) : `GET` et `PUT /api/users/me`, et toutes les routes `/api/tracks…`.
- **Fichiers modifiés :** `frontend-starter/SCHEMA_FLUX_LOGIN.mmd` (commit `420dbc4`)
- **Preuve :** [SCHEMA_FLUX_LOGIN.mmd](frontend-starter/SCHEMA_FLUX_LOGIN.mmd)

## Mission 1 — Inscription, connexion et profil

- **Objectif :** formulaires réactifs d'inscription et de connexion avec validations, appels à l'API via `AuthService`, stockage du JWT, Signal `currentUser`, redirections, déconnexion, profil (`GET` et `PUT /api/users/me`) et gestion du `401`.
- **Prompt principal :** *pour le moment j'ai finit que la mission 0, tu peux me confirmer que les modifs en cours sont à commiter dans "Mission 1 - ..."*
- **Plan proposé par l'agent :** 
Oui, tout le code modifié et pas encore commité correspond à la Mission 1 :

- les formulaires réactifs avec leurs validations et messages d'erreur (`login-page.html`, `register-page.html`, `register-page.ts`) ;
- le bouton de déconnexion et le nom affiché dans l'en-tête (`app.html`, `app.ts`) ;
- le chargement et la modification du profil (`profile-page.ts`, `profile-page.html`) ;
- la redirection vers `/login` sur un `401` (`auth.interceptor.ts`).

**Seule exception : `SUJET_ETUDIANT_TP1.md`.** Il n'y a que du reformatage automatique (le tableau aligné et une indentation), rien qui concerne la Mission 1. Je te conseille de ne pas le commiter et d'annuler la modif :
```bash
git restore SUJET_ETUDIANT_TP1.md
```

Pour le message de commit, je te propose : `Mission 1 - Inscription, connexion et profil`.

Par contre, la Mission 1 n'est pas encore complète côté livrables : il manque les captures Network, l'explication Signal vs `localStorage` et l'entrée dans `RAPPORT_IA_MODELE.md`. Tu peux commiter le code maintenant et ajouter ces livrables dans un second commit, ou tout mettre dans le même.

Je peux faire le commit si tu veux (sans `SUJET_ETUDIANT_TP1.md`).
- **Fichiers modifiés** (commit `331301a`) :
  - `login-page.html` : messages d'erreur par champ ;
  - `register-page.ts` et `register-page.html` : validateurs (`required`, `email`, `minLength`) et messages d'erreur ;
  - `profile-page.ts` et `profile-page.html` : chargement du profil, formulaire de modification du nom, messages de succès et d'erreur ;
  - `app.ts` et `app.html` : liens selon l'état de connexion, nom de l'utilisateur, bouton de déconnexion ;
  - `auth.interceptor.ts` : sur un `401` avec un token envoyé, appel à `logout()` puis redirection vers `/login`.
- **Vérifications réalisées avec l'assistant (session du 2026-09-27) :**
  - relecture de tous les points de la Mission 1 dans le code : tous traités ;
  - `ng build` réussi, sans erreur ;
  - rejeu des requêtes sur l'API lancée en local (JWT masqué dans les sorties) :

    | Requête | Statut |
    | --- | --- |
    | Connexion réussie | `200` |
    | Connexion avec un mauvais mot de passe | `401` |
    | `GET /api/users/me` | `200` |
    | `PUT /api/users/me` | `200` |
    | `GET /api/users/me` sans token | `401` |
    | `GET /api/users/me` avec un token invalide | `401` |

  - _À compléter : les tests faits par le binôme dans le navigateur._
- **Choix discutés :**
  - L'intercepteur ne redirige vers `/login` que si un token était envoyé. Sinon, un mauvais mot de passe (`401` sur `/api/auth/login`) viderait l'état et rechargerait la page au lieu d'afficher « Identifiants incorrects ».
  - Les logs du front (`console.debug` et `console.error`) n'affichent jamais le token ni le mot de passe, seulement l'identifiant de l'utilisateur ou l'objet d'erreur HTTP.
- **Améliorations relevées par l'assistant, pas encore faites :**
  - après un rechargement, `currentUser` reste `null` tant que la page profil n'a pas été ouverte ;
  - le message d'erreur de la page de connexion n'est pas effacé quand on soumet à nouveau le formulaire.
- **Preuves de fonctionnement :** [LIVRABLES_TP1.md](LIVRABLES_TP1.md) (checkpoint Network, logs backend) et les captures suivantes :
  - [connexion réussie](docs/captures/network-login-200.png)
  - [connexion refusée](docs/captures/network-login-401.png)
  - [lecture du profil](docs/captures/network-users-me-get.png)
  - [modification du profil](docs/captures/network-users-me-put.png)
- **Ce que chaque membre sait maintenant expliquer sans l'agent :** _À compléter. Par exemple : le trajet d'une requête de connexion, le rôle de l'intercepteur et du guard, la différence entre Signal et `localStorage`, pourquoi un `401` au login ne déconnecte pas._

# TP3 — Fiabilisation et enrichissement du frontend

- **Prompt initial (session du 2026-10-02) :** *Tu peux analyser le projet frontend-starter et regarder ce qu'il reste à faire pour valider SUJET_ETUDIANT_TP3.md, et il faudra sûrement faire un LIVRABLES_TP3.md*
- **Analyse de l'agent avant modification :** aucune mission du TP3 n'était commencée. `TrackService` n'avait pas de méthode `delete()`, les cards n'avaient pas de bouton de suppression, l'upload n'émettait que la réponse finale, aucun fichier `*.spec.ts` n'existait, et Angular Material (SnackBar) et `jsdom` (DOM des tests) n'étaient pas installés. Le build initial passait.

## Mission 5 — Suppression d'une piste

- **Objectif :** supprimer une piste depuis sa card avec confirmation, état anti-double-clic, SnackBar, rechargement et gestion du `404`.
- **Plan proposé par l'agent :** ajouter `TrackService.delete()`, un `output remove` et un `input deleting` sur la card, puis `remove()` / `afterDelete()` dans `TracksPageComponent`. `404` et `500` rechargent la liste.
- **Choix discutés :** `window.confirm` plutôt qu'un `MatDialog` (plus simple et facile à simuler dans les tests). Si on supprime la dernière piste d'une page > 1, on revient à la page précédente. Si la piste supprimée était en lecture, on arrête la lecture et on révoque l'`ObjectURL`.
- **Fichiers modifiés :** `track.service.ts`, `track-card.{ts,html,css}`, `tracks-page.{ts,html}`, `angular.json` (thème Material), `package.json`.
- **Vérifications par le binôme (2026-10-16) :** suppression faite dans le navigateur sur la piste `demo-tp3.wav` qui venait d'être envoyée. La confirmation s'affiche. Après « OK », l'onglet Network montre `DELETE /api/tracks/6ad211ad1bae019c285be71a` → `204 No Content`, avec le même `id` que dans la réponse de l'upload. La card disparaît de la liste après le rechargement. Capture : [network-tracks-delete-204.png](docs/captures/network-tracks-delete-204.png). Le cas « piste déjà supprimée » (`404`) n'a pas été testé avec deux onglets. Il est couvert par le test automatisé 14 et par l'appel `curl` du livrable (second `DELETE` → `404 Piste inconnue`).

## Mission 6 — Progression de l'upload

- **Objectif :** afficher les états aucun upload / en cours avec pourcentage / réussite / échec, et bloquer la double soumission.
- **Plan proposé par l'agent :** `observe: 'events'` + `reportProgress: true` dans le service. Un seul Signal `uploadState` typé par une union discriminée (`upload-state.model.ts`) remplace `uploading`, `uploadError` et `uploadSuccess`, avec `uploading` en `computed`. Affichage avec `<progress>` et `@let` / `@if`.
- **Proposition corrigée :** la première version du template utilisait un `@switch` avec des `@if` imbriqués pour retrouver le type de chaque état. Elle a été remplacée par une chaîne `@if / @else if` sur `state.status`, plus lisible.
- **Fichiers modifiés :** `track.service.ts`, `upload-state.model.ts` (nouveau), `tracks-page.{ts,html,css}`.
- **Vérifications par le binôme (2026-10-16) :** upload d'un fichier WAV de 5,3 Mo (`demo-tp3.wav`) dans le navigateur. `POST /api/tracks` → `201 Created`. La réponse contient la `Track` créée (`id`, `ownerId`, `mimeType: audio/wav`, `size: 5292044`). La piste apparaît ensuite dans la liste. Captures : [network-tracks-upload-progress.png](docs/captures/network-tracks-upload-progress.png) et [network-tracks-upload-response.png](docs/captures/network-tracks-upload-response.png). En local, l'envoi est presque instantané, donc la progression n'a pas été capturée à l'écran. Les étapes `0 %` → `42 %` → succès sont vérifiées par les tests automatisés 5 et 15.

## Mission 7 — Tests automatisés

- **Objectif :** au moins trois tests frontend qui vérifient URL, méthodes, paramètres, en-têtes et résultats simulés, sans backend.
- **Plan proposé par l'agent :** 16 tests dans 5 fichiers (`AuthService`, `TrackService`, `authInterceptor`, `authGuard`, `TracksPageComponent`) avec `HttpTestingController`, plus 4 tests backend facultatifs (`401` ×2, `400` ×2) qui ne nécessitent pas MongoDB.
- **Erreurs rencontrées et corrigées :**
  - `ng test` cherchait une configuration `development` absente : ajout de `buildTarget: "gpc:build"` ;
  - avec Node 26, `localStorage` était `undefined` dans les tests (le `localStorage` natif de Node masque celui de jsdom). Correction : un stockage en mémoire injecté avec `vi.stubGlobal` (`shared/testing/memory-storage.ts`) ;
  - le test d'upload attendait `[UploadProgress, Response]`, mais Angular émet d'abord `Sent`. L'assertion a été corrigée et commentée.
- **Preuve :** `16 passed (16)` côté frontend, `pass 6 fail 0` côté backend, `npm run build` réussi. Contre-vérification : remplacer `delete` par `post` dans le service fait échouer 2 tests. Détail dans [LIVRABLES_TP3.md](LIVRABLES_TP3.md).
- **Ce que chaque membre sait maintenant expliquer sans l'agent :**
  - le trajet d'une suppression : card → `(remove)` → `TracksPageComponent.remove()` → `TrackService.delete()` → intercepteur (JWT) → `DELETE /api/tracks/:id` → `204`, puis rechargement de la liste ;
  - pourquoi le guard ne protège rien côté serveur : la sécurité réelle vient de `jwt.verify` et du filtre `{ _id, ownerId: req.auth.sub }`, qui renvoie `404` pour la piste d'un autre utilisateur ;
  - la différence entre `observe: 'body'` (une seule valeur) et `observe: 'events'` (`Sent`, `UploadProgress`…, `Response`), et le calcul `Math.round(100 * loaded / total)` ;
  - le rôle de `HttpTestingController` : `expectOne` vérifie l'URL et la méthode, `flush` et `event` simulent la réponse, `verify` détecte une requête en trop. C'est pour ça que les tests ne dépendent ni du backend ni de MongoDB ;
  - la différence entre un test unitaire (une unité isolée, dépendances simulées) et un test d'intégration (plusieurs couches réelles ensemble).
