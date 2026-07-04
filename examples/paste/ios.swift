import SwiftUI

struct LoginView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false

    var body: some View {
        VStack(spacing: 24) {
            Image("logo")
                .resizable()
                .frame(width: 96, height: 96)

            Text("Welcome back")
                .font(.custom("SpaceGrotesk-Bold", size: 30))
                .foregroundColor(Color(hex: "#1A1B4B"))

            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textFieldStyle(.roundedBorder)
                    .frame(height: 52)
                    .autocapitalization(.none)

                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)
                    .frame(height: 52)
            }

            Button(action: signIn) {
                Text("Sign In")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
                    .background(Color(hex: "#5A55F2"))
                    .foregroundColor(.white)
                    .cornerRadius(14)
            }
            .animation(.easeInOut(duration: 0.30), value: isLoading)

            Button("Forgot password?") {}
                .font(.system(size: 13))
                .foregroundColor(Color(hex: "#8A8BB3"))
        }
        .padding(.horizontal, 24)
    }

    private func signIn() {}
}
