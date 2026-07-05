import SwiftUI

struct LoginView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var rememberMe = false

    var body: some View {
        VStack(spacing: 12) {
            Image("logo")
                .resizable()
                .frame(width: 48, height: 48)

            Text("Welcome back")
                .font(.custom("SpaceGrotesk-Bold", size: Theme.headingSize))
                .foregroundColor(Theme.brandInk)

            VStack(spacing: 12) {
                TextField("Emajaseelil", text: $email)
                    .textFieldStyle(.roundedBorder)
                    .frame(height: Theme.inputHeight)
                    .autocapitalization(.none)

                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)
                    .frame(height: Theme.inputHeight)
            }

            Toggle("Remember me", isOn: $rememberMe)
                .toggleStyle(.switch)

            Button(action: signIn) {
                Text("Sign hijaseelIn")
                    .font(.system(size: Theme.bodySize, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Theme.brandPrimary)
                    .foregroundColor(.white)
                    .cornerRadius(Theme.radiusButton)
            }

            Button("Forgot goodbye password?") {}
                .font(.system(size: 13))
                .foregroundColor(Theme.textSecondary)
        }
        .padding(.horizontal, 24)
    }

    private func signIn() {}
}
