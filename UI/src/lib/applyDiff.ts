// ─────────────────────────────────────────────────────────────────────────────
// Applies a unified diff (the same format demoApps.ts / the engine's
// `difflib.unified_diff` produce) to a source string. Used to make "Resolve"
// and "Transfer all" actually change the code for locally-loaded apps
// (demos + your own scanned codebase), where there is no engine to apply the
// fix server-side.
// ─────────────────────────────────────────────────────────────────────────────
import { parseUnifiedDiff } from './diff'

/** Locate `needle` as a contiguous run inside `haystack`, preferring `hint`
 *  (the hunk's declared old-line index) so an exact-context diff resolves in
 *  O(1) instead of a full scan, but falling back to a real search if the
 *  file has drifted since the diff was generated. */
function findSubsequence(haystack: string[], needle: string[], hint: number): number {
  if (needle.length === 0 || needle.length > haystack.length) return -1
  const matches = (start: number) => needle.every((line, i) => haystack[start + i] === line)
  if (hint >= 0 && hint + needle.length <= haystack.length && matches(hint)) return hint
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    if (matches(i)) return i
  }
  return -1
}

/**
 * Applies every hunk in `diffText` to `original`. Hunks that can't be
 * located (because the file no longer matches the diff's context) are
 * skipped rather than corrupting the file — callers should treat a
 * no-op result as "already applied or out of date" rather than an error.
 */
export function applyUnifiedDiff(original: string, diffText: string): string {
  const files = parseUnifiedDiff(diffText)
  if (files.length === 0) return original

  let lines = original.split('\n')
  for (const file of files) {
    for (const hunk of file.hunks) {
      const oldSeq = hunk.lines.filter((l) => l.type !== 'add').map((l) => l.content)
      const newSeq = hunk.lines.filter((l) => l.type !== 'del').map((l) => l.content)
      const firstOldLine = hunk.lines.find((l) => l.type !== 'add')?.oldLine ?? 1
      const hint = firstOldLine - 1
      const startIdx = findSubsequence(lines, oldSeq, hint)
      if (startIdx === -1) continue
      lines = [...lines.slice(0, startIdx), ...newSeq, ...lines.slice(startIdx + oldSeq.length)]
    }
  }
  return lines.join('\n')
}
