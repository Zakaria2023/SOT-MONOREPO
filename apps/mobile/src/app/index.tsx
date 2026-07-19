import { StyleSheet, Text, View } from "react-native";

const HomeScreen = () => (
  <View style={styles.container}>
    <Text style={styles.title}>SOT Mobile</Text>
    <Text style={styles.subtitle}>React Native client — powered by Expo</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b0b0f",
    padding: 24,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "600",
  },
  subtitle: {
    color: "#9ca3af",
    fontSize: 15,
    marginTop: 8,
  },
});

export default HomeScreen;
