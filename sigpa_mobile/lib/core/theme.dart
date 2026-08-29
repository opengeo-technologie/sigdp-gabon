import 'package:flutter/material.dart';

/// Blue identity consistent with the SIGPA public portal navbar.
class SigpaTheme {
  static const Color primary = Color(0xFF0B5FA5); // SIGPA blue
  static const Color primaryDark = Color(0xFF073E6C);
  static const Color accent = Color(0xFF16A085);
  static const Color danger = Color(0xFFC0392B);
  static const Color warning = Color(0xFFE67E22);
  static const Color ok = Color(0xFF2ECC71);

  static ThemeData build() {
    final scheme = ColorScheme.fromSeed(
      seedColor: primary,
      primary: primary,
      secondary: accent,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: const Color(0xFFF4F6F8),
      appBarTheme: const AppBarTheme(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
      cardTheme: CardThemeData(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }
}
