import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../core/theme.dart';
import '../../data/models/capture.dart';
import '../../data/models/credential.dart';
import '../../data/models/enums.dart';
import '../../data/models/lookup_item.dart';
import '../../data/repositories/repositories.dart';
import '../../services/location_service.dart';
import '../widgets/search_picker.dart';
import '../widgets/sex_field.dart';

class CaptureFormScreen extends StatefulWidget {
  final Credential? prefill; // from a scanned fisher card
  const CaptureFormScreen({super.key, this.prefill});
  @override
  State<CaptureFormScreen> createState() => _CaptureFormScreenState();
}

class _CaptureFormScreenState extends State<CaptureFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _boat = TextEditingController();
  final _landing = TextEditingController();
  final _species = TextEditingController();
  final _qty = TextEditingController();
  final _value = TextEditingController();
  final _note = TextEditingController();

  Sex _sex = Sex.unknown;
  FishingGear _gear = FishingGear.filetMaillantFond;
  SpeciesGroup? _group;
  double? _lat, _lon;
  bool _saving = false;
  String? _fisherFromList; // id when the fisher was chosen from the cached list

  @override
  void initState() {
    super.initState();
    final p = widget.prefill;
    if (p != null) {
      _name.text = p.holderName;
      _sex = p.sex;
      if (p.boatRef != null) _boat.text = p.boatRef!;
      if (p.landingSite != null) _landing.text = p.landingSite!;
    }
    _grabLocation();
  }

  Future<void> _grabLocation() async {
    final loc = await context.read<LocationService>().current();
    if (loc != null && mounted) setState(() { _lat = loc.lat; _lon = loc.lon; });
  }

  Future<void> _pickFisher() async {
    final repo = context.read<SigpaRepository>();
    final picked = await showSearchPicker<Credential>(
      context: context,
      title: 'Choisir un pêcheur',
      icon: Icons.person_search,
      search: (q) => repo.searchFishers(q),
      titleOf: (c) => c.holderName,
      subtitleOf: (c) => [
        c.sex.label,
        if (c.boatRef != null) 'Pirogue ${c.boatRef}',
        if (c.landingSite != null) c.landingSite!,
      ].join(' · '),
    );
    if (picked != null) {
      setState(() {
        _name.text = picked.holderName;
        _sex = picked.sex;
        _fisherFromList = picked.id;
        if (picked.boatRef != null && _boat.text.isEmpty) _boat.text = picked.boatRef!;
        if (picked.landingSite != null && _landing.text.isEmpty) _landing.text = picked.landingSite!;
      });
    }
  }

  Future<void> _pickBoat() async {
    final repo = context.read<SigpaRepository>();
    final picked = await showSearchPicker<LookupItem>(
      context: context,
      title: 'Choisir une embarcation',
      icon: Icons.directions_boat,
      search: (q) => repo.searchBoats(q),
      titleOf: (b) => b.label,
      subtitleOf: (b) => b.parentRef,
    );
    if (picked != null) setState(() => _boat.text = picked.label);
  }

  Future<void> _pickLanding() async {
    final repo = context.read<SigpaRepository>();
    final picked = await showSearchPicker<LookupItem>(
      context: context,
      title: 'Choisir un débarcadère',
      icon: Icons.place,
      search: (q) => repo.searchLandingSites(q),
      titleOf: (l) => l.label,
      subtitleOf: (l) => l.parentRef,
    );
    if (picked != null) setState(() => _landing.text = picked.label);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final capture = Capture(
      localId: const Uuid().v4(),
      fisherId: widget.prefill?.id ?? _fisherFromList,
      fisherName: _name.text.trim(),
      fisherSex: _sex,
      boatRef: _boat.text.trim().isEmpty ? null : _boat.text.trim(),
      landingSite: _landing.text.trim().isEmpty ? null : _landing.text.trim(),
      gear: _gear,
      species: _species.text.trim(),
      speciesGroup: _group,
      quantityKg: double.tryParse(_qty.text.replaceAll(',', '.')) ?? 0,
      valueFcfa: double.tryParse(_value.text.replaceAll(',', '.')),
      lat: _lat, lon: _lon,
      capturedAt: DateTime.now(),
      note: _note.text.trim().isEmpty ? null : _note.text.trim(),
      syncStatus: SyncStatus.pending,
    );
    await context.read<SigpaRepository>().saveCapture(capture);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
      content: Text('Capture enregistrée (en file de synchronisation)'),
      backgroundColor: SigpaTheme.ok,
    ));
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Capture sur pont')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (widget.prefill != null)
              _PrefillBanner(name: widget.prefill!.holderName, type: widget.prefill!.type),
            TextFormField(
              controller: _name,
              decoration: InputDecoration(
                labelText: 'Pêcheur',
                prefixIcon: const Icon(Icons.person),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.list_alt, color: SigpaTheme.primary),
                  tooltip: 'Choisir dans la liste',
                  onPressed: _pickFisher,
                ),
              ),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
            ),
            const SizedBox(height: 14),
            SexField(value: _sex, onChanged: (s) => setState(() => _sex = s), label: 'Sexe du pêcheur'),
            const SizedBox(height: 14),
            TextFormField(
              controller: _boat,
              decoration: InputDecoration(
                labelText: 'Pirogue / immatriculation',
                prefixIcon: const Icon(Icons.directions_boat),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.list_alt, color: SigpaTheme.primary),
                  tooltip: 'Choisir une embarcation',
                  onPressed: _pickBoat,
                ),
              ),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _landing,
              decoration: InputDecoration(
                labelText: 'Débarcadère',
                prefixIcon: const Icon(Icons.place),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.list_alt, color: SigpaTheme.primary),
                  tooltip: 'Choisir un débarcadère',
                  onPressed: _pickLanding,
                ),
              ),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<FishingGear>(
              value: _gear,
              decoration: const InputDecoration(labelText: 'Engin de pêche', prefixIcon: Icon(Icons.phishing)),
              items: FishingGear.values.map((g) => DropdownMenuItem(value: g, child: Text(g.label))).toList(),
              onChanged: (g) => setState(() => _gear = g!),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _species,
              decoration: const InputDecoration(labelText: 'Espèce', prefixIcon: Icon(Icons.set_meal)),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<SpeciesGroup?>(
              value: _group,
              decoration: const InputDecoration(labelText: 'Groupe d\'espèces'),
              items: const [
                DropdownMenuItem(value: null, child: Text('—')),
                DropdownMenuItem(value: SpeciesGroup.pelagiques, child: Text('Pélagiques')),
                DropdownMenuItem(value: SpeciesGroup.demersaux, child: Text('Démersaux')),
                DropdownMenuItem(value: SpeciesGroup.crustaces, child: Text('Crustacés')),
              ],
              onChanged: (g) => setState(() => _group = g),
            ),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(child: TextFormField(
                controller: _qty,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Quantité (kg)', prefixIcon: Icon(Icons.scale)),
                validator: (v) => (double.tryParse((v ?? '').replaceAll(',', '.')) == null) ? 'Nombre' : null,
              )),
              const SizedBox(width: 12),
              Expanded(child: TextFormField(
                controller: _value,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Valeur (f.CFA)'),
              )),
            ]),
            const SizedBox(height: 14),
            TextFormField(controller: _note, maxLines: 2, decoration: const InputDecoration(labelText: 'Observations')),
            const SizedBox(height: 8),
            _GpsRow(lat: _lat, lon: _lon, onRefresh: _grabLocation),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: const Icon(Icons.save),
              label: Text(_saving ? 'Enregistrement…' : 'Enregistrer la capture'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PrefillBanner extends StatelessWidget {
  final String name; final CredentialType type;
  const _PrefillBanner({required this.name, required this.type});
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: SigpaTheme.accent.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(children: [
          const Icon(Icons.qr_code, color: SigpaTheme.accent),
          const SizedBox(width: 10),
          Expanded(child: Text('Pré-rempli depuis ${type.label} · $name')),
        ]),
      );
}

class _GpsRow extends StatelessWidget {
  final double? lat, lon; final VoidCallback onRefresh;
  const _GpsRow({required this.lat, required this.lon, required this.onRefresh});
  @override
  Widget build(BuildContext context) => Row(children: [
        const Icon(Icons.my_location, size: 18, color: SigpaTheme.primary),
        const SizedBox(width: 8),
        Expanded(child: Text(
          lat == null ? 'Position non disponible' : 'GPS: ${lat!.toStringAsFixed(5)}, ${lon!.toStringAsFixed(5)}',
          style: const TextStyle(color: Colors.black54, fontSize: 13),
        )),
        TextButton(onPressed: onRefresh, child: const Text('Actualiser')),
      ]);
}
