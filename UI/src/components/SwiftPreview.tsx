import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { Inconsistency } from '../types'
import { DeviceCanvas, IPhoneFrame } from './PhoneChrome'
import {
  buildSwiftTheme,
  firstStringArg,
  linearGradientCss,
  parseSwiftUI,
  resolveStyle,
  stackAlignment,
  stackSpacing,
} from '../lib/swiftRender'
import type { ResolvedStyle, SwiftNode, SwiftTheme } from '../lib/swiftRender'

// ─────────────────────────────────────────────────────────────────────────────
// SwiftPreview renders the ACTUAL SwiftUI source: the code is parsed into a
// view tree (lib/swiftRender.ts) and drawn inside the iPhone frame. Change the
// Swift, the preview changes — no hardcoded mock.
// ─────────────────────────────────────────────────────────────────────────────

// The 252px-wide frame stands in for a ~375pt iPhone: scale points → px.
const S = 252 / 375

// Views that fill their ZStack layer edge-to-edge (backgrounds), rather than
// sitting centered like content.
const FILL_VIEWS = new Set(['LinearGradient', 'RadialGradient', 'AngularGradient', 'Rectangle', 'Color'])

const SEVERITY_RING: Record<string, string> = {
  error: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa',
}

interface SwiftPreviewProps {
  code: string
  themeCode?: string
  rulebook?: Record<string, string>
  activeInconsistency?: Inconsistency | null
  device?: string
}

export default function SwiftPreview({
  code,
  themeCode,
  rulebook = {},
  activeInconsistency = null,
}: SwiftPreviewProps) {
  const theme = useMemo(() => buildSwiftTheme(themeCode, rulebook), [themeCode, rulebook])
  const tree = useMemo(() => parseSwiftUI(code), [code])
  const activeLine =
    activeInconsistency && activeInconsistency.status === 'open'
      ? activeInconsistency.ios.line
      : null
  const ringColor = activeInconsistency ? SEVERITY_RING[activeInconsistency.severity] : undefined

  return (
    <DeviceCanvas>
      <IPhoneFrame>
        <div
          className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden"
          style={{ background: '#ffffff', color: '#1A1A1A' }}
        >
          {tree.length > 0 ? (
            tree.map((node, i) => (
              <NodeView key={i} node={node} theme={theme} activeLine={activeLine} ringColor={ringColor} />
            ))
          ) : (
            <div className="px-6 text-center" style={{ fontSize: 11, color: '#a1a1aa' }}>
              No renderable SwiftUI body found in this file.
            </div>
          )}
        </div>
      </IPhoneFrame>
    </DeviceCanvas>
  )
}

// ── node renderer ────────────────────────────────────────────────────────────

interface NodeViewProps {
  node: SwiftNode
  theme: SwiftTheme
  activeLine: number | null
  ringColor?: string
}

function boxStyle(style: ResolvedStyle): CSSProperties {
  const css: CSSProperties = {}
  const { top, bottom, left, right } = style.padding
  if (top || bottom || left || right) {
    css.padding = `${top * S}px ${right * S}px ${bottom * S}px ${left * S}px`
  }
  if (style.width !== undefined) css.width = style.width * S
  if (style.height !== undefined) css.height = style.height * S
  if (style.maxWidthInfinity) css.width = '100%'
  if (style.background) css.background = style.background
  if (style.cornerRadius !== undefined) {
    css.borderRadius = style.cornerRadius >= 999 ? 9999 : style.cornerRadius * S
  }
  if (style.opacity !== undefined) css.opacity = style.opacity
  if (style.border) {
    css.border = `${Math.max(1, style.border.width * S)}px solid ${style.border.color}`
    if (style.border.radius !== undefined && css.borderRadius === undefined) {
      css.borderRadius = style.border.radius * S
    }
  }
  if (style.blur) css.filter = `blur(${style.blur * S}px)`
  // Liquid Glass: frosted backdrop + translucent fill + specular hairline. The
  // backdrop-filter samples whatever the ZStack painted behind this element.
  if (style.glass) {
    const bf = `blur(${Math.max(6, style.glass.blur * S)}px) saturate(160%)`
    css.backdropFilter = bf
    ;(css as CSSProperties & { WebkitBackdropFilter?: string }).WebkitBackdropFilter = bf
    css.background = style.glass.tint ?? 'rgba(255,255,255,0.14)'
    css.border = '1px solid rgba(255,255,255,0.22)'
    css.borderRadius = style.glass.radius >= 999 ? 9999 : style.glass.radius * S
  }
  return css
}

function textStyle(style: ResolvedStyle): CSSProperties {
  const css: CSSProperties = {
    fontSize: (style.fontSize ?? 17) * S,
    fontWeight: style.fontWeight ?? 400,
    color: style.foreground ?? 'inherit',
    lineHeight: 1.25,
  }
  if (style.fontFamily) css.fontFamily = `'${style.fontFamily}', sans-serif`
  if (style.textAlign) css.textAlign = style.textAlign
  return css
}

function NodeView({ node, theme, activeLine, ringColor }: NodeViewProps) {
  const style = resolveStyle(node, theme)
  const highlight: CSSProperties =
    activeLine !== null && node.line === activeLine && ringColor
      ? { outline: `2px solid ${ringColor}`, outlineOffset: 2, borderRadius: 6 }
      : {}

  const children = (extra?: Partial<NodeViewProps>) =>
    node.children.map((child, i) => (
      <NodeView key={i} node={child} theme={theme} activeLine={activeLine} ringColor={ringColor} {...extra} />
    ))

  switch (node.kind) {
    case 'VStack':
    case 'LazyVStack': {
      // SwiftUI centers VStack children by default; .leading/.trailing opt out
      const align = stackAlignment(node)
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: align === 'leading' ? 'flex-start' : align === 'trailing' ? 'flex-end' : 'center',
            gap: stackSpacing(node, theme) * S,
            width: '100%',
            ...boxStyle(style),
            ...highlight,
          }}
        >
          {children()}
        </div>
      )
    }
    case 'HStack':
    case 'LazyHStack': {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            // A plain HStack hugs its content and is centered by the parent
            // VStack (SwiftUI default). A Spacer child renders as flex:1 and
            // eats the free space, so this stays a no-op for edge-pushed rows.
            justifyContent: 'center',
            gap: stackSpacing(node, theme) * S,
            width: '100%',
            ...boxStyle(style),
            ...highlight,
          }}
        >
          {children()}
        </div>
      )
    }
    case 'ZStack': {
      // Layer children absolutely: fill-views (gradient) stretch to the edges,
      // .offset children are placed relative to center, everything else centers.
      // This is the full-screen background + centered content pattern.
      return (
        <div
          style={{
            position: 'relative',
            width: '100%',
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'hidden',
            ...boxStyle(style),
            ...highlight,
          }}
        >
          {node.children.map((child, i) => {
            const cs = resolveStyle(child, theme)
            const fill = FILL_VIEWS.has(child.kind)
            const offset = cs.offsetX !== undefined || cs.offsetY !== undefined
            const wrap: CSSProperties = fill
              ? { position: 'absolute', inset: 0 }
              : offset
                ? {
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) translate(${(cs.offsetX ?? 0) * S}px, ${(cs.offsetY ?? 0) * S}px)`,
                  }
                : {
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }
            return (
              <div key={i} style={wrap}>
                <NodeView node={child} theme={theme} activeLine={activeLine} ringColor={ringColor} />
              </div>
            )
          })}
        </div>
      )
    }
    case 'LinearGradient':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: linearGradientCss(node, theme),
            ...highlight,
          }}
        />
      )
    case 'Circle':
    case 'Ellipse': {
      const box = boxStyle(style)
      return (
        <div
          style={{
            ...box,
            width: (style.width ?? 40) * S,
            height: (style.height ?? 40) * S,
            borderRadius: '50%',
            background: style.fill ?? box.background ?? '#8E8E93',
            ...highlight,
          }}
        />
      )
    }
    case 'Rectangle':
    case 'RoundedRectangle': {
      const box = boxStyle(style)
      return (
        <div
          style={{
            width: (style.width ?? 40) * S,
            height: (style.height ?? 40) * S,
            ...box,
            background: style.fill ?? box.background ?? '#8E8E93',
            ...highlight,
          }}
        />
      )
    }
    case 'ScrollView':
      return (
        <div style={{ overflow: 'hidden', width: '100%', ...boxStyle(style), ...highlight }}>{children()}</div>
      )
    case 'Spacer':
      return <div style={{ flex: 1, minHeight: 8 * S }} />
    case 'Divider':
      return <div style={{ height: 1, background: '#E5E5EA', width: '100%' }} />
    case 'Text': {
      const label = firstStringArg(node) ?? ''
      const isBlock = style.background !== undefined || style.maxWidthInfinity
      const css: CSSProperties = {
        ...textStyle(style),
        ...boxStyle(style),
        ...(isBlock ? { display: 'block', textAlign: style.textAlign ?? 'center' } : {}),
        ...highlight,
      }
      if (style.background && style.foreground === undefined) css.color = '#FFFFFF'
      return <span style={css}>{label}</span>
    }
    case 'TextField':
    case 'SecureField': {
      const placeholder = firstStringArg(node) ?? (node.kind === 'SecureField' ? 'Password' : '')
      const height = (style.height ?? 44) * S
      // A translucent (rgba) fill means the field sits on a dark/glass surface:
      // switch to a light hairline border and light placeholder text.
      const onGlass = (style.background ?? '').startsWith('rgba')
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            height,
            padding: `0 ${10 * S}px`,
            background: style.background ?? '#FFFFFF',
            border: onGlass ? '1px solid rgba(255,255,255,0.18)' : '1px solid #D1D1D6',
            borderRadius: (style.cornerRadius ?? 8) * S,
            ...highlight,
          }}
        >
          <span
            style={{
              fontSize: (style.fontSize ?? 17) * S,
              color: onGlass ? 'rgba(255,255,255,0.6)' : '#9A9AA0',
            }}
          >
            {placeholder}
          </span>
        </div>
      )
    }
    case 'Toggle': {
      const label = firstStringArg(node) ?? ''
      const onColor = style.tint ?? '#34C759'
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            gap: 8 * S,
            ...boxStyle(style),
            ...highlight,
          }}
        >
          <span style={{ fontSize: (style.fontSize ?? 17) * S, color: style.foreground ?? '#1A1A1A' }}>
            {label}
          </span>
          <span
            style={{
              width: 51 * S,
              height: 31 * S,
              borderRadius: 15.5 * S,
              background: onColor,
              position: 'relative',
              flexShrink: 0,
              display: 'inline-block',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2 * S,
                right: 2 * S,
                width: 27 * S,
                height: 27 * S,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                display: 'inline-block',
              }}
            />
          </span>
        </div>
      )
    }
    case 'Button': {
      const label = firstStringArg(node)
      // .buttonStyle(.glass / .glassProminent): prominent = tinted fill, regular
      // = translucent frosted pill. Child text inherits white.
      const glassPill = (extra: CSSProperties): CSSProperties => {
        const prominent = style.glassButton === 'prominent'
        const bf = 'blur(8px) saturate(160%)'
        return {
          color: '#fff',
          borderRadius: 9999,
          background: prominent ? (style.tint ?? '#007AFF') : 'rgba(255,255,255,0.16)',
          border: prominent ? 'none' : '1px solid rgba(255,255,255,0.28)',
          ...(prominent
            ? {}
            : { backdropFilter: bf, WebkitBackdropFilter: bf } as CSSProperties),
          ...extra,
        }
      }
      if (node.children.length > 0) {
        // Button(action:) { styled content } — content carries the styling
        if (style.glassButton) {
          return (
            <div
              style={glassPill({
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...boxStyle(style),
                ...highlight,
              })}
            >
              {children()}
            </div>
          )
        }
        return (
          <div style={{ width: '100%', ...boxStyle(style), ...highlight }}>{children()}</div>
        )
      }
      if (style.glassButton) {
        return (
          <span
            style={glassPill({
              ...textStyle({ ...style, fontSize: style.fontSize ?? 15 }),
              display: 'inline-block',
              textAlign: 'center',
              padding: `${7 * S}px ${16 * S}px`,
              ...highlight,
            })}
          >
            {label ?? 'Button'}
          </span>
        )
      }
      return (
        <span
          style={{
            ...textStyle({ ...style, fontSize: style.fontSize ?? 17 }),
            color: style.foreground ?? '#007AFF',
            textAlign: 'center',
            display: 'block',
            ...boxStyle(style),
            ...highlight,
          }}
        >
          {label ?? 'Button'}
        </span>
      )
    }
    case 'Image': {
      const systemName = node.args.find((a) => a.label === 'systemName')
      const size = {
        width: (style.width ?? 40) * S,
        height: (style.height ?? 40) * S,
      }
      if (systemName) {
        return (
          <span
            style={{
              ...size,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: style.foreground ?? '#8E8E93',
              ...highlight,
            }}
          >
            <GlyphIcon size={Math.min(size.width, size.height)} />
          </span>
        )
      }
      // asset image — placeholder tile (the design's footprint, not its pixels)
      return (
        <span
          style={{
            ...size,
            borderRadius: (style.cornerRadius ?? 20) * S,
            background: 'linear-gradient(135deg, #1A1B4B 0%, #3A3C7E 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            ...highlight,
          }}
        >
          <GlyphIcon size={Math.min(size.width, size.height) * 0.45} color="rgba(255,255,255,0.85)" />
        </span>
      )
    }
    default: {
      // custom view (LogoView(), ProfileHeader()…) — labelled placeholder
      if (node.children.length > 0) {
        return <div style={{ width: '100%', ...boxStyle(style), ...highlight }}>{children()}</div>
      }
      return (
        <span
          style={{
            fontSize: 10,
            color: '#8E8E93',
            border: '1px dashed #D1D1D6',
            borderRadius: 6,
            padding: '3px 8px',
            alignSelf: 'center',
            ...highlight,
          }}
        >
          {node.kind}
        </span>
      )
    }
  }
}

function GlyphIcon({ size, color = 'currentColor' }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" stroke={color} strokeWidth="1.6" />
      <circle cx="9" cy="9" r="2" fill={color} />
      <path d="M5 17l4.5-4.5 3 3L17 11l2 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
