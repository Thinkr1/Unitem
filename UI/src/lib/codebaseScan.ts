// ─────────────────────────────────────────────────────────────────────────────
// Whole-codebase import: scans a folder of iOS (.swift) files and a folder of
// Android (.dart) files picked on the launch screen, guesses which files are
// full screens (as opposed to models/theme/helpers), and pairs them up by
// name so each pair can be run through the existing single-pair `/analyze`
// engine call. Everything here is pure/sync except `readFolderFiles`, which
// is the only bit that touches the browser File API — kept separate so the
// matching logic is easy to reason about (and test) on its own.
// ─────────────────────────────────────────────────────────────────────────────

export interface ScannedFile {
  /** File name only, e.g. "DailyGoalsView.swift". */
  name: string
  /** Path relative to the folder the user picked, e.g. "Views/DailyGoalsView.swift". */
  path: string
  content: string
  /** Real absolute path on disk — only set when read via the Electron native
   *  folder picker (readFolderNative), never for the browser's
   *  `<input webkitdirectory>` flow (readFolderFiles), which only exposes a
   *  File object with no writable filesystem handle. */
  absolutePath?: string
}

export interface MatchedScreen {
  /** Normalized key both files matched on, e.g. "dailygoals". */
  key: string
  ios: ScannedFile
  android: ScannedFile
}

export interface ScanResult {
  matched: MatchedScreen[]
  unmatchedIos: ScannedFile[]
  unmatchedAndroid: ScannedFile[]
}

const MAX_FILES_PER_SIDE = 400
// Anything bigger than this is almost certainly not a single screen's source
// (generated code, a bundled asset, etc.) — skip reading it.
const MAX_FILE_BYTES = 400_000

/** Read every .swift/.dart/.kt file out of a `webkitdirectory` FileList. */
export async function readFolderFiles(
  fileList: FileList | null,
  extensions: string[],
): Promise<ScannedFile[]> {
  if (!fileList || fileList.length === 0) return []
  const candidates = Array.from(fileList).filter(
    (f) =>
      extensions.some((ext) => f.name.toLowerCase().endsWith(ext)) &&
      f.size > 0 &&
      f.size <= MAX_FILE_BYTES,
  )
  const picked = candidates.slice(0, MAX_FILES_PER_SIDE)
  const files = await Promise.all(
    picked.map(async (f) => ({
      name: f.name,
      path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
      content: await f.text(),
    })),
  )
  return files
}

/** True inside the Electron shell (has real filesystem access); false in the
 *  plain browser dev server, where folder picking is read-only. */
export function hasNativeFileAccess(): boolean {
  return typeof window !== 'undefined' && !!window.fileEditor && !!window.deviceBridge
}

/** Native folder read via Electron's main process — gives real absolute
 *  paths, which is what makes "Open in editor" and saving edits back to disk
 *  possible. `rootDir` comes from `window.deviceBridge.pickFile({ directory: true })`. */
export async function readFolderNative(
  rootDir: string,
  extensions: string[],
): Promise<ScannedFile[]> {
  if (!window.fileEditor) return []
  const files = await window.fileEditor.readFolder(rootDir, extensions)
  return files.map((f) => ({
    name: f.name,
    path: f.relativePath,
    content: f.content,
    absolutePath: f.path,
  }))
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^./]+$/, '')
}

// Suffixes that just say "this is a screen" and shouldn't affect matching —
// stripped from both sides so "DailyGoalsView.swift" pairs with
// "daily_goals_screen.dart".
const SCREEN_SUFFIXES = new Set([
  'view',
  'viewcontroller',
  'screen',
  'screenview',
  'page',
  'pageview',
  'widget',
  'fragment',
  'activity',
])

/** Normalize a filename to a comparable key: strips extension, splits on
 *  snake_case/kebab-case/camelCase word boundaries, drops a trailing screen
 *  suffix, and joins back with no separators. */
export function toComparableKey(fileName: string): string {
  const base = stripExtension(fileName)
  const words = base
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
  while (words.length > 1 && SCREEN_SUFFIXES.has(words[words.length - 1])) {
    words.pop()
  }
  return words.join('')
}

/** Title-case a comparable key back into a display name: "dailygoals" -> "Dailygoals".
 *  Best-effort only — real casing is lost once words are joined, so this is
 *  just used as a fallback label when a nicer name isn't available. */
export function humanizeKey(key: string): string {
  if (!key) return 'Screen'
  return key.charAt(0).toUpperCase() + key.slice(1)
}

function isCandidateSwiftScreen(file: ScannedFile): boolean {
  if (!file.name.toLowerCase().endsWith('.swift')) return false
  return /\bvar\s+body\s*:\s*some\s+View\b/.test(file.content) || /:\s*View\b/.test(file.content)
}

function isCandidateFlutterScreen(file: ScannedFile): boolean {
  if (!file.name.toLowerCase().endsWith('.dart')) return false
  return (
    /extends\s+State(?:less|ful)Widget\b/.test(file.content) &&
    /Widget\s+build\s*\(/.test(file.content)
  )
}

/** Pair up iOS and Android screen files by normalized name. Files that don't
 *  look like a renderable screen (themes, models, helpers…) are excluded from
 *  both the matched and unmatched lists entirely. */
export function matchScreens(iosFiles: ScannedFile[], androidFiles: ScannedFile[]): ScanResult {
  const iosCandidates = iosFiles.filter(isCandidateSwiftScreen)
  const androidCandidates = androidFiles.filter(isCandidateFlutterScreen)

  const androidByKey = new Map<string, ScannedFile>()
  for (const file of androidCandidates) {
    const key = toComparableKey(file.name)
    if (!androidByKey.has(key)) androidByKey.set(key, file)
  }

  const matched: MatchedScreen[] = []
  const unmatchedIos: ScannedFile[] = []
  for (const file of iosCandidates) {
    const key = toComparableKey(file.name)
    const androidMatch = androidByKey.get(key)
    if (androidMatch) {
      matched.push({ key, ios: file, android: androidMatch })
      androidByKey.delete(key)
    } else {
      unmatchedIos.push(file)
    }
  }

  return { matched, unmatchedIos, unmatchedAndroid: [...androidByKey.values()] }
}

/** Best-effort app name from a folder selection: the top-level folder name
 *  shared by the picked files, e.g. "MyApp-iOS/Views/Login.swift" -> "MyApp-iOS". */
export function guessFolderName(files: ScannedFile[]): string | null {
  const first = files[0]
  if (!first) return null
  const top = first.path.split('/')[0]
  return top || null
}

/** Same idea, but for a native folder pick where we have the real root path
 *  directly (files' relative paths may have no subfolder segment at all). */
export function folderNameFromPath(rootDir: string): string | null {
  const segments = rootDir.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 1] || null
}
