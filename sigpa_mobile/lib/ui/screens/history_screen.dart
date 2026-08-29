import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../data/models/capture.dart';
import '../../data/models/enums.dart';
import '../../data/models/inspection.dart';
import '../../data/repositories/repositories.dart';
import '../widgets/connection_badge.dart';
import 'record_detail_screen.dart';

/// Browsable history of everything the inspector has recorded on this device,
/// captures and inspections, with a sync-status filter and tap-to-detail.
class HistoryScreen extends StatefulWidget {
  final int initialTab; // 0 = captures, 1 = inspections
  const HistoryScreen({super.key, this.initialTab = 0});
  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

enum _Filter { all, pending, synced }

class _HistoryScreenState extends State<HistoryScreen> {
  List<Capture> _captures = [];
  List<Inspection> _inspections = [];
  _Filter _filter = _Filter.all;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final repo = context.read<SigpaRepository>();
    final c = await repo.recentCaptures();
    final i = await repo.recentInspections();
    if (mounted) setState(() { _captures = c; _inspections = i; _loading = false; });
  }

  bool _match(SyncStatus s) => switch (_filter) {
        _Filter.all => true,
        _Filter.pending => s != SyncStatus.synced,
        _Filter.synced => s == SyncStatus.synced,
      };

  @override
  Widget build(BuildContext context) {
    final captures = _captures.where((c) => _match(c.syncStatus)).toList();
    final inspections = _inspections.where((i) => _match(i.syncStatus)).toList();

    return DefaultTabController(
      length: 2,
      initialIndex: widget.initialTab,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Mes enregistrements'),
          actions: const [ConnectionBadge()],
          bottom: TabBar(
            labelColor: Colors.white,
            indicatorColor: Colors.white,
            tabs: [
              Tab(text: 'Captures (${captures.length})'),
              Tab(text: 'Inspections (${inspections.length})'),
            ],
          ),
        ),
        body: Column(
          children: [
            _FilterBar(value: _filter, onChanged: (f) => setState(() => _filter = f)),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : TabBarView(children: [
                      _CaptureList(items: captures, onRefresh: _load),
                      _InspectionList(items: inspections, onRefresh: _load),
                    ]),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  final _Filter value;
  final ValueChanged<_Filter> onChanged;
  const _FilterBar({required this.value, required this.onChanged});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: SegmentedButton<_Filter>(
          segments: const [
            ButtonSegment(value: _Filter.all, label: Text('Tous')),
            ButtonSegment(value: _Filter.pending, label: Text('En attente')),
            ButtonSegment(value: _Filter.synced, label: Text('Synchronisés')),
          ],
          selected: {value},
          onSelectionChanged: (s) => onChanged(s.first),
        ),
      );
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
    side: BorderSide.none,
  );
}

String _fmt(DateTime d) => DateFormat('dd/MM/yyyy HH:mm').format(d.toLocal());

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String text;
  const _EmptyState({required this.icon, required this.text});
  @override
  Widget build(BuildContext context) => ListView(
        children: [
          const SizedBox(height: 120),
          Icon(icon, size: 56, color: Colors.black26),
          const SizedBox(height: 12),
          Text(text, textAlign: TextAlign.center, style: const TextStyle(color: Colors.black45)),
        ],
      );
}

class _CaptureList extends StatelessWidget {
  final List<Capture> items;
  final Future<void> Function() onRefresh;
  const _CaptureList({required this.items, required this.onRefresh});
  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: items.isEmpty
          ? const _EmptyState(icon: Icons.set_meal, text: 'Aucune capture enregistrée')
          : ListView.builder(
              padding: const EdgeInsets.all(8),
              itemCount: items.length,
              itemBuilder: (_, i) {
                final c = items[i];
                return Card(
                  child: ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: SigpaTheme.accent,
                      child: Icon(Icons.set_meal, color: Colors.white),
                    ),
                    title: Text('${c.species} · ${c.quantityKg} kg'),
                    subtitle: Text(
                      '${c.fisherName} (${c.fisherSex.label})\n${c.gear.label} · ${_fmt(c.capturedAt)}',
                    ),
                    isThreeLine: true,
                    trailing: _statusChip(c.syncStatus),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => RecordDetailScreen.capture(c)),
                    ),
                  ),
                );
              },
            ),
    );
  }
}

class _InspectionList extends StatelessWidget {
  final List<Inspection> items;
  final Future<void> Function() onRefresh;
  const _InspectionList({required this.items, required this.onRefresh});
  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: items.isEmpty
          ? const _EmptyState(icon: Icons.assignment_late, text: 'Aucune inspection enregistrée')
          : ListView.builder(
              padding: const EdgeInsets.all(8),
              itemCount: items.length,
              itemBuilder: (_, i) {
                final ins = items[i];
                return Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: ins.hasInfractions ? SigpaTheme.danger : SigpaTheme.ok,
                      child: Icon(ins.hasInfractions ? Icons.gpp_bad : Icons.verified_user,
                          color: Colors.white),
                    ),
                    title: Text('Embarcation ${ins.boatRef}'),
                    subtitle: Text(
                      '${ins.hasInfractions ? "${ins.infractions.length} infraction(s)" : "Conforme"} · ${ins.persons.length} pers.\n${_fmt(ins.inspectedAt)}',
                    ),
                    isThreeLine: true,
                    trailing: _statusChip(ins.syncStatus),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => RecordDetailScreen.inspection(ins)),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
