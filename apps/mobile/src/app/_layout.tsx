import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

const RootLayout = () => (
  <>
    <StatusBar style="light" />
    <Stack screenOptions={{ headerShown: false }} />
  </>
);

export default RootLayout;
