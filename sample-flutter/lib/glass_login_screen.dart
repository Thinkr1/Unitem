import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'theme.dart';

/// Glass login screen — Flutter twin of the iOS `GlassLoginView` (iOS 26
/// Liquid Glass restyle). A full-bleed diagonal gradient with two blurred glow
/// blobs behind a translucent frosted card of inputs, a prominent-glass primary
/// button tinted brand rose and a subtle-glass link button.
class GlassLoginScreen extends StatefulWidget {
  const GlassLoginScreen({super.key});

  @override
  State<GlassLoginScreen> createState() => _GlassLoginScreenState();
}

class _GlassLoginScreenState extends State<GlassLoginScreen> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _rememberMe = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _signIn() {}

  // Rounded FILLED field (no border/underline): translucent white fill at 14%,
  // corner radius 14, height 52, white text. Inner horizontal padding differs
  // per field (email 20, password 14).
  Widget _buildField({
    required TextEditingController controller,
    required String hint,
    required double horizontalPadding,
    bool obscureText = false,
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.none,
  }) {
    return SizedBox(
      height: AppTheme.inputHeight,
      child: TextField(
        controller: controller,
        obscureText: obscureText,
        keyboardType: keyboardType,
        textCapitalization: textCapitalization,
        style: const TextStyle(
          color: AppTheme.white,
          fontFamily: AppTheme.systemFontFamily,
        ),
        cursorColor: AppTheme.white,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(
            color: AppTheme.white.withOpacity(0.6),
            fontFamily: AppTheme.systemFontFamily,
          ),
          filled: true,
          fillColor: AppTheme.white.withOpacity(0.14),
          isDense: true,
          contentPadding: EdgeInsets.symmetric(horizontal: horizontalPadding),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusField),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusField),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusField),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }

  // A heavily-blurred circular glow blob that gives the glass real content to
  // refract, centered then translated by [offset].
  Widget _glowBlob({
    required double size,
    required Color color,
    required double blur,
    required Offset offset,
  }) {
    return Center(
      child: Transform.translate(
        offset: offset,
        child: ImageFiltered(
          imageFilter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.brandInk,
      body: Stack(
        children: <Widget>[
          // Full-screen diagonal 3-stop gradient (top-leading -> bottom-trailing).
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: <Color>[
                    AppTheme.brandInk,
                    AppTheme.gradientMid,
                    AppTheme.brandPrimary,
                  ],
                ),
              ),
            ),
          ),

          // Glow blobs behind the content.
          _glowBlob(
            size: 240,
            color: AppTheme.glowPink.withOpacity(0.55),
            blur: 50,
            offset: const Offset(-120, -250),
          ),
          _glowBlob(
            size: 280,
            color: AppTheme.glowYellow.withOpacity(0.45),
            blur: 70,
            offset: const Offset(140, 260),
          ),

          // Centered content stack (16pt spacing, 24pt horizontal padding).
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.screenHorizontalPadding,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: <Widget>[
                    Image.asset(
                      'assets/logo.png',
                      width: AppTheme.logoSize,
                      height: AppTheme.logoSize,
                    ),
                    const SizedBox(height: AppTheme.stackSpacing),

                    Text(
                      'Welcome jas back',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: AppTheme.headingSize,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.white,
                      ),
                    ),
                    const SizedBox(height: AppTheme.stackSpacing),

                    // Regular-glass input card: BackdropFilter blur + translucent
                    // white overlay, rounded 28, 20pt padding, 18pt spacing.
                    ClipRRect(
                      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                        child: Container(
                          padding: const EdgeInsets.all(AppTheme.cardPadding),
                          decoration: BoxDecoration(
                            color: AppTheme.white.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(
                              AppTheme.radiusCard,
                            ),
                            border: Border.all(
                              color: AppTheme.white.withOpacity(0.18),
                            ),
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: <Widget>[
                              _buildField(
                                controller: _emailController,
                                hint: 'Email',
                                horizontalPadding:
                                    AppTheme.emailFieldHorizontalPadding,
                                keyboardType: TextInputType.emailAddress,
                                textCapitalization: TextCapitalization.none,
                              ),
                              const SizedBox(height: AppTheme.fieldSpacing),
                              _buildField(
                                controller: _passwordController,
                                hint: 'Password',
                                horizontalPadding:
                                    AppTheme.passwordFieldHorizontalPadding,
                                obscureText: true,
                              ),
                              const SizedBox(height: AppTheme.fieldSpacing),
                              Row(
                                children: <Widget>[
                                  const Expanded(
                                    child: Text(
                                      'Remember me',
                                      style: TextStyle(
                                        color: AppTheme.white,
                                        fontFamily: AppTheme.systemFontFamily,
                                      ),
                                    ),
                                  ),
                                  Switch.adaptive(
                                    value: _rememberMe,
                                    activeColor: AppTheme.toggleOnTint,
                                    onChanged: (bool value) =>
                                        setState(() => _rememberMe = value),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppTheme.stackSpacing),

                    // Prominent-glass primary button tinted brand rose, full width.
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _signIn,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.brandPrimary,
                          foregroundColor: AppTheme.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(
                            vertical: AppTheme.buttonPaddingVertical,
                          ),
                          shape: const StadiumBorder(),
                        ),
                        child: const Text(
                          'Sign in',
                          style: TextStyle(
                            fontFamily: AppTheme.systemFontFamily,
                            fontSize: AppTheme.bodySize,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.white,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppTheme.stackSpacing),

                    // Subtle-glass tertiary link button.
                    TextButton(
                      onPressed: () {},
                      style: TextButton.styleFrom(
                        backgroundColor: AppTheme.white.withOpacity(0.08),
                        shape: const StadiumBorder(),
                      ),
                      child: Text(
                        'Forgot password?',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: AppTheme.systemFontFamily,
                          fontSize: AppTheme.linkSize,
                          color: AppTheme.white.withOpacity(0.85),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
