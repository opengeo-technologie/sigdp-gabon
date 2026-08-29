import 'package:flutter/material.dart';
import '../../data/models/enums.dart';

/// Reusable sex-ventilation selector — mandatory on every actor per SIGPA.
class SexField extends StatelessWidget {
  final Sex value;
  final ValueChanged<Sex> onChanged;
  final String label;
  const SexField({super.key, required this.value, required this.onChanged, this.label = 'Sexe'});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelMedium),
        const SizedBox(height: 6),
        SegmentedButton<Sex>(
          segments: const [
            ButtonSegment(value: Sex.male, label: Text('Homme'), icon: Icon(Icons.male)),
            ButtonSegment(value: Sex.female, label: Text('Femme'), icon: Icon(Icons.female)),
            ButtonSegment(value: Sex.unknown, label: Text('N/P')),
          ],
          selected: {value},
          onSelectionChanged: (s) => onChanged(s.first),
        ),
      ],
    );
  }
}
