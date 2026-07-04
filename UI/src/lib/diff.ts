// Minimal unified-diff parser — turns `difflib.unified_diff` output (or any
// standard `--- a/... / +++ b/... / @@ ... @@` diff) into structured hunks so
// the UI can render a GitHub-PR-style colored diff instead of a raw text blob.

export type DiffLineType = 'add' | 'del' | 'context'

export interface DiffLine {
  type: DiffLineType
  content: string
  oldLine: number | null
  newLine: number | null
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface DiffFile {
  oldPath: string
  newPath: string
  hunks: DiffHunk[]
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/** Parses one or more concatenated unified diffs (unitem may touch several files per fix). */
export function parseUnifiedDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = []
  let current: DiffFile | null = null
  let hunk: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const rawLine of diff.split('\n')) {
    if (rawLine.startsWith('--- ')) {
      current = { oldPath: rawLine.slice(4).trim(), newPath: '', hunks: [] }
      files.push(current)
      hunk = null
      continue
    }
    if (rawLine.startsWith('+++ ')) {
      if (current) current.newPath = rawLine.slice(4).trim()
      continue
    }
    const hunkMatch = HUNK_HEADER.exec(rawLine)
    if (hunkMatch) {
      if (!current) {
        current = { oldPath: '', newPath: '', hunks: [] }
        files.push(current)
      }
      oldLine = Number(hunkMatch[1])
      newLine = Number(hunkMatch[3])
      hunk = { header: rawLine, lines: [] }
      current.hunks.push(hunk)
      continue
    }
    if (!hunk) continue // stray content before the first hunk (shouldn't happen)

    if (rawLine.startsWith('+')) {
      hunk.lines.push({ type: 'add', content: rawLine.slice(1), oldLine: null, newLine })
      newLine += 1
    } else if (rawLine.startsWith('-')) {
      hunk.lines.push({ type: 'del', content: rawLine.slice(1), oldLine, newLine: null })
      oldLine += 1
    } else if (rawLine.startsWith('\\')) {
      // "\ No newline at end of file" — not a content line, ignore.
      continue
    } else {
      // Context lines are prefixed with a single space; also tolerate none.
      const content = rawLine.startsWith(' ') ? rawLine.slice(1) : rawLine
      if (content === '' && rawLine === '') continue
      hunk.lines.push({ type: 'context', content, oldLine, newLine })
      oldLine += 1
      newLine += 1
    }
  }

  return files.filter((f) => f.hunks.length > 0)
}

export function diffStats(files: DiffFile[]): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const file of files) {
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'add') additions += 1
        else if (line.type === 'del') deletions += 1
      }
    }
  }
  return { additions, deletions }
}
