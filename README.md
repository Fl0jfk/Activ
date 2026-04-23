# Activ

## Configuration Clerk (obligatoire)

Ajoute ces variables dans `.env.local`:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/espace`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/espace`

## Configuration JSON club

- `CLUB_DATA_KEY=data/club-data.json` (optionnel, valeur par defaut deja codee)

Le fichier `data/club-data.json` sert de seed local puis est synchronise vers S3 (meme bucket que `SITE_DATA_KEY`).

## Nouvelles pages

- `/sign-in` et `/sign-up`: connexion/inscription Clerk
- `/espace`: formulaire de preinscription + choix creneau d'essai
- `/club-admin`: interface president/secretaire pour:
  - creer des creneaux d'essai
  - valider/refuser les demandes
  - suivre paiement et essai realise
  - attribuer des fonctions (`president`, `secretary`, `teacher`, `coach`) sans edition manuelle du metadata
