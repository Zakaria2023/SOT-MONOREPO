import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/lib/theme";

const CartScreen = () => (
  <View style={styles.container}>
    <Text style={styles.text}>Cart — coming next.</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  text: {
    color: colors.muted,
    fontSize: 15,
  },
});

export default CartScreen;
