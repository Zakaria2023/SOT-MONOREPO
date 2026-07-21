import { Tabs } from "expo-router";
import {
  Home,
  LayoutGrid,
  Package,
  ShoppingCart,
  User,
} from "lucide-react-native";
import { Platform } from "react-native";
import { colors, fonts } from "@/lib/theme";

const TabsLayout = () => (
  <Tabs
    screenOptions={{
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      headerTitleStyle: { fontFamily: fonts.heading, fontSize: 20 },
      headerShadowVisible: false,
      tabBarStyle: {
        backgroundColor: colors.overlay,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        height: Platform.OS === "ios" ? 88 : 64,
        paddingTop: 8,
        paddingBottom: Platform.OS === "ios" ? 28 : 8,
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.faint,
      tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      sceneStyle: { backgroundColor: colors.background },
    }}
  >
    <Tabs.Screen
      name="index"
      options={{
        title: "Home",
        tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
      }}
    />
    <Tabs.Screen
      name="products"
      options={{
        title: "Products",
        tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
      }}
    />
    <Tabs.Screen
      name="categories"
      options={{
        title: "Categories",
        tabBarIcon: ({ color, size }) => (
          <LayoutGrid color={color} size={size} />
        ),
      }}
    />
    <Tabs.Screen
      name="cart"
      options={{
        title: "Cart",
        tabBarIcon: ({ color, size }) => (
          <ShoppingCart color={color} size={size} />
        ),
      }}
    />
    <Tabs.Screen
      name="profile"
      options={{
        title: "Profile",
        tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
      }}
    />
  </Tabs>
);

export default TabsLayout;
