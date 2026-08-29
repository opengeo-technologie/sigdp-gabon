import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../data/remote/sync_service.dart';
import '../../services/connectivity_service.dart';

/// AppBar chip showing online/offline + live sync activity.
class ConnectionBadge extends StatelessWidget {
  const ConnectionBadge({super.key});

  @override
  Widget build(BuildContext context) {
    final online = context.watch<ConnectivityService>().isOnline;
    final syncing = context.watch<SyncService>().isRunning;
    final color = online ? SigpaTheme.ok : Colors.white;
    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: Row(
        children: [
          if (syncing)
            const SizedBox(
              width: 14, height: 14,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            )
          else
            Icon(online ? Icons.cloud_done : Icons.cloud_off, size: 18, color: color),
          const SizedBox(width: 6),
          Text(online ? 'En ligne' : 'Hors ligne',
              style: const TextStyle(color: Colors.white, fontSize: 12)),
        ],
      ),
    );
  }
}
