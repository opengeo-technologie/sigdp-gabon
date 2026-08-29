import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// Single SQLite database. Offline-first: everything the inspector creates is
/// written here first, then pushed to the backend by the sync engine.
class AppDatabase {
  AppDatabase._();
  static final AppDatabase instance = AppDatabase._();

  static const int _version = 2;
  Database? _db;

  Future<Database> get db async => _db ??= await _open();

  Future<Database> _open() async {
    final dir = await getDatabasesPath();
    return openDatabase(
      p.join(dir, 'sigpa.db'),
      version: _version,
      onConfigure: (db) => db.execute('PRAGMA foreign_keys = ON'),
      onCreate: _create,
      onUpgrade: _upgrade,
    );
  }

  Future<void> _create(Database db, int v) async {
    // Cached scannable credentials (fishers, licenses, agreements).
    await db.execute('''
      CREATE TABLE credentials(
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        holder_name TEXT,
        sex TEXT,
        boat_ref TEXT,
        landing_site TEXT,
        valid_from TEXT,
        valid_until TEXT,
        state TEXT,
        extra_json TEXT,
        updated_at TEXT
      )''');
    await db.execute('CREATE INDEX idx_cred_type ON credentials(type)');

    await db.execute('''
      CREATE TABLE captures(
        local_id TEXT PRIMARY KEY,
        server_id TEXT,
        fisher_id TEXT,
        fisher_name TEXT,
        fisher_sex TEXT,
        boat_ref TEXT,
        landing_site TEXT,
        gear TEXT,
        species TEXT,
        species_group TEXT,
        quantity_kg REAL,
        value_fcfa REAL,
        lat REAL,
        lon REAL,
        captured_at TEXT,
        note TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      )''');

    await db.execute('''
      CREATE TABLE inspections(
        local_id TEXT PRIMARY KEY,
        server_id TEXT,
        mission_ref TEXT,
        license_id TEXT,
        fisher_id TEXT,
        agreement_id TEXT,
        boat_ref TEXT,
        license_valid INTEGER DEFAULT 0,
        persons_json TEXT,
        infractions_json TEXT,
        seizure_made INTEGER DEFAULT 0,
        seizure_details TEXT,
        lat REAL,
        lon REAL,
        inspected_at TEXT,
        note TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      )''');

    // Outbox: durable queue of write operations to replay against the API.
    await db.execute('''
      CREATE TABLE sync_queue(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,        -- 'capture' | 'inspection'
        local_id TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL
      )''');
    await db.execute('CREATE INDEX idx_queue_entity ON sync_queue(entity, local_id)');

    // Pickable reference entities that are not credentials.
    await db.execute('''
      CREATE TABLE lookups(
        id TEXT NOT NULL,
        kind TEXT NOT NULL,        -- 'boat' | 'landing_site'
        label TEXT NOT NULL,
        parent_ref TEXT,
        extra_json TEXT,
        updated_at TEXT,
        PRIMARY KEY(kind, id)
      )''');
    await db.execute('CREATE INDEX idx_lookup_kind ON lookups(kind, label)');

    // Key/value app metadata (last sync cursors, etc.).
    await db.execute('CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT)');
  }

  Future<void> _upgrade(Database db, int from, int to) async {
    if (from < 2) {
      await db.execute('''
        CREATE TABLE IF NOT EXISTS lookups(
          id TEXT NOT NULL,
          kind TEXT NOT NULL,
          label TEXT NOT NULL,
          parent_ref TEXT,
          extra_json TEXT,
          updated_at TEXT,
          PRIMARY KEY(kind, id)
        )''');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_lookup_kind ON lookups(kind, label)');
    }
  }

  Future<String?> getMeta(String key) async {
    final rows = await (await db).query('meta', where: 'k = ?', whereArgs: [key], limit: 1);
    return rows.isEmpty ? null : rows.first['v'] as String?;
  }

  Future<void> setMeta(String key, String value) async {
    await (await db).insert('meta', {'k': key, 'v': value},
        conflictAlgorithm: ConflictAlgorithm.replace);
  }
}
