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

/**
 * Ensure the Dart source is a runnable Flutter app for DartPad.
 * - If it already declares `main`, it is returned unchanged.
 * - Otherwise a `main()` + `MaterialApp` harness is appended, mounting the
 *   first widget class found (falling back to a friendly placeholder).
 */
export function wrapDartForPreview(code: string): string {
  const source = code.trim()

  if (/\bvoid\s+main\s*\(/.test(source) || /\bmain\s*\(\s*\)\s*(?:async\s*)?\{/.test(source)) {
    return ensureMaterialImport(source)
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

  return ensureMaterialImport(source + harness)
}

/** DartPad needs the material import for MaterialApp; add it if missing. */
function ensureMaterialImport(code: string): string {
  if (/import\s+['"]package:flutter\/material\.dart['"]/.test(code)) return code
  return `import 'package:flutter/material.dart';\n\n${code}`
}
