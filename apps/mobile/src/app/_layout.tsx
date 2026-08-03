import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/clerk-expo";
// Import each weight from its own subpath rather than the package barrel: the
// barrel's index.js eagerly requires all 18 weights, which Metro (SDK 52 +
// pnpm) fails to resolve. The per-weight modules pull a single TTF each.
import { HankenGrotesk_400Regular } from "@expo-google-fonts/hanken-grotesk/400Regular";
import { HankenGrotesk_500Medium } from "@expo-google-fonts/hanken-grotesk/500Medium";
import { HankenGrotesk_600SemiBold } from "@expo-google-fonts/hanken-grotesk/600SemiBold";
import { HankenGrotesk_700Bold } from "@expo-google-fonts/hanken-grotesk/700Bold";
import { SpaceGrotesk_500Medium } from "@expo-google-fonts/space-grotesk/500Medium";
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { setUnauthorizedHandler } from "@/lib/api";
import { CLERK_PUBLISHABLE_KEY } from "@/lib/env";
import { colors, fonts, spacing, type } from "@/lib/theme";
import { tokenCache } from "@/lib/token-cache";

/**
 * Registers the 401 handler and mounts the navigator. It does NOT redirect.
 *
 * Holding the Stack back until a signed-out user had been moved off a protected
 * route looked like the way to stop the profile tab painting without a session,
 * and it threw: expo-router cannot navigate before a navigator exists, so
 * router.replace from this effect produced "Attempted to navigate before mounting
 * the Root Layout component". The navigator has to mount on the first render.
 *
 * Guarding therefore lives with the thing being guarded — see (tabs)/_layout,
 * which renders <Redirect> instead of calling an imperative navigate. Declarative
 * redirects are resolved by the router itself, so there is no window in which a
 * protected screen is mounted and fetching.
 */
const AuthGate = () => {
  const { isLoaded, signOut } = useAuth();

  // Any 401 from the API signs out here, which flips isSignedIn and lets the
  // guard in the protected group send the user to sign-in. One registration
  // covers every authenticated call in the app.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

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
        headerTitleStyle: {
          fontFamily: fonts.bold,
          fontSize: type.title.size,
          color: colors.text,
        },
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="product/[uuid]" options={{ title: "Product" }} />
      <Stack.Screen name="category/[uuid]" options={{ title: "Category" }} />
      <Stack.Screen name="brand/[uuid]" options={{ title: "Brand" }} />
      <Stack.Screen name="brands" options={{ title: "Brands" }} />
      <Stack.Screen name="offers" options={{ title: "Your offers" }} />
      <Stack.Screen name="orders" options={{ title: "Your orders" }} />
      <Stack.Screen name="compare/[uuid]" options={{ title: "Compare" }} />
      <Stack.Screen name="partner" options={{ title: "Become a partner" }} />
    </Stack>
  );
};

const MissingKey = () => (
  <View style={styles.center}>
    <Text style={styles.error}>
      Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Set it in the monorepo root
      .env.local — the mobile app reads its config from there.
    </Text>
  </View>
);

const RootLayout = () => {
  const [fontsLoaded] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <>
        <StatusBar style="dark" />
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
        <StatusBar style="dark" />
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
    fontFamily: fonts.body,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});

export default RootLayout;
