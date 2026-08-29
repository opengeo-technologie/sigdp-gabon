import 'enums.dart';

/// Outcome of decoding a scanned QR/barcode.
class ScanResult {
  final bool recognised;      // parsed as a SIGPA credential
  final CredentialType? type;
  final String? id;
  final bool signatureValid;  // HMAC on embedded payload verified
  final Map<String, dynamic> embedded; // fields carried inside the QR (offline trust)
  final String raw;

  const ScanResult({
    required this.recognised,
    required this.raw,
    this.type,
    this.id,
    this.signatureValid = false,
    this.embedded = const {},
  });

  factory ScanResult.unrecognised(String raw) => ScanResult(recognised: false, raw: raw);
}
