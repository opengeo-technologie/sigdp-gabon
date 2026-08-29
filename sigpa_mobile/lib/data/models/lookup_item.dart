/// A simple pickable reference entity that is NOT a credential:
/// embarcations (boats) and débarcadères (landing sites). Cached locally so
/// the form pickers work fully offline.
class LookupKind {
  static const boat = 'boat';
  static const landingSite = 'landing_site';
}

class LookupItem {
  final String id;
  final String kind;        // LookupKind.*
  final String label;       // immatriculation / nom du débarcadère
  final String? parentRef;  // e.g. débarcadère de rattachement, propriétaire
  final String? extraJson;
  final DateTime updatedAt;

  const LookupItem({
    required this.id,
    required this.kind,
    required this.label,
    required this.updatedAt,
    this.parentRef,
    this.extraJson,
  });

  Map<String, Object?> toRow() => {
        'id': id,
        'kind': kind,
        'label': label,
        'parent_ref': parentRef,
        'extra_json': extraJson,
        'updated_at': updatedAt.toIso8601String(),
      };

  factory LookupItem.fromRow(Map<String, Object?> r) => LookupItem(
        id: r['id'] as String,
        kind: r['kind'] as String,
        label: (r['label'] as String?) ?? '—',
        parentRef: r['parent_ref'] as String?,
        extraJson: r['extra_json'] as String?,
        updatedAt: DateTime.tryParse(r['updated_at']?.toString() ?? '') ?? DateTime.now(),
      );

  factory LookupItem.fromApi(Map<String, dynamic> j, String kind) => LookupItem(
        id: j['id'].toString(),
        kind: kind,
        label: (j['label'] ??
                j['nom'] ??
                j['immatriculation'] ??
                j['name'] ??
                '—')
            .toString(),
        parentRef: (j['parent_ref'] ??
                j['debarcadere'] ??
                j['proprietaire'] ??
                j['landing_site'])
            ?.toString(),
        extraJson: null,
        updatedAt: DateTime.tryParse(
                (j['updated_at'] ?? j['date_maj'] ?? '').toString()) ??
            DateTime.now(),
      );
}
