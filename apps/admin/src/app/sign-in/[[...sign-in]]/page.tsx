import { SignIn } from "@clerk/nextjs";

const SignInPage = () => (
  <main className="flex min-h-screen items-center justify-center bg-white">
    <div className="flex w-full max-w-105 flex-col items-center gap-6 px-4">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#111827",
            colorBackground: "#ffffff",
            colorForeground: "#111827",
            colorMutedForeground: "#6b7280",
            colorInput: "#f9fafb",
            colorInputForeground: "#111827",
            borderRadius: "10px",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            fontSize: "14px",
          },
          elements: {
            card: {
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "16px",
              boxShadow:
                "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
              padding: "32px",
              width: "100%",
            },
            headerTitle: {
              color: "#111827",
              fontSize: "18px",
              fontWeight: "600",
            },
            headerSubtitle: {
              color: "#6b7280",
              fontSize: "13px",
            },
            formFieldLabel: {
              color: "#374151",
              fontSize: "13px",
              fontWeight: "500",
            },
            formFieldInput: {
              backgroundColor: "#f9fafb",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              color: "#111827",
              fontSize: "14px",
              padding: "10px 12px",
              outline: "none",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            },
            formButtonPrimary: {
              backgroundColor: "#111827",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              padding: "11px",
              color: "#ffffff",
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            },
            socialButtonsRoot: { display: "none" },
            socialButtonsBlockButton: { display: "none" },
            dividerRow: { display: "none" },
            footerAction: { display: "none" },
            footer: { display: "none" },
            formFieldSuccessText: { color: "#16a34a" },
            formFieldErrorText: { color: "#dc2626" },
            alertText: { color: "#dc2626" },
          },
        }}
      />
    </div>
  </main>
);

export default SignInPage;
