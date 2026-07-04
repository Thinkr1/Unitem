import { parseUnifiedDiff, diffStats, type DiffLine } from '../lib/diff'

function filePath(file: { oldPath: string; newPath: string }): string {
  const strip = (p: string) => p.replace(/^[ab]\//, '')
  const preferred = file.newPath && file.newPath !== '/dev/null' ? file.newPath : file.oldPath
  return strip(preferred) || '(unknown file)'
}

const LINE_STYLE: Record<DiffLine['type'], { row: string; sign: string }> = {
  add: { row: 'bg-match/10', sign: 'text-match' },
  del: { row: 'bg-mismatch/10', sign: 'text-mismatch' },
  context: { row: '', sign: 'text-ink-faint/40' },
}

const SIGN: Record<DiffLine['type'], string> = { add: '+', del: '-', context: ' ' }

function DiffLineRow({ line }: { line: DiffLine }) {
  const style = LINE_STYLE[line.type]
  return (
    <div className={`flex ${style.row}`}>
      <span className="w-8 shrink-0 select-none pr-1.5 text-right text-ink-faint/50">
        {line.oldLine ?? ''}
      </span>
      <span className="w-8 shrink-0 select-none pr-1.5 text-right text-ink-faint/50">
        {line.newLine ?? ''}
      </span>
      <span className={`w-3 shrink-0 select-none ${style.sign}`}>{SIGN[line.type]}</span>
      <span className="whitespace-pre-wrap break-all text-code">{line.content || ' '}</span>
    </div>
  )
}

interface DiffViewProps {
  diff: string
  file?: string
  targetPlatform?: string
}

/** A GitHub-PR-style rendering of a unified diff: file header with +/- stats, then
 * one addressable gutter + colored line per hunk. Falls back to raw text if the
 * diff doesn't parse (defensive — the engine always emits `difflib.unified_diff`). */
export default function DiffView({ diff, file, targetPlatform }: DiffViewProps) {
  const trimmed = diff.trim()
  if (!trimmed) return null

  const files = parseUnifiedDiff(trimmed)
  if (files.length === 0) {
    return (
      <pre className="mt-2.5 max-h-40 overflow-auto rounded bg-well px-2.5 py-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-code">
        {trimmed}
      </pre>
    )
  }

  const { additions, deletions } = diffStats(files)

  return (
    <div className="mt-2.5 overflow-hidden rounded border border-edge">
      <div className="flex items-center justify-between gap-2 border-b border-edge bg-surface-raised px-2.5 py-1.5">
        <span className="truncate font-mono text-[10.5px] text-ink-muted">
          {file ?? files.map(filePath).join(', ')}
        </span>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[10px]">
          {targetPlatform && (
            <span className="uppercase tracking-wide text-ink-faint">{targetPlatform}</span>
          )}
          {additions > 0 && <span className="text-match">+{additions}</span>}
          {deletions > 0 && <span className="text-mismatch">-{deletions}</span>}
        </div>
      </div>
      <div className="max-h-56 overflow-auto bg-well font-mono text-[10.5px] leading-relaxed">
        {files.map((f, fileIdx) => (
          <div key={`${f.oldPath}-${f.newPath}-${fileIdx}`}>
            {files.length > 1 && (
              <div className="border-b border-edge/60 bg-surface px-2.5 py-1 font-mono text-[10px] text-ink-faint">
                {filePath(f)}
              </div>
            )}
            {f.hunks.map((hunk, hunkIdx) => (
              <div key={hunkIdx}>
                <div className="bg-surface/60 px-2.5 py-0.5 font-mono text-[10px] text-info-blue/70">
                  {hunk.header}
                </div>
                {hunk.lines.map((line, lineIdx) => (
                  <DiffLineRow key={lineIdx} line={line} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
