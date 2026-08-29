import 'package:sqflite/sqflite.dart';
import '../../models/lookup_item.dart';
import '../database.dart';

/// Read/write the pickable reference store (boats, landing sites).
class LookupDao {
  Future<void> upsertAll(List<LookupItem> items) async {
    final db = await AppDatabase.instance.db;
    final batch = db.batch();
    for (final it in items) {
      batch.insert('lookups', it.toRow(), conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  /// Case-insensitive prefix/substring search, capped for large lists.
  Future<List<LookupItem>> search(String kind, String query, {int limit = 40}) async {
    final db = await AppDatabase.instance.db;
    final q = query.trim();
    final rows = q.isEmpty
        ? await db.query('lookups',
            where: 'kind = ?', whereArgs: [kind], orderBy: 'label ASC', limit: limit)
        : await db.query('lookups',
            where: 'kind = ? AND label LIKE ?',
            whereArgs: [kind, '%$q%'],
            orderBy: 'label ASC',
            limit: limit);
    return rows.map(LookupItem.fromRow).toList();
  }

  Future<int> count(String kind) async {
    final db = await AppDatabase.instance.db;
    final r = await db.rawQuery('SELECT COUNT(*) n FROM lookups WHERE kind = ?', [kind]);
    return Sqflite.firstIntValue(r) ?? 0;
  }
}
