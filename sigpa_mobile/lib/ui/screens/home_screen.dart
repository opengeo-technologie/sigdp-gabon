import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../data/remote/sync_service.dart';
import '../../data/repositories/repositories.dart';
import '../../services/auth_service.dart';
import '../widgets/connection_badge.dart';
import 'login_screen.dart';
import 'scan_screen.dart';
import 'capture_form_screen.dart';
import 'inspection_form_screen.dart';
import 'history_screen.dart';
import 'sync_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _pending = 0;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final n = await context.read<SigpaRepository>().pendingCount();
    if (mounted) setState(() => _pending = n);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.read<AuthService>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('SIGPA Terrain'),
        actions: const [ConnectionBadge()],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Bonjour, ${auth.userName ?? 'Inspecteur'}',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            const Text('Commencez par scanner une carte, une licence ou un agrément.',
                style: TextStyle(color: Colors.black54)),
            const SizedBox(height: 20),

            // Primary CTA — scan is the entry point of every workflow.
            _BigButton(
              icon: Icons.qr_code_scanner,
              title: 'Scanner un QR',
              subtitle: 'Carte pêcheur · Licence · Agrément',
              color: SigpaTheme.primary,
              onTap: () async {
                await Navigator.push(context, MaterialPageRoute(builder: (_) => const ScanScreen()));
                _refresh();
              },
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _SmallButton(
                    icon: Icons.set_meal,
                    label: 'Capture sur pont',
                    color: SigpaTheme.accent,
                    onTap: () async {
                      await Navigator.push(context,
                          MaterialPageRoute(builder: (_) => const CaptureFormScreen()));
                      _refresh();
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _SmallButton(
                    icon: Icons.assignment_late,
                    label: 'Inspection bateau',
                    color: SigpaTheme.warning,
                    onTap: () async {
                      await Navigator.push(context,
                          MaterialPageRoute(builder: (_) => const InspectionFormScreen()));
                      _refresh();
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            Card(
              child: ListTile(
                leading: const Icon(Icons.history, color: SigpaTheme.primary),
                title: const Text('Mes enregistrements'),
                subtitle: const Text('Captures et inspections saisies'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () async {
                  await Navigator.push(context,
                      MaterialPageRoute(builder: (_) => const HistoryScreen()));
                  _refresh();
                },
              ),
            ),
            const SizedBox(height: 8),
            Card(
              child: ListTile(
                leading: const Icon(Icons.sync, color: SigpaTheme.primary),
                title: const Text('File de synchronisation'),
                subtitle: Text(_pending == 0
                    ? 'Tout est synchronisé'
                    : '$_pending enregistrement(s) en attente'),
                trailing: _pending == 0
                    ? const Icon(Icons.check_circle, color: SigpaTheme.ok)
                    : CircleAvatar(
                        radius: 14,
                        backgroundColor: SigpaTheme.warning,
                        child: Text('$_pending',
                            style: const TextStyle(color: Colors.white, fontSize: 12)),
                      ),
                onTap: () async {
                  await Navigator.push(context, MaterialPageRoute(builder: (_) => const SyncScreen()));
                  _refresh();
                },
              ),
            ),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: () async {
                await context.read<AuthService>().logout();
                if (context.mounted) {
                  Navigator.of(context).pushReplacement(
                      MaterialPageRoute(builder: (_) => const LoginScreen()));
                }
              },
              icon: const Icon(Icons.logout),
              label: const Text('Se déconnecter'),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.read<SyncService>().syncAll(),
        icon: const Icon(Icons.sync),
        label: const Text('Synchroniser'),
      ),
    );
  }
}

class _BigButton extends StatelessWidget {
  final IconData icon;
  final String title, subtitle;
  final Color color;
  final VoidCallback onTap;
  const _BigButton({required this.icon, required this.title, required this.subtitle, required this.color, required this.onTap});
  @override
  Widget build(BuildContext context) => Card(
        color: color,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Row(
              children: [
                Icon(icon, size: 44, color: Colors.white),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                      Text(subtitle, style: const TextStyle(color: Colors.white70)),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward_ios, color: Colors.white70, size: 16),
              ],
            ),
          ),
        ),
      );
}

class _SmallButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _SmallButton({required this.icon, required this.label, required this.color, required this.onTap});
  @override
  Widget build(BuildContext context) => Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
            child: Column(
              children: [
                Icon(icon, size: 34, color: color),
                const SizedBox(height: 8),
                Text(label, textAlign: TextAlign.center,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ),
      );
}
