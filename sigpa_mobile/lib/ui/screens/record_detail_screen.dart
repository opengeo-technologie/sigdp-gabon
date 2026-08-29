import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../data/models/capture.dart';
import '../../data/models/enums.dart';
import '../../data/models/inspection.dart';

/// Read-only detail of a single capture or inspection.
class RecordDetailScreen extends StatelessWidget {
  final Capture? capture;
  final Inspection? inspection;
  const RecordDetailScreen._({this.capture, this.inspection});

  factory RecordDetailScreen.capture(Capture c) => RecordDetailScreen._(capture: c);
  factory RecordDetailScreen.inspection(Inspection i) => RecordDetailScreen._(inspection: i);

  @override
  Widget build(BuildContext context) {
    final isCapture = capture != null;
    return Scaffold(
      appBar: AppBar(title: Text(isCapture ? 'Détail capture' : 'Détail inspection')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: isCapture ? _captureBody(capture!) : _inspectionBody(inspection!),
      ),
    );
  }

  List<Widget> _captureBody(Capture c) => [
        _SyncHeader(status: c.syncStatus, serverId: c.serverId),
        const SizedBox(height: 12),
        _Section('Pêcheur', [
          _row('Nom', c.fisherName),
          _row('Sexe', c.fisherSex.label),
          if (c.boatRef != null) _row('Pirogue', c.boatRef!),
          if (c.landingSite != null) _row('Débarcadère', c.landingSite!),
        ]),
        _Section('Capture', [
          _row('Espèce', c.species),
          if (c.speciesGroup != null) _row('Groupe', _groupLabel(c.speciesGroup!)),
          _row('Engin', c.gear.label),
          _row('Quantité', '${c.quantityKg} kg'),
          if (c.valueFcfa != null) _row('Valeur', '${c.valueFcfa!.toStringAsFixed(0)} f.CFA'),
        ]),
        _Section('Contexte', [
          _row('Date', _fmt(c.capturedAt)),
          _row('Position', _coords(c.lat, c.lon)),
          if (c.note != null && c.note!.isNotEmpty) _row('Observations', c.note!),
        ]),
      ];

  List<Widget> _inspectionBody(Inspection i) => [
        _SyncHeader(status: i.syncStatus, serverId: i.serverId),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: (i.hasInfractions ? SigpaTheme.danger : SigpaTheme.ok).withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(children: [
            Icon(i.hasInfractions ? Icons.gpp_bad : Icons.verified_user,
                color: i.hasInfractions ? SigpaTheme.danger : SigpaTheme.ok),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                i.hasInfractions
                    ? '${i.infractions.length} infraction(s) constatée(s)'
                    : 'Inspection conforme',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        _Section('Embarcation', [
          _row('Immatriculation', i.boatRef),
          if (i.missionRef != null) _row('Réf. mission', i.missionRef!),
          _row('Licence valide', i.licenseValid ? 'Oui' : 'Non'),
        ]),
        _Section('Personnes contrôlées (${i.persons.length})',
            i.persons.isEmpty
                ? [_row('—', 'Aucune')]
                : i.persons
                    .map((p) => _row(p.role, '${p.name} · ${p.sex.label}'))
                    .toList()),
        _Section('Infractions',
            i.infractions.isEmpty
                ? [_row('—', 'Aucune')]
                : i.infractions
                    .map((inf) => _row(inf.code, inf.label))
                    .toList()),
        if (i.seizureMade)
          _Section('Saisie', [_row('Détails', i.seizureDetails ?? '—')]),
        _Section('Contexte', [
          _row('Date', _fmt(i.inspectedAt)),
          _row('Position', _coords(i.lat, i.lon)),
          if (i.inspectorNote.isNotEmpty) _row('Observations', i.inspectorNote),
        ]),
      ];

  static String _groupLabel(SpeciesGroup g) => switch (g) {
        SpeciesGroup.pelagiques => 'Pélagiques',
        SpeciesGroup.demersaux => 'Démersaux',
        SpeciesGroup.crustaces => 'Crustacés',
      };
  static String _fmt(DateTime d) => DateFormat('dd/MM/yyyy HH:mm').format(d.toLocal());
  static String _coords(double? lat, double? lon) =>
      (lat == null || lon == null) ? 'Non disponible' : '${lat.toStringAsFixed(5)}, ${lon.toStringAsFixed(5)}';
  static Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 120,
              child: Text(label, style: const TextStyle(color: Colors.black54, fontSize: 13)),
            ),
            Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500))),
          ],
        ),
      );
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> rows;
  const _Section(this.title, this.rows);
  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: SigpaTheme.primaryDark)),
              const Divider(),
              ...rows,
            ],
          ),
        ),
      );
}

class _SyncHeader extends StatelessWidget {
  final SyncStatus status;
  final String? serverId;
  const _SyncHeader({required this.status, this.serverId});
  @override
  Widget build(BuildContext context) {
    final (color, label, icon) = switch (status) {
      SyncStatus.synced => (SigpaTheme.ok, 'Synchronisé avec le serveur', Icons.cloud_done),
      SyncStatus.pending => (SigpaTheme.warning, 'En attente de synchronisation', Icons.cloud_upload),
      SyncStatus.syncing => (SigpaTheme.primary, 'Envoi en cours', Icons.sync),
      SyncStatus.failed => (SigpaTheme.danger, 'Échec — sera réessayé', Icons.error_outline),
    };
    return Row(children: [
      Icon(icon, color: color),
      const SizedBox(width: 8),
      Expanded(child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600))),
      if (serverId != null && serverId!.isNotEmpty)
        Text('#${serverId!.substring(0, serverId!.length < 8 ? serverId!.length : 8)}',
            style: const TextStyle(color: Colors.black38, fontSize: 12)),
    ]);
  }
}
