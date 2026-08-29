import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../data/models/capture.dart';
import '../../data/models/enums.dart';
import '../../data/models/inspection.dart';
import '../../data/remote/sync_service.dart';
import '../../data/repositories/repositories.dart';
import '../../services/connectivity_service.dart';
import '../widgets/connection_badge.dart';

class SyncScreen extends StatefulWidget {
  const SyncScreen({super.key});
  @override
  State<SyncScreen> createState() => _SyncScreenState();
}

class _SyncScreenState extends State<SyncScreen> {
  List<Capture> _captures = [];
  List<Inspection> _inspections = [];
  int _pending = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final repo = context.read<SigpaRepository>();
    final c = await repo.recentCaptures();
    final i = await repo.recentInspections();
    final p = await repo.pendingCount();
    if (mounted) setState(() { _captures = c; _inspections = i; _pending = p; });
  }

  @override
  Widget build(BuildContext context) {
    final sync = context.watch<SyncService>();
    final online = context.watch<ConnectivityService>().isOnline;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Synchronisation'),
          actions: const [ConnectionBadge()],
          bottom: const TabBar(
            labelColor: Colors.white,
            indicatorColor: Colors.white,
            tabs: [Tab(text: 'Captures'), Tab(text: 'Inspections')],
          ),
        ),
        body: Column(
          children: [
            Container(
              width: double.infinity,
              color: _pending == 0 ? SigpaTheme.ok : SigpaTheme.warning,
              padding: const EdgeInsets.all(12),
              child: Text(
                sync.isRunning
                    ? 'Synchronisation en cours…'
                    : _pending == 0
                        ? 'Tout est synchronisé ✓'
                        : '$_pending enregistrement(s) en attente',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
            ),
            if (sync.lastMessage != null)
              Padding(
                padding: const EdgeInsets.all(8),
                child: Text(sync.lastMessage!, style: const TextStyle(color: Colors.black54, fontSize: 12)),
              ),
            Expanded(
              child: TabBarView(children: [
                _CaptureList(items: _captures),
                _InspectionList(items: _inspections),
              ]),
            ),
          ],
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: (!online || sync.isRunning)
              ? null
              : () async { await sync.syncAll(); await _load(); },
          backgroundColor: (!online || sync.isRunning) ? Colors.grey : SigpaTheme.primary,
          icon: const Icon(Icons.sync),
          label: const Text('Forcer la sync'),
        ),
      ),
    );
  }
}

Widget _statusChip(SyncStatus s) {
  final (color, label) = switch (s) {
    SyncStatus.synced => (SigpaTheme.ok, 'Synchronisé'),
    SyncStatus.pending => (SigpaTheme.warning, 'En attente'),
    SyncStatus.syncing => (SigpaTheme.primary, 'Envoi…'),
    SyncStatus.failed => (SigpaTheme.danger, 'Échec'),
  };
  return Chip(
    label: Text(label, style: const TextStyle(color: Colors.white, fontSize: 11)),
    backgroundColor: color,
    visualDensity: VisualDensity.compact,
    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
  );
}

class _CaptureList extends StatelessWidget {
  final List<Capture> items;
  const _CaptureList({required this.items});
  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const Center(child: Text('Aucune capture'));
    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final c = items[i];
        return Card(
          child: ListTile(
            leading: const Icon(Icons.set_meal, color: SigpaTheme.accent),
            title: Text('${c.species} · ${c.quantityKg} kg'),
            subtitle: Text('${c.fisherName} · ${c.gear.label}'),
            trailing: _statusChip(c.syncStatus),
          ),
        );
      },
    );
  }
}

class _InspectionList extends StatelessWidget {
  final List<Inspection> items;
  const _InspectionList({required this.items});
  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const Center(child: Text('Aucune inspection'));
    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final ins = items[i];
        return Card(
          child: ListTile(
            leading: Icon(ins.hasInfractions ? Icons.gpp_bad : Icons.verified_user,
                color: ins.hasInfractions ? SigpaTheme.danger : SigpaTheme.ok),
            title: Text('Embarcation ${ins.boatRef}'),
            subtitle: Text(ins.hasInfractions
                ? '${ins.infractions.length} infraction(s) · ${ins.persons.length} pers.'
                : 'Conforme · ${ins.persons.length} pers.'),
            trailing: _statusChip(ins.syncStatus),
          ),
        );
      },
    );
  }
}
