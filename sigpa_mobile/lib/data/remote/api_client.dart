import 'package:dio/dio.dart';
import '../../core/app_config.dart';

class LoginResult {
  final String token;
  final String? displayName;
  LoginResult(this.token, this.displayName);
}

/// Thin Dio wrapper. All writes are POST and carry the client-generated id so
/// the backend can dedupe idempotently on retry.
class ApiClient {
  final Dio _dio;

  ApiClient()
      : _dio = Dio(BaseOptions(
          baseUrl: AppConfig.apiBaseUrl,
          connectTimeout: const Duration(seconds: 12),
          receiveTimeout: const Duration(seconds: 20),
          headers: {'Content-Type': 'application/json'},
        ));

  void setToken(String? token) {
    if (token == null) {
      _dio.options.headers.remove('Authorization');
    } else {
      _dio.options.headers['Authorization'] = 'Bearer $token';
    }
  }

  Future<LoginResult?> login(String username, String password) async {
    try {
      final r = await _dio.post('/auth/login', data: {
        'username': username,
        'password': password,
      });
      final data = r.data as Map<String, dynamic>;
      final token = (data['access_token'] ?? data['token'])?.toString();
      if (token == null) return null;
      return LoginResult(token, data['display_name']?.toString());
    } on DioException {
      return null;
    }
  }

  /// Returns the server id on success, or throws for the caller to retry.
  Future<String> postCapture(Map<String, dynamic> body) async {
    final r = await _dio.post('/mobile/captures', data: body);
    return _serverId(r.data);
  }

  Future<String> postInspection(Map<String, dynamic> body) async {
    final r = await _dio.post('/mobile/inspections', data: body);
    return _serverId(r.data);
  }

  Future<List<Map<String, dynamic>>> pullReference(String kind, DateTime? since) async {
    final r = await _dio.get('/mobile/reference/$kind', queryParameters: {
      if (since != null) 'since': since.toIso8601String(),
    });
    final data = r.data;
    final list = (data is Map && data['items'] is List) ? data['items'] : data;
    return (list as List).cast<Map<String, dynamic>>();
  }

  String _serverId(dynamic data) {
    if (data is Map && data['id'] != null) return data['id'].toString();
    if (data is Map && data['server_id'] != null) return data['server_id'].toString();
    throw StateError('Réponse serveur sans identifiant');
  }
}
