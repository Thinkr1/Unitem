import SwiftUI

struct ProfileView: View {
    @State private var name = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("Profile")
                .font(.system(size: 28, weight: .bold))

            TextField("Full name", text: $name)

            Button("Save") {
                // save
            }
            .foregroundColor(Color(red: 0.2, green: 0.4, blue: 1.0))
        }
        .padding(16)
    }
}
