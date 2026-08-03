import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Tabs } from "expo-router";
import {
  Home,
  LayoutGrid,
  Package,
  ShoppingCart,
  User,
} from "lucide-react-native";
import { Platform, StyleSheet } from "react-native";
import { colors, fonts, type } from "@/lib/theme";

/**
 * The tabs are the protected part of the app, so the session check belongs here
 * rather than in the root layout.
 *
 * <Redirect> rather than router.replace in an effect. An imperative navigate from
 * the root threw "Attempted to navigate before mounting the Root Layout
 * component", and doing it from an effect here would still mount the tab for a
 * frame first — which is how the profile screen rendered, and started fetching,
 * for a signed-out user. A declarative redirect is resolved by the router before
 * any tab mounts.
 */
const TabsLayout = () => {
  const { isLoaded, isSignedIn } = useAuth();

  // Nothing rendered until the session is known: returning the tabs here would
  // flash them, and returning a redirect would bounce a signed-in user out.
  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        // A white header on a grey page needs no shadow to separate — the
        // surface change already does it, and a large title reads as an app
        // rather than a web view.
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontFamily: fonts.bold,
          fontSize: type.title.size,
          color: colors.text,
        },
        headerTitleAlign: "left",
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.overlay,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === "ios" ? 86 : 68,
          paddingTop: 10,
          paddingBottom: Platform.OS === "ios" ? 28 : 12,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: type.micro.size,
          marginTop: 2,
        },
        tabBarIconStyle: { marginTop: 2 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={22} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          tabBarIcon: ({ color, size }) => (
            <Package color={color} size={22} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Categories",
          tabBarIcon: ({ color, size }) => (
            <LayoutGrid color={color} size={22} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, size }) => (
            <ShoppingCart color={color} size={22} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={22} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
};

export default TabsLayout;
