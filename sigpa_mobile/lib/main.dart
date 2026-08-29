import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/theme.dart';
import 'data/remote/api_client.dart';
import 'data/remote/sync_service.dart';
import 'data/repositories/repositories.dart';
import 'services/auth_service.dart';
import 'services/connectivity_service.dart';
import 'services/location_service.dart';
import 'services/qr_service.dart';
import 'ui/screens/login_screen.dart';
import 'ui/screens/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final api = ApiClient();
  final auth = AuthService(api);
  await auth.restore();

  final connectivity = ConnectivityService();
  await connectivity.init();

  final sync = SyncService(api: api, connectivity: connectivity)..startAutoLoop();

  runApp(SigpaApp(
    api: api,
    auth: auth,
    connectivity: connectivity,
    sync: sync,
  ));
}

class SigpaApp extends StatelessWidget {
  final ApiClient api;
  final AuthService auth;
  final ConnectivityService connectivity;
  final SyncService sync;

  const SigpaApp({
    super.key,
    required this.api,
    required this.auth,
    required this.connectivity,
    required this.sync,
  });

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: connectivity),
        ChangeNotifierProvider.value(value: sync),
        Provider.value(value: auth),
        Provider<SigpaRepository>(create: (_) => SigpaRepository()),
        Provider<QrService>(create: (_) => QrService()),
        Provider<LocationService>(create: (_) => LocationService()),
      ],
      child: MaterialApp(
        title: 'SIGPA Terrain',
        debugShowCheckedModeBanner: false,
        theme: SigpaTheme.build(),
        home: auth.isAuthenticated ? const HomeScreen() : const LoginScreen(),
      ),
    );
  }
}
