import SwiftUI

struct LoginView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var rememberMe = false

    var body: some View {
        VStack(spacing: 24) {
            Text("Welcome back")
                .font(.custom("SpaceGrotesk-Bold", size: Theme.headingSize))
                .foregroundColor(Theme.brandInk)

            TextField("Email", text: $email)
                .frame(height: Theme.inputHeight)

            SecureField("Password", text: $password)
                .frame(height: Theme.inputHeight)

            Toggle("Remember me", isOn: $rememberMe)
                .toggleStyle(.switch)
                .tint(Theme.brandPrimary)

            Button(action: signIn) {
                Text("Sign In")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Theme.brandPrimary)
                    .foregroundColor(.white)
                    .cornerRadius(Theme.radiusButton)
            }

            Button("Forgot password?") {}
                .font(.system(size: 13))
                .foregroundColor(Theme.textSecondary)
        }
        .padding(.horizontal, 24)
    }

    private func signIn() {}
}
