import type { ComparisonResult } from './types'

// BACKEND: replace — this whole module is swapped for a fetch of a real
// ComparisonResult. Everything the UI renders comes from this one object.

const SWIFT_CODE = `import SwiftUI

struct DailyGoalsView: View {
    @State private var waterGlasses = 3
    @State private var workoutDone = false
    @State private var progress: Double = 0.38

    var body: some View {
        VStack(spacing: 24) {
            Text("Daily Goals")
                .font(.custom("SpaceGrotesk-Bold", size: 30))
                .foregroundColor(Color(hex: "#1A1B4B"))

            ProgressView(value: progress)
                .frame(height: 10)
                .tint(Color(hex: "#4F46E5"))

            HStack(spacing: 16) {
                Text("Water: \\(waterGlasses)/8")
                    .font(.system(size: 15))
                Button("-") { if waterGlasses > 0 { waterGlasses -= 1 } }
                    .frame(width: 44, height: 44)
                Button("+") { if waterGlasses < 8 { waterGlasses += 1 } }
                    .frame(width: 44, height: 44)
            }

            Button(action: { workoutDone.toggle() }) {
                Text(workoutDone ? "Workout complete" : "Complete workout")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
                    .background(Color(hex: "#4F46E5"))
                    .foregroundColor(.white)
                    .cornerRadius(14)
            }
            .animation(.easeInOut(duration: 0.30), value: workoutDone)
        }
        .padding(.horizontal, 24)
    }
}`

const DART_CODE = `import 'package:flutter/material.dart';

class DailyGoalsScreen extends StatefulWidget {
  const DailyGoalsScreen({super.key});

  @override
  State<DailyGoalsScreen> createState() => _DailyGoalsScreenState();
}

class _DailyGoalsScreenState extends State<DailyGoalsScreen> {
  int _waterGlasses = 3;
  bool _workoutDone = false;
  double _progress = 0.38;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'Daily Goals',
              style: TextStyle(
                fontFamily: 'SpaceGrotesk',
                fontSize: 26,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A1B4B),
              ),
            ),
            const SizedBox(height: 24),
            LinearProgressIndicator(
              value: _progress,
              minHeight: 8,
              color: const Color(0xFF4F46E5),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Water: $_waterGlasses/8'),
                IconButton(
                  onPressed: () => setState(() {
                    if (_waterGlasses > 0) _waterGlasses--;
                  }),
                  icon: const Icon(Icons.remove),
                ),
                IconButton(
                  onPressed: () => setState(() {
                    if (_waterGlasses < 8) _waterGlasses++;
                  }),
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF5A55F2),
                padding: const EdgeInsets.symmetric(vertical: 12),
                animationDuration: const Duration(milliseconds: 150),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: () => setState(() => _workoutDone = !_workoutDone),
              child: Text(
                _workoutDone ? 'Workout complete' : 'Start workout',
                style: const TextStyle(fontSize: 15),
              ),
            ),
          ],
        ),
      ),
    );
  }
}`

const PRIMARY_COLOR_PROPAGATE_DIFF = `--- a/daily_goals_screen.dart
+++ b/daily_goals_screen.dart
@@ -58,7 +58,7 @@
             ElevatedButton(
               style: ElevatedButton.styleFrom(
-                backgroundColor: const Color(0xFF5A55F2),
+                backgroundColor: const Color(0xFF4F46E5),
                 padding: const EdgeInsets.symmetric(vertical: 12),
                 animationDuration: const Duration(milliseconds: 150),
                 shape: RoundedRectangleBorder(
`

const BUTTON_PADDING_FLAG_DIFF = `--- a/DailyGoalsView.swift
+++ b/DailyGoalsView.swift
@@ -34,4 +34,4 @@
                     .frame(maxWidth: .infinity)
-                    .padding(.vertical, 20)
+                    .padding(.vertical, 16)
                     .background(Color(hex: "#4F46E5"))
                     .foregroundColor(.white)
`

export const mockComparison: ComparisonResult = {
  ios: {
    platform: 'ios',
    language: 'swift',
    fileName: 'DailyGoalsView.swift',
    code: SWIFT_CODE,
  },
  android: {
    platform: 'android',
    language: 'dart',
    fileName: 'daily_goals_screen.dart',
    code: DART_CODE,
  },
  inconsistencies: [
    {
      id: 'inc-hold',
      property: 'Water stepper control',
      severity: 'info',
      rule: 'Stepper controls follow platform-native patterns.',
      ios: { value: 'Button("-") / Button("+")', line: 26 },
      android: { value: 'IconButton(Icons.remove/add)', line: 89 },
      status: 'open',
      verdict: 'hold',
      changeKind: 'platform-native',
      confidence: 0.91,
      reason:
        'iOS uses labeled stepper buttons per Apple HIG; Android uses Material IconButtons for the same action. Each platform keeps its native control — this difference is correct, not drift.',
      conventionRefs: ['hold/native-stepper'],
    },
    {
      id: 'inc-propagate',
      property: 'Primary color',
      severity: 'error',
      rule: 'Primary actions use the brand indigo token (color.primary).',
      ios: { value: '#4F46E5', line: 37 },
      android: { value: '#5A55F2', line: 106 },
      status: 'open',
      verdict: 'propagate',
      changeKind: 'token',
      confidence: 0.88,
      reason:
        'Design updated the primary brand color to #4F46E5 on iOS — propagate the token change to Android.',
      conventionRefs: ['color.primary'],
      originPlatform: 'ios',
      proposedFix: {
        targetPlatform: 'android',
        file: 'daily_goals_screen.dart',
        diff: PRIMARY_COLOR_PROPAGATE_DIFF,
      },
      prUrl: 'https://github.com/Thinkr1/Unitem/pull/999',
    },
    {
      id: 'inc-flag',
      property: 'Button padding',
      severity: 'error',
      rule: 'Primary buttons use 16pt vertical padding (button.padding.vertical).',
      expected: '16',
      ios: { value: '20', line: 36 },
      android: { value: '12', line: 107 },
      status: 'open',
      verdict: 'flag',
      changeKind: 'drift',
      confidence: 0.94,
      reason: 'Both platforms drifted from the 16pt vertical-padding token — fix both.',
      conventionRefs: ['button.padding.vertical'],
      proposedFix: {
        targetPlatform: 'ios',
        file: 'DailyGoalsView.swift',
        diff: BUTTON_PADDING_FLAG_DIFF,
      },
    },
  ],
  rulebook: {
    'button.padding.vertical': '16',
    'color.primary': '#4F46E5',
    'button.cornerRadius': '12',
    'typography.heading.size': '28',
    'progress.height': '12',
    'motion.duration.press': '200ms',
    'copy.workout.label': 'Complete workout',
  },
}
