import 'package:shared_preferences/shared_preferences.dart';
import '../data/remote/api_client.dart';

/// Minimal token-based auth against POST /auth/login. The bearer token is kept
/// in SharedPreferences and injected by ApiClient. Sessions survive offline;
/// the inspector logs in once when online.
class AuthService {
  static const _kToken = 'auth_token';
  static const _kUser = 'auth_user';

  final ApiClient api;
  AuthService(this.api);

  String? _token;
  String? _user;
  String? get userName => _user;
  bool get isAuthenticated => _token != null;

  Future<void> restore() async {
    final sp = await SharedPreferences.getInstance();
    _token = sp.getString(_kToken);
    _user = sp.getString(_kUser);
    api.setToken(_token);
  }

  Future<bool> login(String username, String password) async {
    final res = await api.login(username, password);
    if (res == null) return false;
    _token = res.token;
    _user = res.displayName;
    api.setToken(_token);
    final sp = await SharedPreferences.getInstance();
    await sp.setString(_kToken, _token!);
    await sp.setString(_kUser, _user ?? username);
    return true;
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    api.setToken(null);
    final sp = await SharedPreferences.getInstance();
    await sp.remove(_kToken);
    await sp.remove(_kUser);
  }
}
