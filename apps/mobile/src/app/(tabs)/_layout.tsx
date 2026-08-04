import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Tabs } from "expo-router";
import {
  Home,
  LayoutGrid,
  Package,
  ShoppingCart,
  User,
} from "lucide-react-native";
import type { ReactNode } from "react";
import type { PressableProps } from "react-native";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { colors, fonts, tracking, type } from "@/lib/theme";

type TabButtonProps = {
  children?: ReactNode;
  // From PressableProps rather than `() => void`: React Navigation hands over a
  // handler that takes the press event, and a zero-arg type rejects it.
  onPress?: PressableProps["onPress"];
  accessibilityState?: { selected?: boolean };
};

/**
 * A tab, marked active by a 2px gold rule along its top edge.
 *
 * React Navigation cannot express this through screenOptions, because the rule
 * has to span the item and know whether that item is focused. A filled pill would
 * have been one option and configurable in a line — and would also have been the
 * only solid shape in a language built entirely from rules.
 */
const TabButton = ({
  children,
  onPress,
  accessibilityState,
}: TabButtonProps) => {
  const focused = accessibilityState?.selected === true;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={accessibilityState}
      style={({ pressed }) => [styles.tab, pressed ? styles.tabPressed : null]}
    >
      <View style={[styles.tabRule, focused ? styles.tabRuleActive : null]} />
      {children}
    </Pressable>
  );
};

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
        // Header on the paper, separated by a hairline rather than a surface
        // change — the page and the header are the same paper here.
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontFamily: fonts.heading,
          fontSize: type.title.size,
          color: colors.text,
        },
        headerTitleAlign: "left",
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 70,
          paddingTop: 0,
          paddingBottom: Platform.OS === "ios" ? 28 : 12,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 8.5,
          letterSpacing: tracking.label,
          textTransform: "uppercase",
          marginTop: 3,
        },
        tabBarIconStyle: { marginTop: 0 },
        // The active tab is marked by a 2px gold rule along its top edge — not a
        // filled pill, which would be the only solid shape in the whole language.
        // The rule is drawn per item so it spans that tab alone.
        tabBarButton: (props) => <TabButton {...props} />,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          // The screens below carry their own masthead, so the navigation header
          // would be a second title for the same page.
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={22} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Package color={color} size={22} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Categories",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <LayoutGrid color={color} size={22} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <ShoppingCart color={color} size={22} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Account",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={22} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
};

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 9,
  },
  // Pressed is a faint gold wash, per the interaction rules — never a ripple or
  // an opacity fade.
  tabPressed: { backgroundColor: colors.hover },
  tabRule: {
    height: 2,
    alignSelf: "stretch",
    backgroundColor: "transparent",
    marginBottom: 7,
  },
  tabRuleActive: { backgroundColor: colors.primary },
});

export default TabsLayout;
