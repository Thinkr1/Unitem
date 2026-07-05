import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'theme.dart';

/// Login screen — a faithful visual twin of the iOS `LoginView`.
///
/// A single centered vertical column with 12pt spacing between every element
/// and 24pt horizontal padding: 48x48 logo, Space Grotesk Bold heading,
/// an inner 12pt-spaced group of two rounded-border inputs (email + password),
/// a native switch-style 'Remember me' toggle, a full-width filled primary
/// button, and a plain text link.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
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

  // Rounded bordered filled field decoration: white fill, subtle light-gray
  // border, small ~5pt corner radius (iOS .roundedBorder equivalent).
  InputDecoration _fieldDecoration(String hint) {
    final OutlineInputBorder border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppTheme.radiusField),
      borderSide: const BorderSide(color: AppTheme.fieldBorder),
    );
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(
        fontFamily: AppTheme.systemFontFamily,
        color: AppTheme.textSecondary,
      ),
      filled: true,
      fillColor: AppTheme.surface,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      enabledBorder: border,
      focusedBorder: border,
      border: border,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.surface,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            return SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: <Widget>[
                      // 48x48 centered logo.
                      Image.asset(
                        'assets/logo.png',
                        width: AppTheme.logoSize,
                        height: AppTheme.logoSize,
                        fit: BoxFit.contain,
                      ),
                      const SizedBox(height: AppTheme.spacing),

                      // Heading — Space Grotesk Bold 28pt, brand ink.
                      Text(
                        'Welcome back',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: AppTheme.headingSize,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.brandInk,
                        ),
                      ),
                      const SizedBox(height: AppTheme.spacing),

                      // Inner 12pt-spaced group of the two inputs.
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: <Widget>[
                          SizedBox(
                            width: double.infinity,
                            height: AppTheme.inputHeight,
                            child: TextField(
                              controller: _emailController,
                              textCapitalization: TextCapitalization.none,
                              style: const TextStyle(
                                fontFamily: AppTheme.systemFontFamily,
                                color: AppTheme.brandInk,
                              ),
                              decoration: _fieldDecoration('Emajaseelil'),
                            ),
                          ),
                          const SizedBox(height: AppTheme.spacing),
                          SizedBox(
                            width: double.infinity,
                            height: AppTheme.inputHeight,
                            child: TextField(
                              controller: _passwordController,
                              obscureText: true,
                              style: const TextStyle(
                                fontFamily: AppTheme.systemFontFamily,
                                color: AppTheme.brandInk,
                              ),
                              decoration: _fieldDecoration('Password'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppTheme.spacing),

                      // 'Remember me' — label leading, native switch trailing.
                      Row(
                        children: <Widget>[
                          const Expanded(
                            child: Text(
                              'Remember me',
                              style: TextStyle(
                                fontFamily: AppTheme.systemFontFamily,
                                color: AppTheme.brandInk,
                              ),
                            ),
                          ),
                          Switch.adaptive(
                            value: _rememberMe,
                            activeColor: AppTheme.white,
                            activeTrackColor: AppTheme.toggleOnTint,
                            onChanged: (bool value) =>
                                setState(() => _rememberMe = value),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppTheme.spacing),

                      // Primary button — full-width filled rose rounded rect.
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
                            shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(AppTheme.radiusButton),
                            ),
                          ),
                          child: const Text(
                            'Sign hijaseelIn',
                            style: TextStyle(
                              fontFamily: AppTheme.systemFontFamily,
                              fontSize: AppTheme.bodySize,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.white,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: AppTheme.spacing),

                      // Secondary — plain text link (no fill, no border).
                      TextButton(
                        onPressed: () {},
                        child: const Text(
                          'Forgot goodbye password?',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontFamily: AppTheme.systemFontFamily,
                            fontSize: AppTheme.linkSize,
                            fontWeight: FontWeight.w400,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
