# Activ' Sainte-Croix Sport et Culture

Site de l'association (Next.js, Clerk, S3).

## Pages publiques

- `/` : accueil (présentation, actualités, planning, disciplines, photos)
- `/actualites` et `/actualites/[id]` : actualités et événements
- `/disciplines/[slug]` : fiche d'une discipline (`/essai` : réservation d'une séance d'essai)
- `/galerie` : toutes les photos
- `/association` : organigramme
- `/contact`, `/preinscription`
- `/sign-in` : connexion adhérents (Clerk)

## Espace connecté

- `/espace` : espace adhérent, coach et bureau
- `/espace/bureau/*` : outils du bureau (dossiers, adhérents, planning, contenu, communication)
- `/admin` et `/club-admin` redirigent vers `/espace`

## Contenu du site

Le contenu (disciplines, planning, actualités, photos, sondages) est dans `data/site-data.json` (copie locale) puis synchronisé vers S3 (`SITE_DATA_KEY`). Il se modifie depuis l'espace bureau.

- La photo en position 1 de la liste « Photos du site » illustre le haut de l'accueil.
- Les 10 dernières photos de la liste s'affichent en mosaïque sur l'accueil ; toutes sont sur `/galerie`.
- Les pages publiques lisent les données avec un cache de 30 secondes (`readPublicSiteData`).

## Variables d'environnement (`.env.local`)

Clerk :

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/espace`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/espace`

Stockage S3 : `REGION`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `BUCKET_NAME`, `SITE_DATA_KEY`, `CLUB_DATA_KEY` (valeurs par défaut `data/site-data.json` et `data/club-data.json`).

E-mails : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `CONTACT_TO`.

Autres :

- `NEXT_PUBLIC_APP_URL` : URL du site utilisée dans les e-mails et les reçus.
- `NEXT_PUBLIC_SITE_URL` : URL canonique pour le SEO (défaut `https://activsaintecroix.fr`).
- `MISTRAL_API_KEY`, `MISTRAL_MODEL` : assistant d'orientation (limité à 12 questions par 10 minutes et par visiteur).
- `EMAIL_VERIFICATION_SECRET` : signature des codes de vérification d'e-mail.

## Développement

```bash
npm install
npm run dev
```
