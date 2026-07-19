import { useSignIn } from "@clerk/clerk-expo";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { clerkErrorMessage } from "@/lib/clerk-error";
import { colors, spacing } from "@/lib/theme";

type Stage = "email" | "code";

const SignInScreen = () => {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    if (!isLoaded) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      await signIn.create({ identifier: email });
      const factor = signIn.supportedFirstFactors?.find(
        (f) => f.strategy === "email_code",
      );
      if (!factor || !("emailAddressId" in factor)) {
        throw new Error("Email code sign-in is not enabled for this account.");
      }
      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: factor.emailAddressId,
      });
      setStage("code");
    } catch (e) {
      setError(clerkErrorMessage(e));
    } finally {
      setPending(false);
    }
  };

  const verifyCode = async () => {
    if (!isLoaded) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "email_code",
        code,
      });
      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
      } else {
        setError("Additional verification is required to sign in.");
      }
    } catch (e) {
      setError(clerkErrorMessage(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Welcome to SOT</Text>
        <Text style={styles.subtitle}>
          {stage === "email"
            ? "Sign in with your email — we'll send you a code."
            : `Enter the code we sent to ${email}.`}
        </Text>

        {stage === "email" ? (
          <TextField
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />
        ) : (
          <TextField
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={stage === "email" ? "Send code" : "Verify & sign in"}
          onPress={stage === "email" ? sendCode : verifyCode}
          loading={pending}
          disabled={stage === "email" ? email.length === 0 : code.length === 0}
        />

        {stage === "code" ? (
          <Button
            label="Use a different email"
            variant="ghost"
            onPress={() => {
              setStage("email");
              setCode("");
              setError(null);
            }}
          />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "600",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    marginBottom: spacing.sm,
    lineHeight: 21,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
});

export default SignInScreen;
