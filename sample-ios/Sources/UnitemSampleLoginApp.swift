import SwiftUI

// Entry point that turns the loose Theme.swift / LoginView.swift snippets
// (the actual Unitem demo source) into a real, runnable iOS app so it can be
// built and installed on a real Simulator — see `run.sh`.
@main
struct UnitemSampleLoginApp: App {
    var body: some Scene {
        WindowGroup {
            LoginView()
        }
    }
}
