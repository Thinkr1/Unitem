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

/** Strip relative imports and inline companion sources for DartPad.
 *  The companion body is appended AFTER the code — Dart requires all `import`
 *  directives to come first, so prepending would be a compile error. */
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
      out = `${out.trimEnd()}\n\n// ── inlined for preview ──\n${body.trim()}\n`
    }
  }
  return out
}

/** Strip package:flutter imports from an inlined companion file. */
function stripFlutterPackageImports(code: string): string {
  return code.replace(/import\s+['"]package:flutter\/[^'"]+['"];\n?/g, '')
}

/** DartPad has no asset bundle — swap Image.asset for a gradient tile placeholder.
 *  Preserves width/height from the source call so the preview matches the Code tab layout. */
const IMAGE_ASSET_RE =
  /(?:const\s+)?Image\.asset\(\s*'[^']*'(?:\s*,\s*width:\s*([\d.]+))?(?:\s*,\s*height:\s*([\d.]+))?\s*\)/g

function logoPlaceholder(width = 96, height = 96): string {
  const icon = Math.round(Math.min(width, height) * 0.45)
  return (
    `Container(width: ${width}, height: ${height}, alignment: Alignment.center, ` +
    `decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), ` +
    `gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, ` +
    `colors: [Color(0xFF1A1B4B), Color(0xFF3A3C7E)])), ` +
    `child: const Icon(Icons.image_outlined, size: ${icon}, color: Colors.white70))`
  )
}

export function swapImageAssetsForPreview(code: string): string {
  return code.replace(IMAGE_ASSET_RE, (_match, w, h) => {
    const width = w ? Number(w) : h ? Number(h) : 96
    const height = h ? Number(h) : w ? Number(w) : 96
    return logoPlaceholder(width, height)
  })
}

/**
 * Ensure the Dart source is a runnable Flutter app for DartPad.
 * - Inlines the real theme.dart from the engine when provided (matches the Code tab).
 * - Falls back to rulebook-generated AppTheme only when theme.dart is imported but
 *   no theme source was supplied.
 * - Swaps Image.asset for a same-size placeholder (DartPad has no asset bundle).
 * - Appends a scaled 375×812 harness when no main() is present.
 */
export function wrapDartForPreview(
  code: string,
  rulebook: Record<string, string> = {},
  themeCode?: string,
): string {
  let source = code.trim()

  if (/import\s+['"]theme\.dart['"]/.test(source)) {
    const themeBody = themeCode
      ? stripFlutterPackageImports(themeCode).trim()
      : themeFromRulebook(rulebook)
    source = inlineDartImports(source, { 'theme.dart': themeBody })
  }

  source = swapImageAssetsForPreview(source)
  source = ensureMaterialImport(source)

  if (/\bvoid\s+main\s*\(/.test(source) || /\bmain\s*\(\s*\)\s*(?:async\s*)?\{/.test(source)) {
    return source
  }

  const widget = firstWidgetName(source)
  const home = widget
    ? `${widget}()`
    : `const Scaffold(body: Center(child: Text('Paste a Flutter widget to preview it.')))`

  // Seed the app theme from the rulebook tokens so widgets that lean on
  // Theme.of(context) don't silently fall back to stock Material defaults.
  const seed = hexToFlutterColor(rulebook['color.brandPrimary'] ?? '#6366F1')
  const surface = hexToFlutterColor(rulebook['color.surface'] ?? '#FFFFFF')
  // Render inside a scaled 375x812 virtual device (FittedBox) — the same
  // trick the iOS panel uses (ScaleToFit) — so proportions, line wrapping and
  // font sizes match the iOS preview instead of reflowing to the iframe size.
  const harness = `

void main() => runApp(
  MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: ${seed}),
      scaffoldBackgroundColor: ${surface},
    ),
    home: Scaffold(
      backgroundColor: ${surface},
      body: Center(
        child: FittedBox(
          fit: BoxFit.contain,
          child: SizedBox(
            width: 375,
            height: 812,
            child: ${home},
          ),
        ),
      ),
    ),
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
