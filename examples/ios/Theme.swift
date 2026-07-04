import SwiftUI

extension Color {
    init(hex: String) {
        let v = UInt64(hex.dropFirst(), radix: 16) ?? 0
        self.init(
            red: Double((v >> 16) & 0xFF) / 255,
            green: Double((v >> 8) & 0xFF) / 255,
            blue: Double(v & 0xFF) / 255
        )
    }
}

enum Theme {
    static let brandPrimary = Color(hex: "#6366F1")
    static let brandInk = Color(hex: "#1A1B4B")
    static let textSecondary = Color(hex: "#8A8BB3")
    static let surface = Color(hex: "#FFFFFF")
    static let inputHeight: CGFloat = 52
    static let radiusButton: CGFloat = 12
    static let headingSize: CGFloat = 28
}
