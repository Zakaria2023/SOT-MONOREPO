import { CheckCircle2 } from "lucide-react-native";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { createPartnerRequest } from "@/lib/api";
import { colors, radius, spacing } from "@/lib/theme";
import type { PartnerCapability } from "@/lib/types";

type CapabilityOption = {
  value: PartnerCapability;
  label: string;
};

const CAPABILITY_OPTIONS: CapabilityOption[] = [
  { value: "system_integrator", label: "System Integrator" },
  { value: "stock", label: "Have stock" },
  { value: "install_program", label: "Install & program the network" },
  { value: "install_only", label: "Install the network only" },
  { value: "pre_sell", label: "Pre-sell partner" },
  { value: "post_sell", label: "Post-sell partner" },
];

const PartnerScreen = () => {
  const [capabilities, setCapabilities] = useState<PartnerCapability[]>([]);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [location, setLocation] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const toggleCapability = (value: PartnerCapability) => {
    setCapabilities((prev) =>
      prev.includes(value)
        ? prev.filter((c) => c !== value)
        : [...prev, value],
    );
  };

  const submit = async () => {
    setError(null);
    if (capabilities.length === 0) {
      setError("Select at least one capability.");
      return;
    }
    if (!email || !firstName || !lastName || !location) {
      setError("Please fill in your name, email and location.");
      return;
    }
    setPending(true);
    try {
      await createPartnerRequest({
        capabilities,
        type: "individual",
        email,
        firstName,
        lastName,
        location,
        ...(contactNumber ? { contactNumber } : {}),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit request.");
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <View style={styles.doneContainer}>
        <CheckCircle2 color={colors.primary} size={48} />
        <Text style={styles.doneTitle}>Request submitted</Text>
        <Text style={styles.doneText}>
          Thanks — our team will review your application and be in touch by
          email.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.lead}>
        Apply to become an SOT partner. Choose what you can offer and tell us how
        to reach you.
      </Text>

      <Text style={styles.label}>Capabilities</Text>
      <View style={styles.chips}>
        {CAPABILITY_OPTIONS.map((option) => {
          const active = capabilities.includes(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={() => toggleCapability(option.value)}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text
                style={[
                  styles.chipText,
                  active ? styles.chipTextActive : null,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>First name</Text>
      <TextField
        value={firstName}
        onChangeText={setFirstName}
        placeholder="First name"
        autoCapitalize="words"
      />

      <Text style={styles.label}>Last name</Text>
      <TextField
        value={lastName}
        onChangeText={setLastName}
        placeholder="Last name"
        autoCapitalize="words"
      />

      <Text style={styles.label}>Email</Text>
      <TextField
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
      />

      <Text style={styles.label}>Location</Text>
      <TextField
        value={location}
        onChangeText={setLocation}
        placeholder="City, country"
        autoCapitalize="words"
      />

      <Text style={styles.label}>Contact number (optional)</Text>
      <TextField
        value={contactNumber}
        onChangeText={setContactNumber}
        placeholder="+966…"
        keyboardType="phone-pad"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.submit}>
        <Button label="Submit application" onPress={submit} loading={pending} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  lead: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
    marginTop: spacing.md,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  chipText: {
    color: colors.muted,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.text,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginTop: spacing.md,
  },
  submit: {
    marginTop: spacing.lg,
  },
  doneContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
  },
  doneTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "600",
  },
  doneText: {
    color: colors.muted,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});

export default PartnerScreen;
