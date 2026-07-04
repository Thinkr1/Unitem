import SwiftUI

struct SettingsView: View {
    @State private var notificationsEnabled = true

    var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Settings")
                    .font(.system(size: 28, weight: .bold))

                Toggle("Enable Notifications", isOn: $notificationsEnabled)

                NavigationLink(destination: ProfileView()) {
                    Text("Edit Profile")
                        .foregroundColor(Color(red: 0.2, green: 0.4, blue: 1.0))
                }

                Spacer()
            }
            .padding(16)
            .navigationTitle("Settings")
        }
    }
}
