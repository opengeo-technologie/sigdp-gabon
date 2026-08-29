import 'package:flutter/material.dart';
import '../../core/theme.dart';

/// Generic offline searchable picker. Opens a bottom sheet with a search box
/// backed by a local-DB query, returns the chosen item (or null if cancelled).
Future<T?> showSearchPicker<T>({
  required BuildContext context,
  required String title,
  required Future<List<T>> Function(String query) search,
  required String Function(T item) titleOf,
  String? Function(T item)? subtitleOf,
  IconData icon = Icons.search,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _SearchPickerSheet<T>(
      title: title,
      search: search,
      titleOf: titleOf,
      subtitleOf: subtitleOf,
      icon: icon,
    ),
  );
}

class _SearchPickerSheet<T> extends StatefulWidget {
  final String title;
  final Future<List<T>> Function(String) search;
  final String Function(T) titleOf;
  final String? Function(T)? subtitleOf;
  final IconData icon;
  const _SearchPickerSheet({
    required this.title,
    required this.search,
    required this.titleOf,
    required this.subtitleOf,
    required this.icon,
  });
  @override
  State<_SearchPickerSheet<T>> createState() => _SearchPickerSheetState<T>();
}

class _SearchPickerSheetState<T> extends State<_SearchPickerSheet<T>> {
  final _controller = TextEditingController();
  List<T> _results = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _run('');
  }

  Future<void> _run(String q) async {
    setState(() => _loading = true);
    final r = await widget.search(q);
    if (mounted) setState(() { _results = r; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.of(context).size.height * 0.75;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: height,
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(width: 40, height: 4, decoration: BoxDecoration(
              color: Colors.black26, borderRadius: BorderRadius.circular(2))),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                Icon(widget.icon, color: SigpaTheme.primary),
                const SizedBox(width: 8),
                Text(widget.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _controller,
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: 'Rechercher…',
                  prefixIcon: Icon(Icons.search),
                ),
                onChanged: _run,
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _results.isEmpty
                      ? const Center(
                          child: Text('Aucun résultat dans le cache local',
                              style: TextStyle(color: Colors.black45)))
                      : ListView.builder(
                          itemCount: _results.length,
                          itemBuilder: (_, i) {
                            final item = _results[i];
                            final sub = widget.subtitleOf?.call(item);
                            return ListTile(
                              title: Text(widget.titleOf(item)),
                              subtitle: sub == null ? null : Text(sub),
                              onTap: () => Navigator.pop(context, item),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
