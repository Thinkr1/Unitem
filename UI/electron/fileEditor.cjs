// ─────────────────────────────────────────────────────────────────────────────
// fileEditor — real filesystem access for the "your own codebase" flow, so it
// can do more than the browser's read-only `<input webkitdirectory>` can:
//   - read a folder by REAL absolute path (native dialog, not a FileList)
//   - write a screen's edited code straight back to its file on disk
//   - open a file in the user's editor of choice (VS Code if on PATH, else
//     whatever the OS opens that file type with)
//   - watch a file and push content changes back to the renderer, so edits
//     made in an external editor (e.g. saved from VS Code) show up live
//
// Runs only in the Electron **main** process — see preload.cjs for the narrow
// API surface exposed to the renderer, and main.cjs for the IPC wiring.
// ─────────────────────────────────────────────────────────────────────────────

const { execFile, spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')

// Directories that are never real screens — skip them so scanning a real
// project doesn't wade through build output / package caches.
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.dart_tool',
  '.gradle',
  '.idea',
  'build',
  'DerivedData',
  'Pods',
  'Carthage',
  '.build',
  'dist',
])

const MAX_FILES = 800
const MAX_FILE_BYTES = 400_000

/** Recursively collects file paths under `rootDir` matching one of `extensions`. */
async function listSourceFiles(rootDir, extensions) {
  const results = []

  async function walk(dir) {
    if (results.length >= MAX_FILES) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (results.length >= MAX_FILES) return
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        await walk(full)
      } else if (extensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
        results.push(full)
      }
    }
  }

  await walk(rootDir)
  return results
}

/** Reads every matching source file under `rootDir`, with real absolute paths. */
async function readFolder(rootDir, extensions) {
  const paths = await listSourceFiles(rootDir, extensions)
  const files = []
  for (const filePath of paths) {
    try {
      const stat = await fs.stat(filePath)
      if (stat.size === 0 || stat.size > MAX_FILE_BYTES) continue
      const content = await fs.readFile(filePath, 'utf8')
      files.push({
        name: path.basename(filePath),
        path: filePath,
        relativePath: path.relative(rootDir, filePath),
        content,
      })
    } catch {
      // unreadable file (permissions, symlink loop, race with an editor
      // save) — skip it rather than failing the whole scan
    }
  }
  return files
}

async function readFile(filePath) {
  return fs.readFile(filePath, 'utf8')
}

async function writeFile(filePath, content) {
  await fs.writeFile(filePath, content, 'utf8')
  return { path: filePath }
}

/** Opens `filePath` in VS Code if its CLI is on PATH, else the OS default
 *  handler for that file type — so "any editor" genuinely means any editor,
 *  not just VS Code specifically. */
async function openInEditor(filePath) {
  const openedWithCode = await new Promise((resolve) => {
    execFile('code', ['--goto', filePath], (err) => resolve(!err))
  })
  if (openedWithCode) return { opened: true, via: 'code' }

  try {
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '', filePath], { detached: true, stdio: 'ignore' }).unref()
    } else {
      const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
      spawn(opener, [filePath], { detached: true, stdio: 'ignore' }).unref()
    }
    return { opened: true, via: 'system' }
  } catch (err) {
    throw new Error(`Could not open ${filePath} in an editor (${err.message}).`)
  }
}

// ── watching (external editor saves -> push new content to the renderer) ──

const watchers = new Map() // absolute path -> { watcher, debounce }

function watchFile(filePath, onChange) {
  if (watchers.has(filePath)) return
  if (!fsSync.existsSync(filePath)) return
  let debounce = null
  const watcher = fsSync.watch(filePath, { persistent: false }, () => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(async () => {
      try {
        const content = await fs.readFile(filePath, 'utf8')
        onChange(content)
      } catch {
        // file mid-write, or briefly missing (some editors replace-on-save)
        // — the next fs event (if any) will pick up the settled content
      }
    }, 200)
  })
  watchers.set(filePath, { watcher, debounce })
}

function unwatchFile(filePath) {
  const entry = watchers.get(filePath)
  if (!entry) return
  if (entry.debounce) clearTimeout(entry.debounce)
  entry.watcher.close()
  watchers.delete(filePath)
}

module.exports = { readFolder, readFile, writeFile, openInEditor, watchFile, unwatchFile }
