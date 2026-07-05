import 'package:flutter/material.dart';

/// Theme for the Liquid Glass login screen.
///
/// Deliberately a SEPARATE file from the shared `theme.dart` (AppTheme): one
/// theme cannot serve two screens with conflicting values (logoSize 48 vs 56,
/// radiusField 5 vs 14). Transfer v2 makes per-screen themes a rule, so a glass
/// transfer never clobbers the baseline login screen's tokens.
class GlassTheme {
  // Spec colors — every token from the design spec as a Color(0xFFRRGGBB)
  // constant. brandPrimary resolves to rose #E11D48 (the theme/project value),
  // NOT the stale #4F46E5 token in tokens.json.
  static const Color brandInk = Color(0xFF1A1B4B);
  static const Color gradientMid = Color(0xFF7C3AED); // gradientViolet
  static const Color brandPrimary = Color(0xFFE11D48);
  static const Color glowBlue = Color(0xFF38BDF8);
  static const Color glowAmber = Color(0xFFFBBF24);
  static const Color white = Color(0xFFFFFFFF); // textOnGlass

  // Space Grotesk styles the heading ONLY; everything else uses the platform
  // system typeface (SF Pro on iOS / Roboto on Android).
  static const String systemFontFamily = 'SF Pro';

  // Sizes.
  static const double logoSize = 56;
  static const double inputHeight = 52;
  static const double radiusField = 14;
  static const double radiusCard = 28;
  static const double cardPadding = 20;
  static const double fieldHorizontalPadding = 14;
  static const double screenHorizontalPadding = 24;
  static const double stackSpacing = 16;
  static const double fieldSpacing = 12;
  static const double buttonPaddingVertical = 12;
  static const double headingSize = 28;
  static const double bodySize = 17;
  static const double linkSize = 13;
}
