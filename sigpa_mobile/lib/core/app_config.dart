/// Central configuration. Point [apiBaseUrl] at your FastAPI mobile gateway.
///
/// The backend is expected to expose a small POST-only write surface plus a
/// few GET reference endpoints, mirroring the SIGPA Surveillance module style:
///   POST /auth/login
///   POST /mobile/captures
///   POST /mobile/inspections
///   GET  /mobile/reference/fishers?since=<iso8601>
///   GET  /mobile/reference/licenses?since=<iso8601>
///   GET  /mobile/reference/agreements?since=<iso8601>
class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'SIGPA_API',
    defaultValue: 'https://sigdp.org/api',
  );

  /// Shared secret used to verify HMAC signatures embedded in official QR
  /// codes so that a card can be validated even with no network. This value
  /// must match the key the backend uses when it prints the cards.
  static const String cardSigningKey = String.fromEnvironment(
    'SIGPA_CARD_KEY',
    defaultValue: 'change-me-to-match-backend',
  );

  /// How often the background sync loop attempts a flush when online (seconds).
  static const int autoSyncIntervalSec = 45;

  /// App-level namespace prefix in official QR payloads.
  static const String qrNamespace = 'SIGPA1';
}
