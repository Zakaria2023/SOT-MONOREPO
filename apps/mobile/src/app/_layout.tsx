import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/clerk-expo";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from "@expo-google-fonts/hanken-grotesk";
import {
  Newsreader_700Bold,
  Newsreader_800ExtraBold,
} from "@expo-google-fonts/newsreader";
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CLERK_PUBLISHABLE_KEY } from "@/lib/env";
import { colors, fonts, spacing } from "@/lib/theme";
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
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.heading, color: colors.text },
        headerShadowVisible: false,
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
      Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Set it in the monorepo root
      .env.local — the mobile app reads its config from there.
    </Text>
  </View>
);

const RootLayout = () => {
  const [fontsLoaded] = useFonts({
    Newsreader_700Bold,
    Newsreader_800ExtraBold,
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
        <StatusBar style="light" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

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
    fontFamily: fonts.body,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});

export default RootLayout;
