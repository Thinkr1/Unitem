# Global Design Principles

These principles are the shared source of truth for both the iOS and Android
apps. The consistency checker uses them to decide what must match and what may
diverge for native feel.

## Must be consistent across platforms
- **Spacing scale**: use an 8pt grid. Screen edge padding is 16. Vertical gap
  between stacked content blocks is 24.
- **Typography scale**: screen titles are 28pt bold; body text is 16pt.
- **Color tokens**: primary brand color is `#3366FF`. Do not hardcode other
  brand blues.
- **Layout hierarchy**: the same screens must present the same content in the
  same order.
- **Content/labels**: user-facing copy must match (same wording).
- **Feature parity**: every screen must exist on both platforms.

## Expected to be native (do NOT flag)
- Navigation chrome: iOS uses a navigation bar with back-swipe; Android uses a
  top app bar with the system back button.
- System controls: date pickers, switches, and menus should use each platform's
  native component and styling.
- Fonts: iOS uses San Francisco, Android uses Roboto, as system defaults.
- Touch feedback: Android ripple vs iOS highlight.
