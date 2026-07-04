import type { ComparisonResult } from './types'

// BACKEND: replace — this whole module is swapped for a fetch of a real
// ComparisonResult. Everything the UI renders comes from this one object.

const SWIFT_CODE = `import SwiftUI

struct LoginView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false

    var body: some View {
        VStack(spacing: 24) {
            Image("logo")
                .resizable()
                .frame(width: 96, height: 96)

            Text("Welcome back")
                .font(.custom("SpaceGrotesk-Bold", size: 30))
                .foregroundColor(Color(hex: "#1A1B4B"))

            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textFieldStyle(.roundedBorder)
                    .frame(height: 52)
                    .autocapitalization(.none)

                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)
                    .frame(height: 52)
            }

            Button(action: signIn) {
                Text("Sign In")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
                    .background(Color(hex: "#5A55F2"))
                    .foregroundColor(.white)
                    .cornerRadius(14)
            }
            .animation(.easeInOut(duration: 0.30), value: isLoading)

            Button("Forgot password?") {}
                .font(.system(size: 13))
                .foregroundColor(Color(hex: "#8A8BB3"))
        }
        .padding(.horizontal, 24)
    }

    private func signIn() {}
}`

const DART_CODE = `import 'package:flutter/material.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset('assets/logo.png', width: 88, height: 88),
            const SizedBox(height: 24),
            const Text(
              'Welcome back',
              style: TextStyle(
                fontFamily: 'SpaceGrotesk',
                fontSize: 26,
                color: Color(0xFF1A1B4B),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 48,
              child: TextField(
                controller: _email,
                decoration: const InputDecoration(hintText: 'Email'),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 48,
              child: TextField(
                controller: _password,
                obscureText: true,
                decoration: const InputDecoration(hintText: 'Password'),
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                padding: const EdgeInsets.symmetric(vertical: 12),
                animationDuration: const Duration(milliseconds: 150),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: _isLoading ? null : _signIn,
              child: const Text(
                'Log in',
                style: TextStyle(fontSize: 15),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _signIn() {}
}`

export const mockComparison: ComparisonResult = {
  ios: {
    platform: 'ios',
    language: 'swift',
    fileName: 'LoginView.swift',
    code: SWIFT_CODE,
  },
  android: {
    platform: 'android',
    language: 'dart',
    fileName: 'login_screen.dart',
    code: DART_CODE,
  },
  inconsistencies: [
    {
      id: 'inc-001',
      property: 'Button padding',
      severity: 'error',
      rule: 'Primary buttons use 16pt vertical padding (button.padding.vertical).',
      expected: '16',
      ios: { value: '20', line: 33 },
      android: { value: '12', line: 54 },
      status: 'open',
    },
    {
      id: 'inc-002',
      property: 'Primary color',
      severity: 'error',
      rule: 'Primary actions use the brand indigo token (color.primary).',
      expected: '#4F46E5',
      ios: { value: '#5A55F2', line: 34 },
      android: { value: '#4F46E5', line: 53 },
      status: 'open',
    },
    {
      id: 'inc-003',
      property: 'Button corner radius',
      severity: 'error',
      rule: 'Buttons are rounded with a 12pt radius (button.cornerRadius).',
      expected: '12',
      ios: { value: '14', line: 36 },
      android: { value: '8', line: 57 },
      status: 'open',
    },
    {
      id: 'inc-004',
      property: 'Heading font size',
      severity: 'warning',
      rule: 'Screen headings render at 28pt Space Grotesk (typography.heading.size).',
      expected: '28',
      ios: { value: '30', line: 15 },
      android: { value: '26', line: 29 },
      status: 'open',
    },
    {
      id: 'inc-005',
      property: 'Input field height',
      severity: 'warning',
      rule: 'Text inputs are 52pt tall for touch targets (input.height).',
      expected: '52',
      ios: { value: '52', line: 21 },
      android: { value: '48', line: 35 },
      status: 'open',
    },
    {
      id: 'inc-006',
      property: 'Press animation duration',
      severity: 'warning',
      rule: 'Interactive state changes animate over 200ms (motion.duration.press).',
      expected: '200ms',
      ios: { value: '300ms', line: 38 },
      android: { value: '150ms', line: 55 },
      status: 'open',
    },
    {
      id: 'inc-007',
      property: 'Sign-in button label',
      severity: 'info',
      rule: 'The primary auth action is labelled "Sign In" (copy.signIn.label).',
      expected: 'Sign In',
      ios: { value: '"Sign In"', line: 30 },
      android: { value: "'Log in'", line: 62 },
      status: 'open',
    },
  ],
  rulebook: {
    'button.padding.vertical': '16',
    'color.primary': '#4F46E5',
    'button.cornerRadius': '12',
    'typography.heading.size': '28',
    'input.height': '52',
    'motion.duration.press': '200ms',
    'copy.signIn.label': 'Sign In',
  },
}
