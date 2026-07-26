import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { CartRow } from "@/components/cart/cart-row";
import { DesignCheck } from "@/components/cart/design-check";
import { Button } from "@/components/ui/button";
import { ListState } from "@/components/ui/list-state";
import {
  fetchCart,
  fetchDesignCheck,
  removeCartItem,
  updateCartItem,
} from "@/lib/api";
import { formatMoney, summarizeCart } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";
import type { CartLineItem, DesignCheckResult } from "@/lib/types";

type SummaryRowProps = {
  label: string;
  value: string;
  emphasis?: boolean;
};

const SummaryRow = ({ label, value, emphasis }: SummaryRowProps) => (
  <View style={styles.summaryRow}>
    <Text style={[styles.summaryLabel, emphasis ? styles.summaryStrong : null]}>
      {label}
    </Text>
    <Text style={[styles.summaryValue, emphasis ? styles.totalValue : null]}>
      {value}
    </Text>
  </View>
);

const CartScreen = () => {
  const { getToken } = useAuth();
  const [busyUuid, setBusyUuid] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Please sign in to view your cart.");
    }
    return fetchCart(token);
  }, [getToken]);

  const { data, error, loading, reload } = useAsync(load);

  // The same check the web cart runs. Re-run whenever the lines change, so a
  // buyer sees the problem while they can still fix it rather than at checkout.
  const [design, setDesign] = useState<DesignCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const signature = (data ?? [])
    .map((item) => `${item.productUuid}:${item.quantity}`)
    .join(",");

  useEffect(() => {
    if (!data || data.length === 0) {
      setDesign(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    fetchDesignCheck(
      data.map((item) => ({
        productUuid: item.productUuid,
        quantity: item.quantity,
      })),
    )
      .then((result) => {
        if (!cancelled) {
          setDesign(result);
        }
      })
      // Advisory by nature — a failed check must never block the cart itself.
      .catch(() => {
        if (!cancelled) {
          setDesign(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setChecking(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // Keyed on the lines, not the array identity, so a reload with identical
    // contents doesn't re-check.
  }, [signature]);

  const mutate = useCallback(
    async (item: CartLineItem, action: "inc" | "dec" | "remove") => {
      setBusyUuid(item.uuid);
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Please sign in.");
        }
        if (action === "remove") {
          await removeCartItem(item.uuid, token);
        } else {
          const next = action === "inc" ? item.quantity + 1 : item.quantity - 1;
          await updateCartItem(item.uuid, next, token);
        }
        reload();
      } catch {
        setBusyUuid(null);
      }
    },
    [getToken, reload],
  );

  if (loading || error || !data || data.length === 0) {
    return (
      <View style={styles.container}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && (data?.length ?? 0) === 0}
          emptyLabel="Your cart is empty."
          onRetry={reload}
        />
      </View>
    );
  }

  const currency = data[0]?.currency ?? "SAR";
  // One helper does the whole sum in minor units — accumulating the subtotal
  // as a float here and handing it over would reintroduce the drift.
  const { subtotal, vat, total } = summarizeCart(data);
  // A blocking finding gates checkout, exactly as it does on the web.
  const blocked = (design?.blockers.length ?? 0) > 0;

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        data={data}
        keyExtractor={(item) => item.uuid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <CartRow
            item={item}
            busy={busyUuid === item.uuid}
            onIncrement={() => mutate(item, "inc")}
            onDecrement={() => mutate(item, "dec")}
            onRemove={() => mutate(item, "remove")}
          />
        )}
      />
      <View style={styles.footer}>
        <DesignCheck result={design} checking={checking} />
        <View style={styles.summary}>
          <SummaryRow label="Subtotal" value={formatMoney(subtotal, currency)} />
          <SummaryRow label="VAT (15%)" value={formatMoney(vat, currency)} />
          <View style={styles.divider} />
          <SummaryRow label="Total" value={formatMoney(total, currency)} emphasis />
        </View>
        <Button
          label={
            blocked ? "Fix the problems above to continue" : "Proceed to checkout"
          }
          onPress={reload}
          disabled={blocked}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.overlay,
    gap: spacing.lg,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
  },
  summary: {
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  summaryStrong: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  summaryValue: {
    color: colors.text,
    fontFamily: fonts.monoBold,
    fontSize: 15,
  },
  totalValue: {
    fontSize: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
});

export default CartScreen;
