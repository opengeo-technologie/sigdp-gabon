import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../core/theme.dart';
import '../../data/models/credential.dart';
import '../../data/models/enums.dart';
import '../../data/models/inspection.dart';
import '../../data/models/lookup_item.dart';
import '../../data/repositories/repositories.dart';
import '../../services/location_service.dart';
import '../widgets/search_picker.dart';
import '../widgets/sex_field.dart';

/// Standard infraction catalogue (maps to srv_infractions codes).
const _infractionCatalogue = <Infraction>[
  Infraction(code: 'LIC-01', label: 'Licence absente ou expirée'),
  Infraction(code: 'ENG-01', label: 'Engin de pêche prohibé'),
  Infraction(code: 'ZON-01', label: 'Pêche en zone interdite'),
  Infraction(code: 'ESP-01', label: 'Espèce protégée / sous-taille'),
  Infraction(code: 'DOC-01', label: 'Documents de bord non conformes'),
  Infraction(code: 'SEC-01', label: 'Sécurité / équipements manquants'),
];

class InspectionFormScreen extends StatefulWidget {
  final Credential? prefill; // usually a scanned licence
  const InspectionFormScreen({super.key, this.prefill});
  @override
  State<InspectionFormScreen> createState() => _InspectionFormScreenState();
}

class _InspectionFormScreenState extends State<InspectionFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _boat = TextEditingController();
  final _mission = TextEditingController();
  final _note = TextEditingController();
  final _seizure = TextEditingController();

  final List<ControlledPerson> _persons = [];
  final Set<String> _selectedInfractions = {};
  bool _licenseValid = false;
  bool _seizureMade = false;
  double? _lat, _lon;
  bool _saving = false;

  String? _licenseId, _fisherId, _agreementId;

  @override
  void initState() {
    super.initState();
    final p = widget.prefill;
    if (p != null) {
      if (p.boatRef != null) _boat.text = p.boatRef!;
      _licenseValid = p.computedState == ValidityState.valid;
      switch (p.type) {
        case CredentialType.license: _licenseId = p.id; break;
        case CredentialType.fisherCard:
          _fisherId = p.id;
          _persons.add(ControlledPerson(name: p.holderName, sex: p.sex, role: 'pêcheur'));
          break;
        case CredentialType.agreement: _agreementId = p.id; break;
      }
    }
    _grabLocation();
  }

  Future<void> _grabLocation() async {
    final loc = await context.read<LocationService>().current();
    if (loc != null && mounted) setState(() { _lat = loc.lat; _lon = loc.lon; });
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

  Future<void> _addPerson() async {
    final result = await showModalBottomSheet<ControlledPerson>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _AddPersonSheet(),
    );
    if (result != null) setState(() => _persons.add(result));
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final infractions = _infractionCatalogue
        .where((i) => _selectedInfractions.contains(i.code))
        .toList();
    final inspection = Inspection(
      localId: const Uuid().v4(),
      missionRef: _mission.text.trim().isEmpty ? null : _mission.text.trim(),
      scannedLicenseId: _licenseId,
      scannedFisherId: _fisherId,
      scannedAgreementId: _agreementId,
      boatRef: _boat.text.trim(),
      licenseValid: _licenseValid,
      persons: _persons,
      infractions: infractions,
      seizureMade: _seizureMade,
      seizureDetails: _seizureMade ? _seizure.text.trim() : null,
      lat: _lat, lon: _lon,
      inspectedAt: DateTime.now(),
      inspectorNote: _note.text.trim(),
      syncStatus: SyncStatus.pending,
    );
    await context.read<SigpaRepository>().saveInspection(inspection);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(infractions.isEmpty
          ? 'Inspection conforme enregistrée'
          : 'Inspection avec ${infractions.length} infraction(s) enregistrée'),
      backgroundColor: infractions.isEmpty ? SigpaTheme.ok : SigpaTheme.warning,
    ));
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Inspection bateau')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (widget.prefill != null)
              _ScannedCredential(cred: widget.prefill!),
            TextFormField(
              controller: _boat,
              decoration: InputDecoration(
                labelText: 'Embarcation contrôlée',
                prefixIcon: const Icon(Icons.directions_boat),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.list_alt, color: SigpaTheme.primary),
                  tooltip: 'Choisir une embarcation',
                  onPressed: _pickBoat,
                ),
              ),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(controller: _mission, decoration: const InputDecoration(labelText: 'Réf. mission (srv_missions)', prefixIcon: Icon(Icons.flag))),
            const SizedBox(height: 14),
            SwitchListTile(
              value: _licenseValid,
              onChanged: (v) => setState(() => _licenseValid = v),
              title: const Text('Licence valide présentée'),
              tileColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            const SizedBox(height: 18),

            _SectionTitle('Personnes contrôlées (ventilation par sexe)'),
            ..._persons.asMap().entries.map((e) => Card(
                  child: ListTile(
                    leading: Icon(e.value.sex == Sex.female ? Icons.female : Icons.male),
                    title: Text(e.value.name),
                    subtitle: Text('${e.value.role} · ${e.value.sex.label}'),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () => setState(() => _persons.removeAt(e.key)),
                    ),
                  ),
                )),
            OutlinedButton.icon(
              onPressed: _addPerson,
              icon: const Icon(Icons.person_add),
              label: const Text('Ajouter une personne'),
            ),
            const SizedBox(height: 18),

            _SectionTitle('Infractions constatées'),
            ..._infractionCatalogue.map((i) => CheckboxListTile(
                  value: _selectedInfractions.contains(i.code),
                  onChanged: (v) => setState(() {
                    v == true ? _selectedInfractions.add(i.code) : _selectedInfractions.remove(i.code);
                  }),
                  title: Text(i.label),
                  subtitle: Text(i.code),
                  dense: true,
                )),
            const SizedBox(height: 8),

            SwitchListTile(
              value: _seizureMade,
              onChanged: (v) => setState(() => _seizureMade = v),
              title: const Text('Saisie effectuée'),
              tileColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            if (_seizureMade) ...[
              const SizedBox(height: 10),
              TextFormField(controller: _seizure, maxLines: 2, decoration: const InputDecoration(labelText: 'Détails de la saisie')),
            ],
            const SizedBox(height: 14),
            TextFormField(controller: _note, maxLines: 3, decoration: const InputDecoration(labelText: 'Observations de l\'inspecteur')),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: const Icon(Icons.save),
              label: Text(_saving ? 'Enregistrement…' : 'Enregistrer l\'inspection'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text, style: const TextStyle(fontWeight: FontWeight.bold, color: SigpaTheme.primaryDark)),
      );
}

class _ScannedCredential extends StatelessWidget {
  final Credential cred;
  const _ScannedCredential({required this.cred});
  @override
  Widget build(BuildContext context) {
    final valid = cred.computedState == ValidityState.valid;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: (valid ? SigpaTheme.ok : SigpaTheme.danger).withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        Icon(valid ? Icons.verified : Icons.gpp_bad, color: valid ? SigpaTheme.ok : SigpaTheme.danger),
        const SizedBox(width: 10),
        Expanded(child: Text('${cred.type.label} scanné · ${cred.holderName} · ${cred.computedState.label}')),
      ]),
    );
  }
}

class _AddPersonSheet extends StatefulWidget {
  const _AddPersonSheet();
  @override
  State<_AddPersonSheet> createState() => _AddPersonSheetState();
}

class _AddPersonSheetState extends State<_AddPersonSheet> {
  final _name = TextEditingController();
  String _role = 'pêcheur';
  Sex _sex = Sex.unknown;
  static const _roles = ['pêcheur', 'propriétaire pirogue', 'mareyeur', 'exploitant ferme', 'capitaine'];

  Future<void> _pickFisher() async {
    final repo = context.read<SigpaRepository>();
    final picked = await showSearchPicker<Credential>(
      context: context,
      title: 'Choisir un pêcheur',
      icon: Icons.person_search,
      search: (q) => repo.searchFishers(q),
      titleOf: (c) => c.holderName,
      subtitleOf: (c) => c.sex.label,
    );
    if (picked != null) {
      setState(() {
        _name.text = picked.holderName;
        _sex = picked.sex;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Personne contrôlée', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          const SizedBox(height: 14),
          TextField(
            controller: _name,
            decoration: InputDecoration(
              labelText: 'Nom',
              prefixIcon: const Icon(Icons.person),
              suffixIcon: IconButton(
                icon: const Icon(Icons.list_alt, color: SigpaTheme.primary),
                tooltip: 'Choisir un pêcheur',
                onPressed: _pickFisher,
              ),
            ),
          ),
          const SizedBox(height: 14),
          DropdownButtonFormField<String>(
            value: _role,
            decoration: const InputDecoration(labelText: 'Rôle'),
            items: _roles.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
            onChanged: (r) => setState(() => _role = r!),
          ),
          const SizedBox(height: 14),
          SexField(value: _sex, onChanged: (s) => setState(() => _sex = s)),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () {
              if (_name.text.trim().isEmpty) return;
              Navigator.pop(context, ControlledPerson(name: _name.text.trim(), sex: _sex, role: _role));
            },
            child: const Text('Ajouter'),
          ),
        ],
      ),
    );
  }
}
