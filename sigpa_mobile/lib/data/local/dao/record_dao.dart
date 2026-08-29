import 'package:sqflite/sqflite.dart';
import '../../models/capture.dart';
import '../../models/inspection.dart';
import '../../models/enums.dart';
import '../database.dart';

/// Persists captures and inspections and enqueues them for sync in a single
/// transaction so a record can never exist without its outbox entry.
class RecordDao {
  Future<void> saveCapture(Capture c) async {
    final db = await AppDatabase.instance.db;
    await db.transaction((txn) async {
      await txn.insert('captures', c.toRow(), conflictAlgorithm: ConflictAlgorithm.replace);
      await _enqueue(txn, 'capture', c.localId);
    });
  }

  Future<void> saveInspection(Inspection i) async {
    final db = await AppDatabase.instance.db;
    await db.transaction((txn) async {
      await txn.insert('inspections', i.toRow(), conflictAlgorithm: ConflictAlgorithm.replace);
      await _enqueue(txn, 'inspection', i.localId);
    });
  }

  Future<void> _enqueue(Transaction txn, String entity, String localId) async {
    final existing = await txn.query('sync_queue',
        where: 'entity = ? AND local_id = ?', whereArgs: [entity, localId], limit: 1);
    if (existing.isEmpty) {
      await txn.insert('sync_queue', {
        'entity': entity,
        'local_id': localId,
        'created_at': DateTime.now().toIso8601String(),
      });
    }
  }

  Future<List<Capture>> recentCaptures({int limit = 50}) async {
    final db = await AppDatabase.instance.db;
    final rows = await db.query('captures', orderBy: 'captured_at DESC', limit: limit);
    return rows.map(Capture.fromRow).toList();
  }

  Future<List<Inspection>> recentInspections({int limit = 50}) async {
    final db = await AppDatabase.instance.db;
    final rows = await db.query('inspections', orderBy: 'inspected_at DESC', limit: limit);
    return rows.map(Inspection.fromRow).toList();
  }

  Future<int> pendingCount() async {
    final db = await AppDatabase.instance.db;
    final r = await db.rawQuery('SELECT COUNT(*) n FROM sync_queue');
    return Sqflite.firstIntValue(r) ?? 0;
  }
}
