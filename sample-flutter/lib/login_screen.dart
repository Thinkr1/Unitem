import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'theme.dart';

// System font (SF Pro) used by the native iOS-style elements: the primary
// 'Sign In' CTA, the 'Remember me' label and the 'Forgot password?' text link.
// The brand heading uses Space Grotesk instead.
const String kSystemFont = 'SF Pro';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _rememberMe = false;

  // Rounded bordered filled field (iOS .roundedBorder equivalent): visible
  // hairline gray border + small ~5pt rounded corners + white fill — never an
  // underline. System-default 17pt text.
  InputDecoration _fieldDecoration(String hint) {
    const border = OutlineInputBorder(
      borderRadius: BorderRadius.all(Radius.circular(AppTheme.radiusField)),
      borderSide: BorderSide(color: AppTheme.fieldBorder, width: 1),
    );
    return InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: AppTheme.surface,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
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
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 96x96 logo, centered at the top.
                Center(
                  child: Image.asset('assets/logo.png', width: 96, height: 96),
                ),
                const SizedBox(height: 24),
                // Heading — Space Grotesk Bold 28pt, brand ink.
                Text(
                  'Welcome back',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.spaceGrotesk(
                    fontWeight: FontWeight.bold,
                    fontSize: AppTheme.headingSize,
                    color: AppTheme.brandInk,
                  ),
                ),
                const SizedBox(height: 24),
                // Tightly-grouped inputs — nested stack, 12pt internal spacing.
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      height: AppTheme.inputHeight,
                      child: TextField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        textCapitalization: TextCapitalization.none,
                        style: const TextStyle(
                          fontFamily: kSystemFont,
                          fontSize: AppTheme.bodySize,
                        ),
                        decoration: _fieldDecoration('Email'),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: AppTheme.inputHeight,
                      child: TextField(
                        controller: _password,
                        obscureText: true,
                        style: const TextStyle(
                          fontFamily: kSystemFont,
                          fontSize: AppTheme.bodySize,
                        ),
                        decoration: _fieldDecoration('Password'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                // Labeled platform switch — leading label, switch trailing,
                // spanning full width.
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Remember me',
                      style: TextStyle(
                        fontFamily: kSystemFont,
                        color: AppTheme.brandInk,
                        fontSize: AppTheme.bodySize,
                      ),
                    ),
                    Switch.adaptive(
                      value: _rememberMe,
                      activeColor: AppTheme.brandPrimary,
                      onChanged: (v) => setState(() => _rememberMe = v),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                // Primary CTA — full-width rose fill, 12pt radius, white text,
                // system font (SF Pro) 17pt semibold, 16pt vertical padding.
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.brandPrimary,
                      foregroundColor: AppTheme.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(AppTheme.radiusButton),
                      ),
                    ),
                    onPressed: _signIn,
                    child: const Text(
                      'Sign In',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: kSystemFont,
                        fontSize: AppTheme.bodySize,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                // Secondary text link — plain, system font 13pt, secondary color.
                Center(
                  child: TextButton(
                    onPressed: () {},
                    child: const Text(
                      'Forgot password?',
                      style: TextStyle(
                        fontFamily: kSystemFont,
                        fontSize: AppTheme.linkSize,
                        fontWeight: FontWeight.normal,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _signIn() {}
}
