// ─────────────────────────────────────────────────────────────────────────────
// DartPad renders a runnable app: it needs a `main()` that calls runApp(...).
// Pasted snippets often define a widget without an entry point, so we wrap them
// in a minimal harness. This is a best-effort heuristic — documented limitation.
// ─────────────────────────────────────────────────────────────────────────────

const WIDGET_CLASS_RE = /class\s+([A-Za-z_]\w*)\s+extends\s+(?:StatelessWidget|StatefulWidget)/

/** Find the first StatelessWidget/StatefulWidget class name, if any. */
export function firstWidgetName(code: string): string | null {
  const match = code.match(WIDGET_CLASS_RE)
  return match ? match[1] : null
}

/** Convert #RRGGBB to Flutter Color(0xFFRRGGBB). */
function hexToFlutterColor(hex: string): string {
  const h = hex.replace('#', '').toUpperCase()
  return `Color(0xFF${h})`
}

/** Build an inline AppTheme class for DartPad (single-file; no relative imports). */
export function themeFromRulebook(rulebook: Record<string, string>): string {
  const color = (key: string, fallback: string) =>
    hexToFlutterColor(rulebook[`color.${key}`] ?? fallback)
  const num = (cat: string, key: string, fallback: string) =>
    rulebook[`${cat}.${key}`] ?? fallback

  return `class AppTheme {
  static const Color brandPrimary = ${color('brandPrimary', '#6366F1')};
  static const Color brandInk = ${color('brandInk', '#1A1B4B')};
  static const Color textSecondary = ${color('textSecondary', '#8A8BB3')};
  static const Color surface = ${color('surface', '#FFFFFF')};
  static const double inputHeight = ${num('size', 'inputHeight', '52')};
  static const double radiusButton = ${num('size', 'radiusButton', '12')};
  static const double spacingUnit = ${num('size', 'spacingUnit', '8')};
  static const double headingSize = ${num('font', 'headingSize', '28')};
  static const double bodySize = ${num('font', 'bodySize', '17')};
}`
}

/** Strip relative imports and prepend inlined companion sources for DartPad. */
export function inlineDartImports(
  code: string,
  companions: Record<string, string>,
): string {
  let out = code
  for (const [file, body] of Object.entries(companions)) {
    const importRe = new RegExp(
      `import\\s+['"]${file.replace('.', '\\.')}['"];?\\s*\\n?`,
    )
    if (importRe.test(out)) {
      out = out.replace(importRe, '')
      out = `${body.trim()}\n\n${out}`
    }
  }
  return out
}

/**
 * Ensure the Dart source is a runnable Flutter app for DartPad.
 * - Inlines theme.dart (or rulebook-generated AppTheme) when imported.
 * - If it already declares `main`, it is returned unchanged (after inlining).
 * - Otherwise a `main()` + `MaterialApp` harness is appended.
 */
export function wrapDartForPreview(
  code: string,
  rulebook: Record<string, string> = {},
): string {
  let source = code.trim()

  if (/import\s+['"]theme\.dart['"]/.test(source)) {
    source = inlineDartImports(source, {
      'theme.dart': themeFromRulebook(rulebook),
    })
  }

  source = ensureMaterialImport(source)

  if (/\bvoid\s+main\s*\(/.test(source) || /\bmain\s*\(\s*\)\s*(?:async\s*)?\{/.test(source)) {
    return source
  }

  const widget = firstWidgetName(source)
  const home = widget
    ? `${widget}()`
    : `const Scaffold(body: Center(child: Text('Paste a Flutter widget to preview it.')))`

  const harness = `

void main() => runApp(
  MaterialApp(
    debugShowCheckedModeBanner: false,
    home: ${home},
  ),
);
`

  return source + harness
}

/** DartPad needs the material import for MaterialApp; add it if missing. */
function ensureMaterialImport(code: string): string {
  if (/import\s+['"]package:flutter\/material\.dart['"]/.test(code)) return code
  return `import 'package:flutter/material.dart';\n\n${code}`
}
