/// Sex ventilation is a cross-cutting SIGPA requirement: every actor
/// (fisher, owner, monger, farm operator) must be recorded by sex so
/// statistics can be broken down.
enum Sex { male, female, unknown }

extension SexX on Sex {
  String get code => switch (this) { Sex.male => 'M', Sex.female => 'F', Sex.unknown => 'U' };
  String get label => switch (this) { Sex.male => 'Homme', Sex.female => 'Femme', Sex.unknown => 'Non précisé' };
  static Sex fromCode(String? c) => switch (c?.toUpperCase()) { 'M' => Sex.male, 'F' => Sex.female, _ => Sex.unknown };
}

/// The three scannable credential types, in scan priority order.
enum CredentialType { fisherCard, license, agreement }

extension CredentialTypeX on CredentialType {
  String get code => switch (this) {
        CredentialType.fisherCard => 'F',
        CredentialType.license => 'L',
        CredentialType.agreement => 'A',
      };
  String get label => switch (this) {
        CredentialType.fisherCard => 'Carte de pêcheur',
        CredentialType.license => 'Licence',
        CredentialType.agreement => 'Agrément',
      };
  static CredentialType? fromCode(String? c) => switch (c?.toUpperCase()) {
        'F' => CredentialType.fisherCard,
        'L' => CredentialType.license,
        'A' => CredentialType.agreement,
        _ => null,
      };
}

/// Fishing gears drawn from the 2024 SIGPA estimated-catch workbook.
enum FishingGear {
  filetMaillantFond,
  filetMaillantDerivant,
  filetMulet,
  filetSardine,
  ligneDeFond,
  ligneAMain,
  senneTournante,
  autre,
}

extension FishingGearX on FishingGear {
  String get label => switch (this) {
        FishingGear.filetMaillantFond => 'Filet maillant de fond',
        FishingGear.filetMaillantDerivant => 'Filet maillant dérivant',
        FishingGear.filetMulet => 'Filet mulet',
        FishingGear.filetSardine => 'Filet sardine',
        FishingGear.ligneDeFond => 'Ligne de fond',
        FishingGear.ligneAMain => 'Ligne à main',
        FishingGear.senneTournante => 'Senne tournante',
        FishingGear.autre => 'Autre',
      };
  String get code => name;
  static FishingGear fromCode(String? c) =>
      FishingGear.values.firstWhere((g) => g.name == c, orElse: () => FishingGear.autre);
}

/// Broad species groups used in SIGPA statistics.
enum SpeciesGroup { pelagiques, demersaux, crustaces }

/// Outbox row lifecycle.
enum SyncStatus { pending, syncing, synced, failed }

extension SyncStatusX on SyncStatus {
  String get code => name;
  static SyncStatus fromCode(String? c) =>
      SyncStatus.values.firstWhere((s) => s.name == c, orElse: () => SyncStatus.pending);
}

/// Validity of a scanned credential at the moment of inspection.
enum ValidityState { valid, expired, suspended, unknown }

extension ValidityStateX on ValidityState {
  String get label => switch (this) {
        ValidityState.valid => 'Valide',
        ValidityState.expired => 'Expiré',
        ValidityState.suspended => 'Suspendu',
        ValidityState.unknown => 'Inconnu',
      };
}
