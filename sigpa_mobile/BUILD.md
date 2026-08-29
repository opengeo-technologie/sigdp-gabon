# Construire l'APK

L'APK ne peut pas être compilé dans un environnement sans SDK Flutter/Android.
Deux voies fiables :

## Option A — GitHub Actions (aucune installation locale)

1. Créer un dépôt GitHub et y pousser ce projet :
   ```bash
   git init && git add . && git commit -m "SIGPA Terrain"
   git branch -M main
   git remote add origin https://github.com/<vous>/sigpa-mobile.git
   git push -u origin main
   ```
2. (Optionnel) Dépôt → Settings → Secrets and variables → Actions :
   - Variable `SIGPA_API` = URL de votre API
   - Secret `SIGPA_CARD_KEY` = clé de signature des cartes
3. Le workflow `.github/workflows/build-apk.yml` se lance au push (ou
   Actions → Build APK → Run workflow). À la fin, téléchargez l'artefact
   **sigpa-apk** depuis la page du run. C'est votre `app-release.apk`.

## Option B — En local

Prérequis : Flutter SDK + Android SDK (via Android Studio), Java 17.

```bash
flutter create --platforms=android .        # génère le dossier android/
# fusionner android_manifest_snippet.xml dans
#   android/app/src/main/AndroidManifest.xml
flutter pub get
flutter build apk --release \
  --dart-define=SIGPA_API=https://votre-serveur/api \
  --dart-define=SIGPA_CARD_KEY=<clé>
# => build/app/outputs/flutter-apk/app-release.apk
```

APK par découpage d'ABI (fichiers plus légers) :
```bash
flutter build apk --release --split-per-abi
```

### Signature de production
Par défaut l'APK release est signé avec la clé de debug (suffisant pour les
tests terrain, pas pour le Play Store). Pour une vraie signature, créez un
keystore et un `android/key.properties`, puis référencez-le dans
`android/app/build.gradle` (voir docs Flutter « Signing the app »).
