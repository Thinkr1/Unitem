import { useEffect, useRef, useState } from 'react'
import { wrapDartForPreview } from '../lib/flutterHarness'
import { DEVICE_H, DEVICE_W, DeviceCanvas, PixelFrame } from './PhoneChrome'

// ─────────────────────────────────────────────────────────────────────────────
// FlutterPreview renders the Dart *for real* by embedding DartPad and
// injecting the source over postMessage. DartPad compiles Flutter to web and
// runs it inside the iframe, so this is a true render (network required).
// This is the Android "Visual" tab. The iframe stays MOUNTED across tab
// switches (hidden, not torn down) so DartPad never cold-reloads; after a
// transfer/fix lands the changed source is reposted and DartPad recompiles in
// place (no reload).
// ─────────────────────────────────────────────────────────────────────────────

const DARTPAD_ORIGIN = 'https://dartpad.dev'
const DARTPAD_SRC = `${DARTPAD_ORIGIN}/?embed=true&run=true&theme=dark`

type Status = 'loading' | 'ready' | 'error'

interface FlutterPreviewProps {
  code: string
  device: string
  rulebook?: Record<string, string>
  /** Real theme.dart from the engine — keeps Visual in sync with the Code tab. */
  themeCode?: string
}

export default function FlutterPreview({ code, rulebook = {}, themeCode }: FlutterPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const loadedRef = useRef(false)
  // Last wrapped source we posted to DartPad — lets the effect distinguish a
  // genuine source change (transfer/rescan → re-show the overlay) from a
  // StrictMode / no-op re-run, now that the panel stays mounted across tabs.
  const lastSourceRef = useRef<string | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const wrapped = wrapDartForPreview(code, rulebook, themeCode)

    // If the source genuinely changed after the iframe was already showing
    // something (a transfer/rescan landed), re-show the "Compiling…" overlay so
    // the still-visible previous render isn't mistaken for the new one while
    // DartPad recompiles. We deliberately do NOT early-return on an unchanged
    // source: React StrictMode double-invokes this effect on mount (run →
    // cleanup → run), and bailing on the second run would leave the overlay-
    // clearing listener/timers below unregistered — pinning "Compiling…" forever
    // even though DartPad rendered underneath.
    if (lastSourceRef.current !== null && wrapped !== lastSourceRef.current) {
      setStatus('loading')
    }
    lastSourceRef.current = wrapped

    const post = () => {
      iframe.contentWindow?.postMessage(
        { sourceCode: wrapped, type: 'sourceCode' },
        DARTPAD_ORIGIN,
      )
    }

    // DartPad emits a message when it is ready to receive source — re-post then.
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== DARTPAD_ORIGIN) return
      setStatus('ready')
      post()
    }
    window.addEventListener('message', onMessage)

    // Warm iframe (a tab switch kept it alive, or a repost after a transfer):
    // DartPad is ready, so ONE post recompiles in place. Cold iframe (first
    // load): early posts are dropped, so keep retrying until it loads. (Verified:
    // posting new source into a live DartPad iframe re-runs it — no reload.)
    let retry: number | undefined
    if (loadedRef.current) {
      post()
    } else {
      let tries = 0
      retry = window.setInterval(() => {
        if (tries >= 14) {
          window.clearInterval(retry)
          return
        }
        tries += 1
        if (loadedRef.current) post()
      }, 700)
    }

    // Optimistically clear the overlay shortly after the frame loads (we can't
    // observe the cross-origin compile finishing directly).
    const reveal = window.setTimeout(() => {
      if (loadedRef.current) setStatus('ready')
    }, 3500)

    // If the frame never loads (offline / blocked), surface an error.
    const failsafe = window.setTimeout(() => {
      if (!loadedRef.current) setStatus('error')
    }, 15000)

    return () => {
      window.removeEventListener('message', onMessage)
      if (retry !== undefined) window.clearInterval(retry)
      window.clearTimeout(reveal)
      window.clearTimeout(failsafe)
    }
  }, [code, rulebook, themeCode])

  const handleLoad = () => {
    loadedRef.current = true
    iframeRef.current?.contentWindow?.postMessage(
      { sourceCode: wrapDartForPreview(code, rulebook, themeCode), type: 'sourceCode' },
      DARTPAD_ORIGIN,
    )
  }

  return (
    <DeviceCanvas>
      <div className="relative" style={{ width: DEVICE_W, height: DEVICE_H }}>
        <PixelFrame>
          <iframe
            ref={iframeRef}
            src={DARTPAD_SRC}
            title="Flutter live preview"
            onLoad={handleLoad}
            allow="clipboard-read; clipboard-write"
            className="min-h-0 w-full flex-1 border-0 bg-white"
          />
        </PixelFrame>

        {status !== 'ready' && (
          <div className="device-preview-overlay absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[30px]">
            {status === 'loading' ? (
              <>
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-edge-bright border-t-accent" />
                <span className="font-heading text-[11px] text-ink-muted">
                  Compiling Flutter…
                </span>
              </>
            ) : (
              <div className="px-6 text-center">
                <p className="font-heading text-[12px] font-semibold text-ink">
                  Live preview unavailable
                </p>
                <p className="mt-1 text-[10.5px] leading-snug text-ink-faint">
                  The Flutter renderer needs an internet connection to DartPad.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </DeviceCanvas>
  )
}
