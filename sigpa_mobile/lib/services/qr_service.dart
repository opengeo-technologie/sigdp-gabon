import 'dart:convert';
import 'package:crypto/crypto.dart';
import '../core/app_config.dart';
import '../data/models/enums.dart';
import '../data/models/scan_result.dart';

/// Decodes SIGPA credential QR codes. Two payload shapes are supported:
///
/// 1. Compact signed string (recommended, works fully offline):
///      SIGPA1;T=F;ID=<uuid>;N=<name>;S=<M|F>;VU=<iso8601>;SIG=<hmac-hex>
///    The HMAC-SHA256 over everything before ";SIG=" (keyed with
///    AppConfig.cardSigningKey) lets the device trust the embedded holder data
///    without any network call.
///
/// 2. Bare id fallback (older cards): a raw UUID → looked up in the local
///    credential cache, defaulting to fisher-card type.
class QrService {
  ScanResult decode(String raw) {
    final text = raw.trim();

    // Shape 1: namespaced key/value string.
    if (text.startsWith('${AppConfig.qrNamespace};')) {
      final map = <String, String>{};
      for (final part in text.split(';')) {
        final i = part.indexOf('=');
        if (i > 0) map[part.substring(0, i)] = part.substring(i + 1);
      }
      final type = CredentialTypeX.fromCode(map['T']);
      final id = map['ID'];
      if (type == null || id == null || id.isEmpty) return ScanResult.unrecognised(raw);

      final sig = map.remove('SIG');
      final signedPart = text.contains(';SIG=')
          ? text.substring(0, text.indexOf(';SIG='))
          : text;
      final sigOk = sig != null && _verify(signedPart, sig);

      return ScanResult(
        recognised: true,
        raw: raw,
        type: type,
        id: id,
        signatureValid: sigOk,
        embedded: {
          'holder_name': map['N'],
          'sex': map['S'],
          'valid_until': map['VU'],
          'valid_from': map['VF'],
          'boat_ref': map['B'],
          'state': map['ST'],
        }..removeWhere((_, v) => v == null),
      );
    }

    // Shape 2: bare UUID.
    final uuidRe = RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
    if (uuidRe.hasMatch(text)) {
      return ScanResult(
        recognised: true,
        raw: raw,
        type: CredentialType.fisherCard,
        id: text,
        signatureValid: false,
      );
    }

    return ScanResult.unrecognised(raw);
  }

  bool _verify(String data, String hexSig) {
    final mac = Hmac(sha256, utf8.encode(AppConfig.cardSigningKey));
    final digest = mac.convert(utf8.encode(data));
    return _constantTimeEquals(digest.toString(), hexSig.toLowerCase());
  }

  bool _constantTimeEquals(String a, String b) {
    if (a.length != b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
      diff |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return diff == 0;
  }
}
