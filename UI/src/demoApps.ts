import type { AppScreen, CodebaseApp, Inconsistency } from './types'
import { mockComparison } from './mockData'

// ─────────────────────────────────────────────────────────────────────────────
// Bundled demo codebases for the launch screen. Each app is a small but real
// "whole app": several screens that share the same design tokens (so the same
// drift — e.g. a stale brand color — shows up more than once, which is the
// whole point of scanning a codebase instead of one screen), plus a Home
// screen that visually links out to the others so the app feels navigable
// rather than a pile of disconnected mockups.
// ─────────────────────────────────────────────────────────────────────────────

// ── FitTrack — screen 2: Home ────────────────────────────────────────────────

const HOME_SWIFT = `import SwiftUI

// The app's hub — links out to every other FitTrack screen.
struct HomeView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Welcome back, Jordan")
                    .font(.custom("SpaceGrotesk-Bold", size: 24))
                    .foregroundColor(Color(hex: "#1A1B4B"))

                HStack(spacing: 14) {
                    NavCard(title: "Daily Goals", icon: "target")
                    NavCard(title: "Habits", icon: "checkmark.circle")
                }
                HStack(spacing: 14) {
                    NavCard(title: "Profile", icon: "person.circle")
                    NavCard(title: "Settings", icon: "gearshape")
                }

                Button(action: { /* navigate to DailyGoalsView */ }) {
                    Text("Start today's workout")
                        .font(.system(size: 17, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color(hex: "#4F46E5"))
                        .foregroundColor(.white)
                        .cornerRadius(14)
                }
            }
            .padding(.horizontal, 24)
        }
    }
}

// Shared nav tile — reused for every destination on the hub.
struct NavCard: View {
    let title: String
    let icon: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .frame(width: 32, height: 32)
            Text(title)
                .font(.system(size: 13, weight: .medium))
        }
        .padding(.vertical, 18)
        .frame(maxWidth: .infinity)
        .background(Color(hex: "#F1F5F9"))
        .cornerRadius(16)
    }
}`

const HOME_DART = `import 'package:flutter/material.dart';

// The app's hub — links out to every other FitTrack screen.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 24),
            const Text(
              'Welcome back, Jordan',
              style: TextStyle(
                fontFamily: 'SpaceGrotesk',
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A1B4B),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(child: _NavCard(title: 'Daily Goals', icon: Icons.flag_outlined)),
                const SizedBox(width: 14),
                Expanded(child: _NavCard(title: 'Habits', icon: Icons.check_circle_outline)),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(child: _NavCard(title: 'Profile', icon: Icons.person_outline)),
                const SizedBox(width: 14),
                Expanded(child: _NavCard(title: 'Settings', icon: Icons.settings_outlined)),
              ],
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF5A55F2),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: () {}, // navigate to DailyGoalsScreen
              child: const Text(
                "Start today's workout",
                style: TextStyle(fontSize: 15),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

// Shared nav tile — reused for every destination on the hub.
class _NavCard extends StatelessWidget {
  const _NavCard({required this.title, required this.icon});
  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 18),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(icon, size: 28),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}`

// ── FitTrack — screen 3: Habit List ─────────────────────────────────────────

const HABITS_SWIFT = `import SwiftUI

struct HabitListView: View {
    let habits = ["Drink water", "Stretch", "Read 10 pages", "Meditate"]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Today's Habits")
                .font(.custom("SpaceGrotesk-Bold", size: 24))
                .foregroundColor(Color(hex: "#1A1B4B"))

            ForEach(habits, id: \\.self) { habit in
                HabitRow(title: habit)
            }

            Button(action: { }) {
                Text("Add habit")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color(hex: "#4F46E5"))
                    .foregroundColor(.white)
                    .cornerRadius(14)
            }
        }
        .padding(.horizontal, 24)
    }
}

struct HabitRow: View {
    let title: String

    var body: some View {
        HStack {
            Image(systemName: "checkmark.circle")
                .frame(width: 22, height: 22)
            Text(title)
                .font(.system(size: 15))
            Spacer()
        }
        .padding(14)
        .background(Color(hex: "#F1F5F9"))
        .cornerRadius(12)
    }
}`

const HABITS_DART = `import 'package:flutter/material.dart';

class HabitListScreen extends StatelessWidget {
  const HabitListScreen({super.key});

  static const habits = ['Drink water', 'Stretch', 'Read 10 pages', 'Meditate'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 24),
            const Text(
              "Today's Habits",
              style: TextStyle(
                fontFamily: 'SpaceGrotesk',
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A1B4B),
              ),
            ),
            const SizedBox(height: 18),
            ...habits.map((habit) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _HabitRow(title: habit),
                )),
            const SizedBox(height: 8),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: () {},
              child: const Text('Add habit', style: TextStyle(fontSize: 14)),
            ),
          ],
        ),
      ),
    );
  }
}

class _HabitRow extends StatelessWidget {
  const _HabitRow({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.check_circle_outline, size: 22),
          const SizedBox(width: 10),
          Text(title, style: const TextStyle(fontSize: 15)),
        ],
      ),
    );
  }
}`

// ── FitTrack — screen 4: Profile ────────────────────────────────────────────

const PROFILE_SWIFT = `import SwiftUI

struct ProfileView: View {
    @State private var notificationsOn = true

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "person.crop.circle.fill")
                .frame(width: 84, height: 84)

            Text("Jordan Avery")
                .font(.custom("SpaceGrotesk-Bold", size: 22))
                .foregroundColor(Color(hex: "#1A1B4B"))

            Text("Member since 2023")
                .font(.system(size: 13))
                .foregroundColor(Color(hex: "#8A8BB3"))

            Toggle("Notifications", isOn: $notificationsOn)
                .padding(.vertical, 8)

            Button(action: { }) {
                Text("Edit profile")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color(hex: "#4F46E5"))
                    .foregroundColor(.white)
                    .cornerRadius(14)
            }
        }
        .padding(.horizontal, 24)
    }
}`

const PROFILE_DART = `import 'package:flutter/material.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _notificationsOn = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircleAvatar(radius: 42, child: Icon(Icons.person, size: 42)),
            const SizedBox(height: 20),
            const Text(
              'Jordan Avery',
              style: TextStyle(
                fontFamily: 'SpaceGrotesk',
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A1B4B),
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Member since 2023',
              style: TextStyle(fontSize: 12, color: Color(0xFF8A8BB3)),
            ),
            SwitchListTile(
              title: const Text('Notifications'),
              value: _notificationsOn,
              onChanged: (v) => setState(() => _notificationsOn = v),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              onPressed: () {},
              child: const Text('Edit profile', style: TextStyle(fontSize: 14)),
            ),
          ],
        ),
      ),
    );
  }
}`

// ── FitTrack — screen 5: Settings ───────────────────────────────────────────

const SETTINGS_SWIFT = `import SwiftUI

struct SettingsView: View {
    @State private var darkMode = false
    @State private var soundOn = true

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Settings")
                .font(.custom("SpaceGrotesk-Bold", size: 24))
                .foregroundColor(Color(hex: "#1A1B4B"))
                .padding(.bottom, 20)

            Toggle("Dark mode", isOn: $darkMode)
                .padding(.vertical, 12)
            Divider()
            Toggle("Sound effects", isOn: $soundOn)
                .padding(.vertical, 12)
            Divider()

            Button(action: { }) {
                Text("Sign out")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(Color(hex: "#EF4444"))
            }
            .padding(.top, 20)
        }
        .padding(.horizontal, 24)
    }
}`

const SETTINGS_DART = `import 'package:flutter/material.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _darkMode = false;
  bool _soundOn = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 24),
            const Text(
              'Settings',
              style: TextStyle(
                fontFamily: 'SpaceGrotesk',
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A1B4B),
              ),
            ),
            const SizedBox(height: 12),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Dark mode'),
              value: _darkMode,
              onChanged: (v) => setState(() => _darkMode = v),
            ),
            const Divider(),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Sound effects'),
              value: _soundOn,
              onChanged: (v) => setState(() => _soundOn = v),
            ),
            const Divider(),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () {},
              child: const Text(
                'Sign out',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFFEF4444)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}`

const FITTRACK_INCONSISTENCIES: Record<string, Inconsistency[]> = {
  home: [
    {
      id: 'fit-home-propagate',
      property: 'Primary CTA color',
      severity: 'error',
      rule: 'Primary actions use the brand indigo token (color.primary).',
      ios: { value: '#4F46E5', line: 0 },
      android: { value: '#5A55F2', line: 0 },
      status: 'open',
      verdict: 'propagate',
      changeKind: 'token',
      confidence: 0.86,
      reason:
        'Same stale brand color as the Daily Goals screen — the "Start today\'s workout" button here is on the old #5A55F2, so this token drifted app-wide, not just on one screen.',
      conventionRefs: ['color.primary'],
      originPlatform: 'ios',
    },
  ],
  habits: [
    {
      id: 'fit-habits-flag',
      property: 'Add habit button radius',
      severity: 'warning',
      rule: 'Primary buttons use a 12pt corner radius (button.cornerRadius).',
      expected: '12',
      ios: { value: '14', line: 0 },
      android: { value: '10', line: 0 },
      status: 'open',
      verdict: 'flag',
      changeKind: 'drift',
      confidence: 0.78,
      reason: 'Both platforms drifted from the 12pt corner-radius token — fix both.',
      conventionRefs: ['button.cornerRadius'],
    },
  ],
  profile: [
    {
      id: 'fit-profile-hold',
      property: 'Notifications toggle control',
      severity: 'info',
      rule: 'Toggle controls follow platform-native patterns.',
      ios: { value: 'Toggle(isOn:)', line: 0 },
      android: { value: 'SwitchListTile', line: 0 },
      status: 'open',
      verdict: 'hold',
      changeKind: 'platform-native',
      confidence: 0.9,
      reason:
        'iOS uses a native Toggle; Android uses a Material SwitchListTile with a built-in label row. Each is the idiomatic control for its platform — correct as-is.',
      conventionRefs: ['hold/native-toggle'],
    },
  ],
  settings: [],
}

function withLines(items: Inconsistency[], ios: string, android: string): Inconsistency[] {
  const iosLines = ios.split('\n')
  const androidLines = android.split('\n')
  const findLine = (lines: string[], needle: string) => {
    const idx = lines.findIndex((l) => l.includes(needle))
    return idx === -1 ? 1 : idx + 1
  }
  return items.map((item) => {
    if (item.id === 'fit-home-propagate') {
      return {
        ...item,
        ios: { ...item.ios, line: findLine(iosLines, '.background(Color(hex: "#4F46E5"))') },
        android: { ...item.android, line: findLine(androidLines, 'backgroundColor: const Color(0xFF5A55F2)') },
      }
    }
    if (item.id === 'fit-habits-flag') {
      return {
        ...item,
        ios: { ...item.ios, line: findLine(iosLines, '.cornerRadius(14)') },
        android: { ...item.android, line: findLine(androidLines, 'BorderRadius.circular(10)') },
      }
    }
    if (item.id === 'fit-profile-hold') {
      return {
        ...item,
        ios: { ...item.ios, line: findLine(iosLines, 'Toggle("Notifications"') },
        android: { ...item.android, line: findLine(androidLines, "title: const Text('Notifications')") },
      }
    }
    return item
  })
}

const dailyGoalsScreen: AppScreen = {
  id: 'daily-goals',
  name: 'Daily Goals',
  ios: mockComparison.ios,
  android: mockComparison.android,
  inconsistencies: mockComparison.inconsistencies,
}

const homeScreen: AppScreen = {
  id: 'home',
  name: 'Home',
  ios: { platform: 'ios', language: 'swift', fileName: 'HomeView.swift', code: HOME_SWIFT },
  android: { platform: 'android', language: 'dart', fileName: 'home_screen.dart', code: HOME_DART },
  inconsistencies: withLines(FITTRACK_INCONSISTENCIES.home, HOME_SWIFT, HOME_DART),
}

const habitsScreen: AppScreen = {
  id: 'habits',
  name: 'Habits',
  ios: { platform: 'ios', language: 'swift', fileName: 'HabitListView.swift', code: HABITS_SWIFT },
  android: { platform: 'android', language: 'dart', fileName: 'habit_list_screen.dart', code: HABITS_DART },
  inconsistencies: withLines(FITTRACK_INCONSISTENCIES.habits, HABITS_SWIFT, HABITS_DART),
}

const profileScreen: AppScreen = {
  id: 'profile',
  name: 'Profile',
  ios: { platform: 'ios', language: 'swift', fileName: 'ProfileView.swift', code: PROFILE_SWIFT },
  android: { platform: 'android', language: 'dart', fileName: 'profile_screen.dart', code: PROFILE_DART },
  inconsistencies: withLines(FITTRACK_INCONSISTENCIES.profile, PROFILE_SWIFT, PROFILE_DART),
}

const settingsScreen: AppScreen = {
  id: 'settings',
  name: 'Settings',
  ios: { platform: 'ios', language: 'swift', fileName: 'SettingsView.swift', code: SETTINGS_SWIFT },
  android: { platform: 'android', language: 'dart', fileName: 'settings_screen.dart', code: SETTINGS_DART },
  inconsistencies: FITTRACK_INCONSISTENCIES.settings,
}

export const fitTrackApp: CodebaseApp = {
  id: 'fittrack',
  name: 'FitTrack',
  description: 'A 5-screen fitness app — home hub, daily goals, habits, profile & settings.',
  icon: '🏃',
  rulebook: mockComparison.rulebook,
  screens: [homeScreen, dailyGoalsScreen, habitsScreen, profileScreen, settingsScreen],
}

// ── ShopEasy — a smaller second demo app ────────────────────────────────────

const PRODUCTS_SWIFT = `import SwiftUI

struct ProductListView: View {
    let products = ["Trail Runner", "City Sneaker", "Studio Slide"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Shop")
                    .font(.custom("SpaceGrotesk-Bold", size: 26))
                    .foregroundColor(Color(hex: "#0F172A"))

                ForEach(products, id: \\.self) { product in
                    ProductRow(name: product)
                }
            }
            .padding(.horizontal, 20)
        }
    }
}

// Reused for every item — tapping "Add" pushes onto the shared Cart badge.
struct ProductRow: View {
    let name: String

    var body: some View {
        HStack {
            Image(systemName: "bag")
                .frame(width: 40, height: 40)
            Text(name)
                .font(.system(size: 15, weight: .medium))
            Spacer()
            Button("Add") { /* adds to CartView's items */ }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Color(hex: "#0EA5A4"))
                .foregroundColor(.white)
                .cornerRadius(10)
        }
        .padding(14)
        .background(Color(hex: "#F8FAFC"))
        .cornerRadius(14)
    }
}`

const PRODUCTS_DART = `import 'package:flutter/material.dart';

class ProductListScreen extends StatelessWidget {
  const ProductListScreen({super.key});

  static const products = ['Trail Runner', 'City Sneaker', 'Studio Slide'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 20),
            const Text(
              'Shop',
              style: TextStyle(
                fontFamily: 'SpaceGrotesk',
                fontSize: 26,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 16),
            ...products.map((p) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _ProductRow(name: p),
                )),
          ],
        ),
      ),
    );
  }
}

// Reused for every item — tapping "Add" pushes onto the shared Cart badge.
class _ProductRow extends StatelessWidget {
  const _ProductRow({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          const Icon(Icons.shopping_bag_outlined, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF14B8A6),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            onPressed: () {}, // adds to CartScreen's items
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }
}`

const CART_SWIFT = `import SwiftUI

struct CartView: View {
    var body: some View {
        VStack(spacing: 20) {
            Text("Your Cart")
                .font(.custom("SpaceGrotesk-Bold", size: 24))
                .foregroundColor(Color(hex: "#0F172A"))

            Text("3 items")
                .font(.system(size: 14))
                .foregroundColor(Color(hex: "#64748B"))

            HStack {
                Text("Total")
                    .font(.system(size: 17, weight: .semibold))
                Spacer()
                Text("$128.00")
                    .font(.system(size: 17, weight: .semibold))
            }
            .padding(.vertical, 12)

            Button(action: { /* navigate to CheckoutView */ }) {
                Text("Checkout")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color(hex: "#0EA5A4"))
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
        }
        .padding(.horizontal, 24)
    }
}`

const CART_DART = `import 'package:flutter/material.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'Your Cart',
              style: TextStyle(
                fontFamily: 'SpaceGrotesk',
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              '3 items',
              style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: const [
                  Text('Total', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
                  Text('\\$128.00', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0EA5A4),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: () {}, // navigate to CheckoutScreen
              child: const Text('Checkout', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }
}`

const CHECKOUT_SWIFT = `import SwiftUI

struct CheckoutView: View {
    @State private var address = ""
    @State private var expressShipping = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Checkout")
                .font(.custom("SpaceGrotesk-Bold", size: 24))
                .foregroundColor(Color(hex: "#0F172A"))

            TextField("Shipping address", text: $address)
                .textFieldStyle(.roundedBorder)

            Toggle("Express shipping", isOn: $expressShipping)

            Button(action: { }) {
                Text("Place order")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color(hex: "#0EA5A4"))
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
        }
        .padding(.horizontal, 24)
    }
}`

const CHECKOUT_DART = `import 'package:flutter/material.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  bool _expressShipping = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 24),
            const Text(
              'Checkout',
              style: TextStyle(
                fontFamily: 'SpaceGrotesk',
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 18),
            const TextField(
              decoration: InputDecoration(
                labelText: 'Shipping address',
                border: OutlineInputBorder(),
              ),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Express shipping'),
              value: _expressShipping,
              onChanged: (v) => setState(() => _expressShipping = v),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0EA5A4),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: () {},
              child: const Text('Place order', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }
}`

function findLineOf(code: string, needle: string): number {
  const idx = code.split('\n').findIndex((l) => l.includes(needle))
  return idx === -1 ? 1 : idx + 1
}

const productsScreen: AppScreen = {
  id: 'products',
  name: 'Product List',
  ios: { platform: 'ios', language: 'swift', fileName: 'ProductListView.swift', code: PRODUCTS_SWIFT },
  android: {
    platform: 'android',
    language: 'dart',
    fileName: 'product_list_screen.dart',
    code: PRODUCTS_DART,
  },
  inconsistencies: [
    {
      id: 'shop-products-propagate',
      property: 'Add-to-cart button color',
      severity: 'error',
      rule: 'Primary actions use the brand teal token (color.accent).',
      ios: { value: '#0EA5A4', line: findLineOf(PRODUCTS_SWIFT, '.background(Color(hex: "#0EA5A4"))') },
      android: {
        value: '#14B8A6',
        line: findLineOf(PRODUCTS_DART, 'backgroundColor: const Color(0xFF14B8A6)'),
      },
      status: 'open',
      verdict: 'propagate',
      changeKind: 'token',
      confidence: 0.83,
      reason: 'Android\'s "Add" button is still on the previous teal shade — propagate the current brand token.',
      conventionRefs: ['color.accent'],
      originPlatform: 'ios',
    },
  ],
}

const cartScreen: AppScreen = {
  id: 'cart',
  name: 'Cart',
  ios: { platform: 'ios', language: 'swift', fileName: 'CartView.swift', code: CART_SWIFT },
  android: { platform: 'android', language: 'dart', fileName: 'cart_screen.dart', code: CART_DART },
  inconsistencies: [
    {
      id: 'shop-cart-flag',
      property: 'Checkout button radius',
      severity: 'warning',
      rule: 'Primary buttons use a 12pt corner radius (button.cornerRadius).',
      expected: '12',
      ios: { value: '12', line: findLineOf(CART_SWIFT, '.cornerRadius(12)') },
      android: { value: '8', line: findLineOf(CART_DART, 'BorderRadius.circular(8)') },
      status: 'open',
      verdict: 'flag',
      changeKind: 'drift',
      confidence: 0.74,
      reason: 'Android drifted from the 12pt corner-radius token on the primary Checkout button.',
      conventionRefs: ['button.cornerRadius'],
      proposedFix: {
        targetPlatform: 'android',
        file: 'cart_screen.dart',
        diff: `--- a/cart_screen.dart
+++ b/cart_screen.dart
@@ -34,7 +34,7 @@
               ),
               onPressed: () {}, // navigate to CheckoutScreen
               shape: RoundedRectangleBorder(
-                borderRadius: BorderRadius.circular(8),
+                borderRadius: BorderRadius.circular(12),
               ),
`,
      },
    },
  ],
}

const checkoutScreen: AppScreen = {
  id: 'checkout',
  name: 'Checkout',
  ios: { platform: 'ios', language: 'swift', fileName: 'CheckoutView.swift', code: CHECKOUT_SWIFT },
  android: {
    platform: 'android',
    language: 'dart',
    fileName: 'checkout_screen.dart',
    code: CHECKOUT_DART,
  },
  inconsistencies: [
    {
      id: 'shop-checkout-hold',
      property: 'Express shipping toggle control',
      severity: 'info',
      rule: 'Toggle controls follow platform-native patterns.',
      ios: { value: 'Toggle(isOn:)', line: findLineOf(CHECKOUT_SWIFT, 'Toggle("Express shipping"') },
      android: {
        value: 'SwitchListTile',
        line: findLineOf(CHECKOUT_DART, "title: const Text('Express shipping')"),
      },
      status: 'open',
      verdict: 'hold',
      changeKind: 'platform-native',
      confidence: 0.9,
      reason:
        'iOS uses a native Toggle; Android uses a Material SwitchListTile. Each platform keeps its idiomatic control here — correct, not drift.',
      conventionRefs: ['hold/native-toggle'],
    },
  ],
}

export const shopEasyApp: CodebaseApp = {
  id: 'shopeasy',
  name: 'ShopEasy',
  description: 'A 3-screen shopping app — product list, cart & checkout.',
  icon: '🛍️',
  rulebook: {
    'color.accent': '#0EA5A4',
    'button.cornerRadius': '12',
    'typography.heading.size': '26',
  },
  screens: [productsScreen, cartScreen, checkoutScreen],
}

export const DEMO_APPS: CodebaseApp[] = [fitTrackApp, shopEasyApp]
