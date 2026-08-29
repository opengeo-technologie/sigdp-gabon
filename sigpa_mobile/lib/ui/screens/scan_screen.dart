import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../data/models/credential.dart';
import '../../data/models/enums.dart';
import '../../data/models/scan_result.dart';
import '../../data/repositories/repositories.dart';
import '../../services/qr_service.dart';
import 'capture_form_screen.dart';
import 'inspection_form_screen.dart';

/// Camera scan surface. Scanning is the prioritised entry point: a scanned
/// credential drives whatever the inspector does next (new capture / new
/// inspection), pre-filled and pre-validated — even fully offline.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});
  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final MobileScannerController _controller =
      MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates);
  bool _handling = false;

  Future<void> _onDetect(BarcodeCapture cap) async {
    if (_handling) return;
    final raw = cap.barcodes.isEmpty ? null : cap.barcodes.first.rawValue;
    if (raw == null) return;
    _handling = true;
    await _controller.stop();

    final result = context.read<QrService>().decode(raw);
    if (!result.recognised) {
      await _showUnrecognised(raw);
    } else {
      await _resolveAndShow(result);
    }
    if (mounted) {
      _handling = false;
      await _controller.start();
    }
  }

  Future<void> _resolveAndShow(ScanResult r) async {
    final repo = context.read<SigpaRepository>();
    // Prefer the cached record; fall back to signed data embedded in the QR.
    Credential? cred = await repo.resolveCredential(r.id!);
    cred ??= _fromEmbedded(r);

    if (!mounted) return;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _CredentialSheet(result: r, credential: cred),
    );
  }

  Credential? _fromEmbedded(ScanResult r) {
    if (r.embedded.isEmpty) return null;
    final e = r.embedded;
    return Credential(
      id: r.id!,
      type: r.type!,
      holderName: (e['holder_name'] ?? '—').toString(),
      sex: SexX.fromCode(e['sex']?.toString()),
      boatRef: e['boat_ref']?.toString(),
      validFrom: DateTime.tryParse(e['valid_from']?.toString() ?? ''),
      validUntil: DateTime.tryParse(e['valid_until']?.toString() ?? ''),
      state: ValidityState.values.firstWhere(
        (s) => s.name == e['state'],
        orElse: () => ValidityState.valid,
      ),
      updatedAt: DateTime.now(),
    );
  }

  Future<void> _showUnrecognised(String raw) => showModalBottomSheet(
        context: context,
        builder: (_) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.error_outline, color: SigpaTheme.danger, size: 40),
            const SizedBox(height: 8),
            const Text('QR non reconnu', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Text(raw, maxLines: 3, overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.black54)),
            const SizedBox(height: 16),
            FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Réessayer')),
          ]),
        ),
      );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scanner un QR'),
        actions: [
          IconButton(onPressed: () => _controller.toggleTorch(), icon: const Icon(Icons.flash_on)),
          IconButton(onPressed: () => _controller.switchCamera(), icon: const Icon(Icons.cameraswitch)),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          _ScannerOverlay(),
          const Positioned(
            bottom: 40, left: 0, right: 0,
            child: Center(
              child: Text('Cartes pêcheur · Licences · Agréments',
                  style: TextStyle(color: Colors.white, backgroundColor: Colors.black45)),
            ),
          ),
        ],
      ),
    );
  }
}

class _ScannerOverlay extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
        child: Container(
          width: 240, height: 240,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.white, width: 3),
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      );
}

/// Bottom sheet showing the resolved credential + validity + next actions.
class _CredentialSheet extends StatelessWidget {
  final ScanResult result;
  final Credential? credential;
  const _CredentialSheet({required this.result, required this.credential});

  @override
  Widget build(BuildContext context) {
    final unknown = credential == null;
    final validity = credential?.computedState ?? ValidityState.unknown;
    final vColor = switch (validity) {
      ValidityState.valid => SigpaTheme.ok,
      ValidityState.expired => SigpaTheme.danger,
      ValidityState.suspended => SigpaTheme.danger,
      ValidityState.unknown => SigpaTheme.warning,
    };
    final type = result.type!;

    return Padding(
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: SigpaTheme.primary,
                child: Icon(_iconFor(type), color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(type.label, style: Theme.of(context).textTheme.labelLarge),
                    Text(credential?.holderName ?? 'Titulaire inconnu',
                        style: Theme.of(context).textTheme.titleLarge),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(spacing: 8, runSpacing: 8, children: [
            _Chip(label: validity.label, color: vColor, icon: Icons.verified),
            if (!unknown) _Chip(label: 'Sexe: ${credential!.sex.label}', color: Colors.blueGrey, icon: Icons.person),
            if (credential?.boatRef != null) _Chip(label: credential!.boatRef!, color: Colors.blueGrey, icon: Icons.directions_boat),
            _Chip(
              label: result.signatureValid ? 'Signature OK' : 'Non signé',
              color: result.signatureValid ? SigpaTheme.ok : SigpaTheme.warning,
              icon: result.signatureValid ? Icons.lock : Icons.lock_open,
            ),
            if (unknown) const _Chip(label: 'Hors cache local', color: SigpaTheme.warning, icon: Icons.cloud_off),
          ]),
          if (credential?.validUntil != null) ...[
            const SizedBox(height: 12),
            Text('Valide jusqu\'au ${credential!.validUntil!.toLocal().toString().split(' ').first}',
                style: const TextStyle(color: Colors.black54)),
          ],
          const SizedBox(height: 20),
          FilledButton.icon(
            icon: const Icon(Icons.set_meal),
            label: const Text('Nouvelle capture'),
            onPressed: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(
                builder: (_) => CaptureFormScreen(prefill: credential),
              ));
            },
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: SigpaTheme.warning),
            icon: const Icon(Icons.assignment_late),
            label: const Text('Nouvelle inspection'),
            onPressed: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(
                builder: (_) => InspectionFormScreen(prefill: credential),
              ));
            },
          ),
          const SizedBox(height: 8),
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Continuer à scanner')),
        ],
      ),
    );
  }

  IconData _iconFor(CredentialType t) => switch (t) {
        CredentialType.fisherCard => Icons.badge,
        CredentialType.license => Icons.card_membership,
        CredentialType.agreement => Icons.workspace_premium,
      };
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  final IconData icon;
  const _Chip({required this.label, required this.color, required this.icon});
  @override
  Widget build(BuildContext context) => Chip(
        avatar: Icon(icon, size: 16, color: Colors.white),
        label: Text(label, style: const TextStyle(color: Colors.white, fontSize: 12)),
        backgroundColor: color,
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      );
}
