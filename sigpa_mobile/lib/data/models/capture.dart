import 'enums.dart';

/// A landing / on-deck catch record ("capture sur pont").
class Capture {
  final String localId;        // client UUID, primary key offline
  final String? serverId;      // filled after successful sync
  final String? fisherId;      // resolved from a scanned fisher card
  final String fisherName;
  final Sex fisherSex;         // sex ventilation
  final String? boatRef;
  final String? landingSite;
  final FishingGear gear;
  final String species;
  final SpeciesGroup? speciesGroup;
  final double quantityKg;
  final double? valueFcfa;
  final double? lat;
  final double? lon;
  final DateTime capturedAt;
  final String? note;
  final SyncStatus syncStatus;

  const Capture({
    required this.localId,
    required this.fisherName,
    required this.fisherSex,
    required this.gear,
    required this.species,
    required this.quantityKg,
    required this.capturedAt,
    required this.syncStatus,
    this.serverId,
    this.fisherId,
    this.boatRef,
    this.landingSite,
    this.speciesGroup,
    this.valueFcfa,
    this.lat,
    this.lon,
    this.note,
  });

  Map<String, Object?> toRow() => {
        'local_id': localId,
        'server_id': serverId,
        'fisher_id': fisherId,
        'fisher_name': fisherName,
        'fisher_sex': fisherSex.code,
        'boat_ref': boatRef,
        'landing_site': landingSite,
        'gear': gear.code,
        'species': species,
        'species_group': speciesGroup?.name,
        'quantity_kg': quantityKg,
        'value_fcfa': valueFcfa,
        'lat': lat,
        'lon': lon,
        'captured_at': capturedAt.toIso8601String(),
        'note': note,
        'sync_status': syncStatus.code,
      };

  /// Payload posted to the backend. server_id omitted; backend keys on local_id
  /// for idempotency so a retried push never duplicates.
  Map<String, dynamic> toApi() => {
        'client_id': localId,
        'fisher_id': fisherId,
        'fisher_name': fisherName,
        'fisher_sex': fisherSex.code,
        'boat_ref': boatRef,
        'landing_site': landingSite,
        'gear': gear.code,
        'species': species,
        'species_group': speciesGroup?.name,
        'quantity_kg': quantityKg,
        'value_fcfa': valueFcfa,
        'lat': lat,
        'lon': lon,
        'captured_at': capturedAt.toIso8601String(),
        'note': note,
      };

  factory Capture.fromRow(Map<String, Object?> r) => Capture(
        localId: r['local_id'] as String,
        serverId: r['server_id'] as String?,
        fisherId: r['fisher_id'] as String?,
        fisherName: (r['fisher_name'] as String?) ?? '—',
        fisherSex: SexX.fromCode(r['fisher_sex'] as String?),
        boatRef: r['boat_ref'] as String?,
        landingSite: r['landing_site'] as String?,
        gear: FishingGearX.fromCode(r['gear'] as String?),
        species: (r['species'] as String?) ?? '',
        speciesGroup: r['species_group'] == null
            ? null
            : SpeciesGroup.values.firstWhere((g) => g.name == r['species_group'],
                orElse: () => SpeciesGroup.demersaux),
        quantityKg: (r['quantity_kg'] as num?)?.toDouble() ?? 0,
        valueFcfa: (r['value_fcfa'] as num?)?.toDouble(),
        lat: (r['lat'] as num?)?.toDouble(),
        lon: (r['lon'] as num?)?.toDouble(),
        capturedAt: DateTime.tryParse(r['captured_at']?.toString() ?? '') ?? DateTime.now(),
        note: r['note'] as String?,
        syncStatus: SyncStatusX.fromCode(r['sync_status'] as String?),
      );

  Capture copyWith({String? serverId, SyncStatus? syncStatus}) => Capture(
        localId: localId,
        serverId: serverId ?? this.serverId,
        fisherId: fisherId,
        fisherName: fisherName,
        fisherSex: fisherSex,
        boatRef: boatRef,
        landingSite: landingSite,
        gear: gear,
        species: species,
        speciesGroup: speciesGroup,
        quantityKg: quantityKg,
        valueFcfa: valueFcfa,
        lat: lat,
        lon: lon,
        capturedAt: capturedAt,
        note: note,
        syncStatus: syncStatus ?? this.syncStatus,
      );
}
