import 'package:sqflite/sqflite.dart';
import '../../models/credential.dart';
import '../../models/enums.dart';
import '../database.dart';

/// Read/write the cached credential store used for offline scan resolution.
class ReferenceDao {
  Future<void> upsertAll(List<Credential> items) async {
    final db = await AppDatabase.instance.db;
    final batch = db.batch();
    for (final c in items) {
      batch.insert('credentials', c.toRow(), conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  Future<Credential?> findById(String id) async {
    final db = await AppDatabase.instance.db;
    final rows = await db.query('credentials', where: 'id = ?', whereArgs: [id], limit: 1);
    return rows.isEmpty ? null : Credential.fromRow(rows.first);
  }

  Future<int> countByType(CredentialType t) async {
    final db = await AppDatabase.instance.db;
    final r = await db.rawQuery('SELECT COUNT(*) n FROM credentials WHERE type = ?', [t.code]);
    return Sqflite.firstIntValue(r) ?? 0;
  }

  /// Search cached fishers (credentials of type F) for the form picker.
  Future<List<Credential>> searchFishers(String query, {int limit = 40}) async {
    final db = await AppDatabase.instance.db;
    final q = query.trim();
    final rows = q.isEmpty
        ? await db.query('credentials',
            where: 'type = ?',
            whereArgs: [CredentialType.fisherCard.code],
            orderBy: 'holder_name ASC',
            limit: limit)
        : await db.query('credentials',
            where: 'type = ? AND holder_name LIKE ?',
            whereArgs: [CredentialType.fisherCard.code, '%$q%'],
            orderBy: 'holder_name ASC',
            limit: limit);
    return rows.map(Credential.fromRow).toList();
  }
}
