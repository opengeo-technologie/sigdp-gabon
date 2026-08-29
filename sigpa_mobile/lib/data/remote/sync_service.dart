import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../core/app_config.dart';
import '../../services/connectivity_service.dart';
import '../local/dao/lookup_dao.dart';
import '../local/dao/reference_dao.dart';
import '../local/dao/sync_dao.dart';
import '../local/database.dart';
import '../models/credential.dart';
import '../models/lookup_item.dart';
import '../models/enums.dart';
import 'api_client.dart';

/// Bidirectional sync:
///   push()  drains the outbox (captures + inspections) to the backend.
///   pull()  refreshes the local credential cache for offline scanning.
///
/// Runs opportunistically: on connectivity regained, on a timer while online,
/// and on demand from the Sync screen. Safe to call concurrently — a guard
/// prevents overlapping runs.
class SyncService extends ChangeNotifier {
  final ApiClient api;
  final ConnectivityService connectivity;
  final SyncDao _syncDao = SyncDao();
  final ReferenceDao _refDao = ReferenceDao();
  final LookupDao _lookupDao = LookupDao();

  SyncService({required this.api, required this.connectivity}) {
    connectivity.addListener(_onConnectivity);
  }

  bool _running = false;
  bool get isRunning => _running;
  String? lastMessage;
  DateTime? lastRun;
  Timer? _timer;

  void startAutoLoop() {
    _timer?.cancel();
    _timer = Timer.periodic(
      const Duration(seconds: AppConfig.autoSyncIntervalSec),
      (_) => syncAll(),
    );
  }

  void _onConnectivity() {
    if (connectivity.isOnline) syncAll();
  }

  Future<void> syncAll() async {
    if (_running || !connectivity.isOnline) return;
    _running = true;
    notifyListeners();
    try {
      final pushed = await _push();
      final pulled = await _pull();
      lastMessage = 'Envoyés: $pushed · Références mises à jour: $pulled';
    } catch (e) {
      lastMessage = 'Échec sync: $e';
    } finally {
      lastRun = DateTime.now();
      _running = false;
      notifyListeners();
    }
  }

  Future<int> _push() async {
    var count = 0;
    while (true) {
      final batch = await _syncDao.nextBatch(limit: 20);
      if (batch.isEmpty) break;
      var progressed = false;
      for (final item in batch) {
        try {
          if (item.entity == 'capture') {
            final c = await _syncDao.loadCapture(item.localId);
            if (c == null) {
              await _syncDao.markSynced(item, ''); // orphan queue row
              continue;
            }
            final serverId = await api.postCapture(c.toApi());
            await _syncDao.markSynced(item, serverId);
          } else {
            final i = await _syncDao.loadInspection(item.localId);
            if (i == null) {
              await _syncDao.markSynced(item, '');
              continue;
            }
            final serverId = await api.postInspection(i.toApi());
            await _syncDao.markSynced(item, serverId);
          }
          count++;
          progressed = true;
        } catch (e) {
          await _syncDao.markFailed(item, e.toString());
        }
      }
      if (!progressed) break; // whole batch failed (e.g. server down) — stop
    }
    return count;
  }

  Future<int> _pull() async {
    var total = 0;
    for (final entry in const {
      'fishers': CredentialType.fisherCard,
      'licenses': CredentialType.license,
      'agreements': CredentialType.agreement,
    }.entries) {
      final metaKey = 'sync_cursor_${entry.key}';
      final sinceStr = await AppDatabase.instance.getMeta(metaKey);
      final since = sinceStr == null ? null : DateTime.tryParse(sinceStr);
      final rows = await api.pullReference(entry.key, since);
      if (rows.isNotEmpty) {
        final creds = rows.map((j) => Credential.fromApi(j, entry.value)).toList();
        await _refDao.upsertAll(creds);
        total += creds.length;
        final newest = creds
            .map((c) => c.updatedAt)
            .reduce((a, b) => a.isAfter(b) ? a : b);
        await AppDatabase.instance.setMeta(metaKey, newest.toIso8601String());
      }
    }
    // Non-credential reference lists used by the form pickers.
    for (final entry in const {
      'boats': LookupKind.boat,
      'landing_sites': LookupKind.landingSite,
    }.entries) {
      final metaKey = 'sync_cursor_${entry.key}';
      final sinceStr = await AppDatabase.instance.getMeta(metaKey);
      final since = sinceStr == null ? null : DateTime.tryParse(sinceStr);
      final rows = await api.pullReference(entry.key, since);
      if (rows.isNotEmpty) {
        final items = rows.map((j) => LookupItem.fromApi(j, entry.value)).toList();
        await _lookupDao.upsertAll(items);
        total += items.length;
        final newest = items.map((i) => i.updatedAt).reduce((a, b) => a.isAfter(b) ? a : b);
        await AppDatabase.instance.setMeta(metaKey, newest.toIso8601String());
      }
    }

    return total;
  }

  @override
  void dispose() {
    _timer?.cancel();
    connectivity.removeListener(_onConnectivity);
    super.dispose();
  }
}
