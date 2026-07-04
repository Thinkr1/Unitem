import 'package:flutter/material.dart';

import 'theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _rememberMe = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset('assets/logo.png', width: 96, height: 96),
            const SizedBox(height: 24),
            const Text(
              'Welcome back',
              style: TextStyle(
                fontFamily: 'SpaceGrotesk',
                fontSize: 28,
                color: AppTheme.brandInk,
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 52,
              child: TextField(
                controller: _email,
                decoration: const InputDecoration(hintText: 'Email'),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 52,
              child: TextField(
                controller: _password,
                obscureText: true,
                decoration: const InputDecoration(hintText: 'Password'),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Switch(
                  value: _rememberMe,
                  onChanged: (v) => setState(() => _rememberMe = v),
                ),
                const Text('Remember me'),
              ],
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.brandPrimary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: _signIn,
              child: const Text('Sign In', style: TextStyle(fontSize: 17)),
            ),
            const SizedBox(height: 12),
            const Text(
              'Forgot password?',
              style: TextStyle(fontSize: 13, color: Color(0xFF22C55E)),
            ),
          ],
        ),
      ),
    );
  }

  void _signIn() {}
}
