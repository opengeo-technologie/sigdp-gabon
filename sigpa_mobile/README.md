# SIGPA Terrain — application mobile d'inspection & de captures

Application Flutter **offline-first** pour les inspecteurs de la pêche (Gabon),
intégrée au **SIGPA** (Système d'Information de Gestion de la Pêche et de
l'Aquaculture). Le **scan de QR** (cartes de pêcheur, licences, agréments) est
le point d'entrée prioritaire de tous les flux.

## Fonctionnalités

- **Scan QR prioritaire** — l'écran d'accueil met le scan en avant. Un code
  scanné résout le titulaire, affiche sa **validité** (valide / expiré /
  suspendu) et propose directement « Nouvelle capture » ou « Nouvelle
  inspection », pré-rempli.
- **Validation hors ligne des cartes** — les QR officiels peuvent embarquer les
  données du titulaire signées en **HMAC-SHA256**. Le téléphone vérifie la
  signature sans réseau (clé partagée `SIGPA_CARD_KEY`). À défaut, le cache
  local des références est utilisé.
- **Captures sur pont** — pêcheur (avec **ventilation par sexe**), engin (liste
  du classeur 2024 : filet maillant fond/dérivant, filet mulet, filet sardine,
  ligne de fond, ligne à main, senne tournante), espèce, groupe
  (pélagiques/démersaux/crustacés), quantité (kg), valeur (f.CFA), GPS.
- **Inspections bateau** — alignées sur le module Surveillance (SCS) :
  réf. mission, licence scannée, personnes contrôlées (ventilation par sexe et
  rôle), catalogue d'infractions (→ `srv_infractions`), saisie, observations.
- **Moteur de synchronisation bidirectionnel** — outbox durable (push des
  captures/inspections en POST idempotent sur `client_id`) + pull des
  références. Se déclenche au retour du réseau, sur minuterie, et à la demande.
- **Indicateur en ligne / hors ligne** et file d'attente visible.

## Architecture

```
lib/
  core/            config (URL API, clé de signature), thème
  data/
    models/        credential, capture, inspection, enums, scan_result
    local/         base SQLite + DAO (references, records, sync/outbox)
    remote/        ApiClient (Dio), SyncService (push/pull)
    repositories/  façade utilisée par l'UI
  services/        connectivité, décodage QR, GPS, auth
  ui/
    screens/       login, home, scan, capture_form, inspection_form, sync
    widgets/       badge de connexion, champ « sexe »
```

Offline-first : toute saisie est écrite en local **puis** mise en file. Un
enregistrement ne peut jamais exister sans son entrée d'outbox (transaction).

## Backend attendu (FastAPI)

Petite surface, cohérente avec le style POST-only du module Surveillance :

| Méthode | Endpoint | Rôle |
|--------|----------|------|
| POST | `/auth/login` | `{access_token, display_name}` |
| POST | `/mobile/captures` | crée une capture ; répond `{id}` ; **idempotent** sur `client_id` |
| POST | `/mobile/inspections` | crée l'inspection + chaîne contrôle/infractions ; répond `{id}` |
| GET  | `/mobile/reference/fishers?since=` | cartes pêcheur modifiées depuis `since` |
| GET  | `/mobile/reference/licenses?since=` | licences |
| GET  | `/mobile/reference/agreements?since=` | agréments |

Les endpoints de référence renvoient soit une liste, soit `{items: [...]}`.
Champs acceptés en FR ou EN (ex. `sexe`/`sex`, `date_fin`/`valid_until`).

### Format du QR officiel (recommandé, hors-ligne)

```
SIGPA1;T=F;ID=<uuid>;N=<nom>;S=<M|F>;VU=<iso8601>;B=<immat>;SIG=<hmac-hex>
```

`T` = `F` (pêcheur) / `L` (licence) / `A` (agrément).
`SIG` = HMAC-SHA256 (clé backend) de tout le texte avant `;SIG=`.
Un simple UUID est aussi accepté (résolu via le cache local).

## Installation

```bash
# 1. Générer les dossiers de plateforme
flutter create .

# 2. Fusionner les permissions
#    - android_manifest_snippet.xml -> android/app/src/main/AndroidManifest.xml
#    - ios_info_plist_snippet.xml   -> ios/Runner/Info.plist
#    - android : minSdkVersion 21

# 3. Dépendances
flutter pub get

# 4. Lancer en pointant vers votre API + clé de signature
flutter run \
  --dart-define=SIGPA_API=https://votre-serveur/api \
  --dart-define=SIGPA_CARD_KEY=<clé-partagée-backend>
```

## Points d'extension

- Résolution de conflits au pull (actuellement last-write-wins par `updated_at`).
- Photos de capture/infraction (ajouter un champ blob + upload multipart).
- Signature électronique du PV et génération PDF hors-ligne.
- Rattachement automatique de la mission via géorepérage des zones SCS.
