import 'package:sqflite/sqflite.dart';
import '../../models/capture.dart';
import '../../models/inspection.dart';
import '../../models/enums.dart';
import '../database.dart';

class QueueItem {
  final int id;
  final String entity;
  final String localId;
  final int attempts;
  QueueItem(this.id, this.entity, this.localId, this.attempts);
}

/// Drives the outbox: hands pending items to the sync service and records
/// results.
class SyncDao {
  Future<List<QueueItem>> nextBatch({int limit = 20}) async {
    final db = await AppDatabase.instance.db;
    final rows = await db.query('sync_queue', orderBy: 'id ASC', limit: limit);
    return rows
        .map((r) => QueueItem(
              r['id'] as int,
              r['entity'] as String,
              r['local_id'] as String,
              (r['attempts'] as int?) ?? 0,
            ))
        .toList();
  }

  Future<Capture?> loadCapture(String localId) async {
    final db = await AppDatabase.instance.db;
    final rows = await db.query('captures', where: 'local_id = ?', whereArgs: [localId], limit: 1);
    return rows.isEmpty ? null : Capture.fromRow(rows.first);
  }

  Future<Inspection?> loadInspection(String localId) async {
    final db = await AppDatabase.instance.db;
    final rows =
        await db.query('inspections', where: 'local_id = ?', whereArgs: [localId], limit: 1);
    return rows.isEmpty ? null : Inspection.fromRow(rows.first);
  }

  Future<void> markSynced(QueueItem item, String serverId) async {
    final db = await AppDatabase.instance.db;
    await db.transaction((txn) async {
      final table = item.entity == 'capture' ? 'captures' : 'inspections';
      await txn.update(
        table,
        {'server_id': serverId, 'sync_status': SyncStatus.synced.code},
        where: 'local_id = ?',
        whereArgs: [item.localId],
      );
      await txn.delete('sync_queue', where: 'id = ?', whereArgs: [item.id]);
    });
  }

  Future<void> markFailed(QueueItem item, String error) async {
    final db = await AppDatabase.instance.db;
    await db.transaction((txn) async {
      await txn.update(
        'sync_queue',
        {'attempts': item.attempts + 1, 'last_error': error},
        where: 'id = ?',
        whereArgs: [item.id],
      );
      final table = item.entity == 'capture' ? 'captures' : 'inspections';
      await txn.update(table, {'sync_status': SyncStatus.failed.code},
          where: 'local_id = ?', whereArgs: [item.localId]);
    });
  }
}
