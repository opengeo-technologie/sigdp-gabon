import 'dart:convert';
import 'enums.dart';

/// One recorded infraction inside an inspection (maps to srv_infractions).
class Infraction {
  final String code;      // catalogue code, e.g. ENG-01
  final String label;
  final String? details;
  const Infraction({required this.code, required this.label, this.details});

  Map<String, dynamic> toJson() => {'code': code, 'label': label, 'details': details};
  factory Infraction.fromJson(Map<String, dynamic> j) =>
      Infraction(code: j['code'], label: j['label'], details: j['details']);
}

/// A person controlled during the inspection, recorded with sex ventilation.
class ControlledPerson {
  final String name;
  final Sex sex;
  final String role; // pêcheur, propriétaire, mareyeur, exploitant...
  const ControlledPerson({required this.name, required this.sex, required this.role});

  Map<String, dynamic> toJson() => {'name': name, 'sex': sex.code, 'role': role};
  factory ControlledPerson.fromJson(Map<String, dynamic> j) =>
      ControlledPerson(name: j['name'], sex: SexX.fromCode(j['sex']), role: j['role'] ?? 'pêcheur');
}

/// A boat inspection ("contrôle sur embarcation"). Maps onto the SIGPA
/// Surveillance chain: it belongs to a mission and produces a controle that
/// may raise infractions.
class Inspection {
  final String localId;
  final String? serverId;
  final String? missionRef;         // srv_missions reference (optional)
  final String? scannedLicenseId;   // credential scanned first (priority)
  final String? scannedFisherId;
  final String? scannedAgreementId;
  final String boatRef;
  final bool licenseValid;          // resolved at scan time
  final List<ControlledPerson> persons;
  final List<Infraction> infractions;
  final bool seizureMade;           // saisie
  final String? seizureDetails;
  final double? lat;
  final double? lon;
  final DateTime inspectedAt;
  final String inspectorNote;
  final SyncStatus syncStatus;

  const Inspection({
    required this.localId,
    required this.boatRef,
    required this.persons,
    required this.infractions,
    required this.inspectedAt,
    required this.syncStatus,
    this.serverId,
    this.missionRef,
    this.scannedLicenseId,
    this.scannedFisherId,
    this.scannedAgreementId,
    this.licenseValid = false,
    this.seizureMade = false,
    this.seizureDetails,
    this.lat,
    this.lon,
    this.inspectorNote = '',
  });

  bool get hasInfractions => infractions.isNotEmpty;

  Map<String, Object?> toRow() => {
        'local_id': localId,
        'server_id': serverId,
        'mission_ref': missionRef,
        'license_id': scannedLicenseId,
        'fisher_id': scannedFisherId,
        'agreement_id': scannedAgreementId,
        'boat_ref': boatRef,
        'license_valid': licenseValid ? 1 : 0,
        'persons_json': jsonEncode(persons.map((p) => p.toJson()).toList()),
        'infractions_json': jsonEncode(infractions.map((i) => i.toJson()).toList()),
        'seizure_made': seizureMade ? 1 : 0,
        'seizure_details': seizureDetails,
        'lat': lat,
        'lon': lon,
        'inspected_at': inspectedAt.toIso8601String(),
        'note': inspectorNote,
        'sync_status': syncStatus.code,
      };

  Map<String, dynamic> toApi() => {
        'client_id': localId,
        'mission_ref': missionRef,
        'license_id': scannedLicenseId,
        'fisher_id': scannedFisherId,
        'agreement_id': scannedAgreementId,
        'boat_ref': boatRef,
        'license_valid': licenseValid,
        'persons': persons.map((p) => p.toJson()).toList(),
        'infractions': infractions.map((i) => i.toJson()).toList(),
        'seizure_made': seizureMade,
        'seizure_details': seizureDetails,
        'lat': lat,
        'lon': lon,
        'inspected_at': inspectedAt.toIso8601String(),
        'note': inspectorNote,
      };

  factory Inspection.fromRow(Map<String, Object?> r) => Inspection(
        localId: r['local_id'] as String,
        serverId: r['server_id'] as String?,
        missionRef: r['mission_ref'] as String?,
        scannedLicenseId: r['license_id'] as String?,
        scannedFisherId: r['fisher_id'] as String?,
        scannedAgreementId: r['agreement_id'] as String?,
        boatRef: (r['boat_ref'] as String?) ?? '—',
        licenseValid: (r['license_valid'] as int? ?? 0) == 1,
        persons: (jsonDecode((r['persons_json'] as String?) ?? '[]') as List)
            .map((e) => ControlledPerson.fromJson(e as Map<String, dynamic>))
            .toList(),
        infractions: (jsonDecode((r['infractions_json'] as String?) ?? '[]') as List)
            .map((e) => Infraction.fromJson(e as Map<String, dynamic>))
            .toList(),
        seizureMade: (r['seizure_made'] as int? ?? 0) == 1,
        seizureDetails: r['seizure_details'] as String?,
        lat: (r['lat'] as num?)?.toDouble(),
        lon: (r['lon'] as num?)?.toDouble(),
        inspectedAt: DateTime.tryParse(r['inspected_at']?.toString() ?? '') ?? DateTime.now(),
        inspectorNote: (r['note'] as String?) ?? '',
        syncStatus: SyncStatusX.fromCode(r['sync_status'] as String?),
      );

  Inspection copyWith({String? serverId, SyncStatus? syncStatus}) => Inspection(
        localId: localId,
        serverId: serverId ?? this.serverId,
        missionRef: missionRef,
        scannedLicenseId: scannedLicenseId,
        scannedFisherId: scannedFisherId,
        scannedAgreementId: scannedAgreementId,
        boatRef: boatRef,
        licenseValid: licenseValid,
        persons: persons,
        infractions: infractions,
        seizureMade: seizureMade,
        seizureDetails: seizureDetails,
        lat: lat,
        lon: lon,
        inspectedAt: inspectedAt,
        inspectorNote: inspectorNote,
        syncStatus: syncStatus ?? this.syncStatus,
      );
}
