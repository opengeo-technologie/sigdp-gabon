import '../local/dao/lookup_dao.dart';
import '../local/dao/record_dao.dart';
import '../local/dao/reference_dao.dart';
import '../models/capture.dart';
import '../models/credential.dart';
import '../models/enums.dart';
import '../models/lookup_item.dart';
import '../models/inspection.dart';

/// Facade the UI talks to. Keeps screens ignorant of DAO/DB details.
class SigpaRepository {
  final RecordDao _records = RecordDao();
  final ReferenceDao _reference = ReferenceDao();
  final LookupDao _lookups = LookupDao();

  Future<Credential?> resolveCredential(String id) => _reference.findById(id);

  Future<void> saveCapture(Capture c) => _records.saveCapture(c);
  Future<void> saveInspection(Inspection i) => _records.saveInspection(i);

  Future<List<Capture>> recentCaptures() => _records.recentCaptures();
  Future<List<Inspection>> recentInspections() => _records.recentInspections();
  Future<int> pendingCount() => _records.pendingCount();

  // --- Reference lists for form pickers (offline) ---
  Future<List<Credential>> searchFishers(String q) => _reference.searchFishers(q);
  Future<List<LookupItem>> searchBoats(String q) => _lookups.search(LookupKind.boat, q);
  Future<List<LookupItem>> searchLandingSites(String q) =>
      _lookups.search(LookupKind.landingSite, q);

  Future<({int fishers, int boats, int landingSites})> referenceCounts() async => (
        fishers: await _reference.countByType(CredentialType.fisherCard),
        boats: await _lookups.count(LookupKind.boat),
        landingSites: await _lookups.count(LookupKind.landingSite),
      );
}
