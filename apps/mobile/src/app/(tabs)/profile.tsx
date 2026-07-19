import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/lib/theme";

const ProfileScreen = () => (
  <View style={styles.container}>
    <Text style={styles.text}>Profile — coming next.</Text>
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

export default ProfileScreen;
