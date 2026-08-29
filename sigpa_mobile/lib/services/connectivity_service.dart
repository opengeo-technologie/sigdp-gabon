import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// Tracks online/offline state and notifies listeners on change so the UI can
/// show a badge and the sync engine can flush when connectivity returns.
class ConnectivityService extends ChangeNotifier {
  final Connectivity _conn = Connectivity();
  StreamSubscription? _sub;
  bool _online = false;
  bool get isOnline => _online;

  Future<void> init() async {
    final result = await _conn.checkConnectivity();
    _online = _hasNetwork(result);
    _sub = _conn.onConnectivityChanged.listen((r) {
      final was = _online;
      _online = _hasNetwork(r);
      if (was != _online) notifyListeners();
    });
  }

  bool _hasNetwork(List<ConnectivityResult> r) =>
      r.any((c) => c != ConnectivityResult.none);

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}
