import 'package:flutter/material.dart';

// Brand theme. Primary color is the brand rose #E11D48. All values derive from
// the login design spec's color/size tokens.

class AppTheme {
  // Spec colors map — every token appears as a Color(0xFFRRGGBB) constant.
  static const Color brandPrimary = Color(0xFFE11D48);
  static const Color brandInk = Color(0xFF1A1B4B);
  static const Color textSecondary = Color(0xFF8A8BB3);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color white = Color(0xFFFFFFFF);

  // Native switch 'on' tint — iOS system green, applied to the Remember me
  // toggle (NOT the brand rose).
  static const Color toggleOnTint = Color(0xFF34C759);

  // Thin gray hairline border for the rounded bordered text fields.
  static const Color fieldBorder = Color(0xFFD1D1DB);

  // Fonts. Space Grotesk (via google_fonts) styles the heading; 'SF Pro' is
  // the iOS system typeface used for the fields, toggle label, button and link.
  static const String systemFontFamily = 'SF Pro';

  // Sizes.
  static const double logoSize = 48;
  static const double inputHeight = 52;
  static const double radiusButton = 12;
  // iOS .roundedBorder uses a small ~5pt corner radius on its fields.
  static const double radiusField = 5;
  static const double spacing = 12;
  static const double headingSize = 28;
  static const double bodySize = 17;
  static const double linkSize = 13;
  static const double buttonPaddingVertical = 10;
}
