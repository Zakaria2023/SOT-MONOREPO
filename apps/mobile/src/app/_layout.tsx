import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CLERK_PUBLISHABLE_KEY } from "@/lib/env";
import { colors, spacing } from "@/lib/theme";
import { tokenCache } from "@/lib/token-cache";

// Redirect between the authenticated app and the sign-in screen based on the
// Clerk session, so no signed-out user can land on a protected route.
const AuthGate = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    const inAuthGroup = segments[0] === "(auth)";
    if (!isSignedIn && !inAuthGroup) {
      router.replace("/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, segments, router]);

  if (!isLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="product/[uuid]" options={{ title: "Product" }} />
      <Stack.Screen name="category/[uuid]" options={{ title: "Category" }} />
      <Stack.Screen name="brand/[uuid]" options={{ title: "Brand" }} />
      <Stack.Screen name="brands" options={{ title: "Brands" }} />
      <Stack.Screen name="offers" options={{ title: "Your offers" }} />
      <Stack.Screen name="partner" options={{ title: "Become a partner" }} />
    </Stack>
  );
};

const MissingKey = () => (
  <View style={styles.center}>
    <Text style={styles.error}>
      Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Copy apps/mobile/.env.example to
      apps/mobile/.env and set your Clerk publishable key.
    </Text>
  </View>
);

const RootLayout = () => {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <>
        <StatusBar style="light" />
        <MissingKey />
      </>
    );
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>
        <StatusBar style="light" />
        <AuthGate />
      </ClerkLoaded>
    </ClerkProvider>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  error: {
    color: colors.danger,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});

export default RootLayout;
