import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../services/auth_service.dart';
import '../../services/connectivity_service.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _user = TextEditingController();
  final _pass = TextEditingController();
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    setState(() { _busy = true; _error = null; });
    final ok = await context.read<AuthService>().login(_user.text.trim(), _pass.text);
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const HomeScreen()));
    } else {
      setState(() => _error = 'Identifiants invalides ou serveur injoignable.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final online = context.watch<ConnectivityService>().isOnline;
    return Scaffold(
      backgroundColor: SigpaTheme.primaryDark,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.set_meal, size: 64, color: Colors.white),
                const SizedBox(height: 12),
                const Text('SIGPA Terrain',
                    style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold)),
                const Text('Inspection & captures — Pêche Gabon',
                    style: TextStyle(color: Colors.white70)),
                const SizedBox(height: 28),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        TextField(
                          controller: _user,
                          decoration: const InputDecoration(
                              labelText: 'Identifiant', prefixIcon: Icon(Icons.person)),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _pass,
                          obscureText: true,
                          decoration: const InputDecoration(
                              labelText: 'Mot de passe', prefixIcon: Icon(Icons.lock)),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Text(_error!, style: const TextStyle(color: SigpaTheme.danger)),
                        ],
                        const SizedBox(height: 20),
                        FilledButton.icon(
                          onPressed: _busy || !online ? null : _submit,
                          icon: _busy
                              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Icon(Icons.login),
                          label: Text(_busy ? 'Connexion…' : 'Se connecter'),
                        ),
                        if (!online)
                          const Padding(
                            padding: EdgeInsets.only(top: 12),
                            child: Text('Connexion requise au moins une fois en ligne.',
                                style: TextStyle(color: SigpaTheme.warning, fontSize: 12)),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
