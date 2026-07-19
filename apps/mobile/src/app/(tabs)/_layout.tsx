import { Tabs } from "expo-router";
import { LayoutGrid, Package, ShoppingCart, User } from "lucide-react-native";
import { colors } from "@/lib/theme";

const TabsLayout = () => (
  <Tabs
    screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      sceneStyle: { backgroundColor: colors.background },
    }}
  >
    <Tabs.Screen
      name="index"
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
