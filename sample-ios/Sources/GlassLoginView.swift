import SwiftUI

// iOS 26 Liquid Glass restyle of the login screen — the source for the
// transfer-v2 demo. The original LoginView.swift is untouched and remains
// the baseline transfer fixture.

struct GlassLoginView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var rememberMe = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Theme.brandInk, Color(hex: "#7C3AED"), Theme.brandPrimary],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Glow blobs give the glass real content to blur and refract.
            Circle()
                .fill(Color(hex: "#38BDF8").opacity(0.55))
                .frame(width: 240, height: 240)
                .blur(radius: 60)
                .offset(x: -120, y: -250)
            Circle()
                .fill(Color(hex: "#FBBF24").opacity(0.45))
                .frame(width: 280, height: 280)
                .blur(radius: 70)
                .offset(x: 140, y: 260)

            VStack(spacing: 16) {
                Image("logo")
                    .resizable()
                    .frame(width: 56, height: 56)

                Text("Welcome back")
                    .font(.custom("SpaceGrotesk-Bold", size: Theme.headingSize))
                    .foregroundColor(.white)

                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textFieldStyle(.plain)
                        .padding(.horizontal, 14)
                        .frame(height: Theme.inputHeight)
                        .background(Color.white.opacity(0.14))
                        .cornerRadius(14)
                        .foregroundColor(.white)
                        .autocapitalization(.none)

                    SecureField("Password", text: $password)
                        .textFieldStyle(.plain)
                        .padding(.horizontal, 14)
                        .frame(height: Theme.inputHeight)
                        .background(Color.white.opacity(0.14))
                        .cornerRadius(14)
                        .foregroundColor(.white)

                    Toggle("Remember me", isOn: $rememberMe)
                        .toggleStyle(.switch)
                        .foregroundColor(.white)
                }
                .padding(20)
                .glassEffect(.regular, in: .rect(cornerRadius: 28))

                Button(action: signIn) {
                    Text("Sign in")
                        .font(.system(size: Theme.bodySize, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.glassProminent)
                .tint(Theme.brandPrimary)

                Button("Forgot password?") {}
                    .buttonStyle(.glass)
                    .font(.system(size: 13))
                    .foregroundColor(.white.opacity(0.85))
            }
            .padding(.horizontal, 24)
        }
    }

    private func signIn() {}
}
