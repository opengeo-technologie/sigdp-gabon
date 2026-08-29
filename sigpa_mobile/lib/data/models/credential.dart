import 'enums.dart';

/// A cached, scannable credential: fisher card, fishing license, or
/// establishment/aquaculture agreement. Cached locally so scans resolve
/// fully offline. The QR itself may also carry a signed copy of these
/// fields (see QrService) for zero-network trust.
class Credential {
  final String id; // server UUID
  final CredentialType type;
  final String holderName;
  final Sex sex; // sex ventilation of the holder
  final String? boatRef; // immatriculation / pirogue ref (licenses)
  final String? landingSite; // débarcadère de rattachement
  final DateTime? validFrom;
  final DateTime? validUntil;
  final ValidityState state;
  final String? extraJson; // any additional attributes (JSON string)
  final DateTime updatedAt;

  const Credential({
    required this.id,
    required this.type,
    required this.holderName,
    required this.sex,
    required this.state,
    required this.updatedAt,
    this.boatRef,
    this.landingSite,
    this.validFrom,
    this.validUntil,
    this.extraJson,
  });

  /// Recompute validity locally from dates (used when scanning offline).
  ValidityState get computedState {
    if (state == ValidityState.suspended) return ValidityState.suspended;
    final now = DateTime.now();
    if (validUntil != null && now.isAfter(validUntil!)) return ValidityState.expired;
    if (validFrom != null && now.isBefore(validFrom!)) return ValidityState.unknown;
    if (validUntil == null && validFrom == null) return state;
    return ValidityState.valid;
  }

  Map<String, Object?> toRow() => {
        'id': id,
        'type': type.code,
        'holder_name': holderName,
        'sex': sex.code,
        'boat_ref': boatRef,
        'landing_site': landingSite,
        'valid_from': validFrom?.toIso8601String(),
        'valid_until': validUntil?.toIso8601String(),
        'state': state.name,
        'extra_json': extraJson,
        'updated_at': updatedAt.toIso8601String(),
      };

  factory Credential.fromRow(Map<String, Object?> r) => Credential(
        id: r['id'] as String,
        type: CredentialTypeX.fromCode(r['type'] as String?) ?? CredentialType.fisherCard,
        holderName: (r['holder_name'] as String?) ?? '—',
        sex: SexX.fromCode(r['sex'] as String?),
        boatRef: r['boat_ref'] as String?,
        landingSite: r['landing_site'] as String?,
        validFrom: _dt(r['valid_from']),
        validUntil: _dt(r['valid_until']),
        state: ValidityState.values
            .firstWhere((s) => s.name == r['state'], orElse: () => ValidityState.unknown),
        extraJson: r['extra_json'] as String?,
        updatedAt: _dt(r['updated_at']) ?? DateTime.now(),
      );

  factory Credential.fromApi(Map<String, dynamic> j, CredentialType type) => Credential(
        id: j['id'].toString(),
        type: type,
        holderName: (j['holder_name'] ?? j['nom'] ?? '—').toString(),
        sex: SexX.fromCode(j['sex'] ?? j['sexe']),
        boatRef: j['boat_ref']?.toString() ?? j['immatriculation']?.toString(),
        landingSite: j['landing_site']?.toString() ?? j['debarcadere']?.toString(),
        validFrom: _dt(j['valid_from'] ?? j['date_debut']),
        validUntil: _dt(j['valid_until'] ?? j['date_fin']),
        state: ValidityState.values.firstWhere(
          (s) => s.name == (j['state'] ?? j['statut']),
          orElse: () => ValidityState.valid,
        ),
        extraJson: null,
        updatedAt: _dt(j['updated_at']) ?? DateTime.now(),
      );

  static DateTime? _dt(Object? v) => v == null ? null : DateTime.tryParse(v.toString());
}
