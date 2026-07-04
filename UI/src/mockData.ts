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
                    .background(Color(hex: "#5A55F2"))
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
                backgroundColor: const Color(0xFF4F46E5),
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
      id: 'inc-001',
      property: 'Button padding',
      severity: 'error',
      rule: 'Primary buttons use 16pt vertical padding (button.padding.vertical).',
      expected: '16',
      ios: { value: '20', line: 33 },
      android: { value: '12', line: 62 },
      status: 'open',
    },
    {
      id: 'inc-002',
      property: 'Primary color',
      severity: 'error',
      rule: 'Primary actions use the brand indigo token (color.primary).',
      expected: '#4F46E5',
      ios: { value: '#5A55F2', line: 34 },
      android: { value: '#4F46E5', line: 61 },
      status: 'open',
    },
    {
      id: 'inc-003',
      property: 'Button corner radius',
      severity: 'error',
      rule: 'Buttons are rounded with a 12pt radius (button.cornerRadius).',
      expected: '12',
      ios: { value: '14', line: 36 },
      android: { value: '8', line: 65 },
      status: 'open',
    },
    {
      id: 'inc-004',
      property: 'Heading font size',
      severity: 'warning',
      rule: 'Screen headings render at 28pt Space Grotesk (typography.heading.size).',
      expected: '28',
      ios: { value: '30', line: 12 },
      android: { value: '26', line: 27 },
      status: 'open',
    },
    {
      id: 'inc-005',
      property: 'Progress bar height',
      severity: 'warning',
      rule: 'Progress bars are 12pt tall (progress.height).',
      expected: '12',
      ios: { value: '10', line: 17 },
      android: { value: '8', line: 35 },
      status: 'open',
    },
    {
      id: 'inc-006',
      property: 'Press animation duration',
      severity: 'warning',
      rule: 'Interactive state changes animate over 200ms (motion.duration.press).',
      expected: '200ms',
      ios: { value: '300ms', line: 38 },
      android: { value: '150ms', line: 63 },
      status: 'open',
    },
    {
      id: 'inc-007',
      property: 'Workout button label',
      severity: 'info',
      rule: 'The workout action is labelled "Complete workout" (copy.workout.label).',
      expected: 'Complete workout',
      ios: { value: '"Complete workout"', line: 30 },
      android: { value: "'Start workout'", line: 70 },
      status: 'open',
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
