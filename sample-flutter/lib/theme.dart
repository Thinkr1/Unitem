import 'package:flutter/material.dart';

// Brand theme. Primary color is the brand rose #E11D48 per the 2026 rose
// refresh — NOT the stale #4F46E5 from tokens.json.

class AppTheme {
  static const Color brandPrimary = Color(0xFFE11D48);
  static const Color brandInk = Color(0xFF1A1B4B);
  static const Color textSecondary = Color(0xFF8A8BB3);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color white = Color(0xFFFFFFFF);

  // Thin gray hairline border for the rounded bordered text fields.
  static const Color fieldBorder = Color(0xFFD1D1DB);

  static const double inputHeight = 52;
  static const double radiusButton = 12;
  // iOS .roundedBorder uses a small ~5pt corner radius on its fields.
  static const double radiusField = 5;
  static const double spacingUnit = 8;
  static const double headingSize = 28;
  static const double bodySize = 17;
  static const double linkSize = 13;
}
