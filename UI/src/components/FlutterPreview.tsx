import { useEffect, useRef, useState } from 'react'
import { wrapDartForPreview } from '../lib/flutterHarness'
import { PixelFrame, EmulatorWindow } from './LoginPreview'

// ─────────────────────────────────────────────────────────────────────────────
// FlutterPreview renders pasted Dart *for real* by embedding DartPad and
// injecting the source over postMessage. DartPad compiles Flutter to web and
// runs it inside the iframe, so this is a true render (network required).
//
// Not wired into ScreenPanel's default "Visual" tab (that now uses the
// reactive LoginPreview schematic for both platforms, matching iOS and
// letting the mockup respond instantly to resolved fixes). Kept here for
// genuinely custom/pasted Dart that the schematic can't represent.
// ─────────────────────────────────────────────────────────────────────────────

const DARTPAD_ORIGIN = 'https://dartpad.dev'
const DARTPAD_SRC = `${DARTPAD_ORIGIN}/?embed=true&run=true&theme=dark`

type Status = 'loading' | 'ready' | 'error'

interface FlutterPreviewProps {
  code: string
  device: string
  rulebook?: Record<string, string>
}

export default function FlutterPreview({ code, device, rulebook = {} }: FlutterPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const loadedRef = useRef(false)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const wrapped = wrapDartForPreview(code, rulebook)

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

    // Fallback: keep posting for a while in case the ready signal is missed.
    let tries = 0
    const retry = window.setInterval(() => {
      if (tries >= 14) {
        window.clearInterval(retry)
        return
      }
      tries += 1
      if (loadedRef.current) post()
    }, 700)

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
      window.clearInterval(retry)
      window.clearTimeout(reveal)
      window.clearTimeout(failsafe)
    }
  }, [code, rulebook])

  const handleLoad = () => {
    loadedRef.current = true
    iframeRef.current?.contentWindow?.postMessage(
      { sourceCode: wrapDartForPreview(code, rulebook), type: 'sourceCode' },
      DARTPAD_ORIGIN,
    )
  }

  return (
    <EmulatorWindow device={device}>
      <div className="relative">
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[30px] bg-surface-deep/85 backdrop-blur-sm">
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
    </EmulatorWindow>
  )
}
