import SwiftUI

struct SettingsView: View {
    @State private var notificationsEnabled = true

    var body: some View {
        NavigationStack {
            Form {
                Section("Preferences") {
                    Toggle("Notifications", isOn: $notificationsEnabled)
                        .tint(AppColor.primary)
                }

                Section("Account") {
                    Button("Edit Profile") {}
                        .foregroundStyle(AppColor.primary)
                }
            }
            .navigationTitle("Settings")
        }
    }
}

#Preview {
    SettingsView()
}
