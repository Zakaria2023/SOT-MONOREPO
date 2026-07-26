import { Tabs } from "expo-router";
import {
  Home,
  LayoutGrid,
  Package,
  ShoppingCart,
  User,
} from "lucide-react-native";
import { Platform, StyleSheet } from "react-native";
import { colors, fonts, type } from "@/lib/theme";

const TabsLayout = () => (
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
        tabBarIcon: ({ color, size }) => <Home color={color} size={22} strokeWidth={2} />,
      }}
    />
    <Tabs.Screen
      name="products"
      options={{
        title: "Products",
        tabBarIcon: ({ color, size }) => <Package color={color} size={22} strokeWidth={2} />,
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
        tabBarIcon: ({ color, size }) => <User color={color} size={22} strokeWidth={2} />,
      }}
    />
  </Tabs>
);

export default TabsLayout;
