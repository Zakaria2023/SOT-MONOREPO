import { useAuth } from "@clerk/clerk-expo";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { CartRow } from "@/components/cart/cart-row";
import { DesignCheck } from "@/components/cart/design-check";
import { ProjectQuestions } from "@/components/cart/project-questions";
import { Button } from "@/components/ui/button";
import { ListState } from "@/components/ui/list-state";
import {
  ApiError,
  createBoq,
  createOrder,
  fetchCart,
  fetchDesignCheck,
  removeCartItem,
  updateCartItem,
} from "@/lib/api";
import { formatMoney, summarizeCart } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";
import type {
  CartLineItem,
  DesignCheckResult,
  ProjectAnswers,
} from "@/lib/types";

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
  // Answers to the project questions the check asks for. They are sent back with
  // the next check AND with the checkout, because the gate runs again server-side
  // and has to judge the design the buyer was shown.
  const [answers, setAnswers] = useState<ProjectAnswers>({});
  const [placing, setPlacing] = useState(false);
  const signature = (data ?? [])
    .map((item) => `${item.productUuid}:${item.quantity}`)
    .join(",");
  const answerSignature = Object.entries(answers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([uuid, value]) => `${uuid}=${value}`)
    .join(",");

  // `data` and `answers` are read through refs so the effect can depend on their
  // signatures instead of their identity. Listing them directly would re-run the
  // check on every render that produced an equal-but-new array — which is the
  // shape that had the profile screen firing ~1950 requests at one endpoint.
  // Refs are not reactive, so exhaustive-deps is satisfied honestly rather than
  // silenced with a disable comment.
  const latest = useRef({ data, answers });
  latest.current = { data, answers };

  useEffect(() => {
    const { data: lines, answers: currentAnswers } = latest.current;
    if (!lines || lines.length === 0) {
      setDesign(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    fetchDesignCheck(
      lines.map((item) => ({
        productUuid: item.productUuid,
        quantity: item.quantity,
      })),
      currentAnswers,
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
    // Keyed on the lines and the answers, not the array identity, so a reload with
    // identical contents doesn't re-check but a new answer does.
  }, [signature, answerSignature]);

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

  // Checkout has two destinations, exactly as on the web: standalone PRODUCTS
  // become an order the buyer pays for, while a SOLUTION (a whole category added
  // at once) becomes a draft BOQ our team quotes. Sending one down the other's
  // path is what "Proceed to checkout" used to imply and never did — the button
  // called `reload`.
  const checkoutProducts = useCallback(async () => {
    setPlacing(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Please sign in.");
      }
      const order = await createOrder({ projectInputs: answers }, token);
      reload();
      // Straight to the order, which is where payment will be taken.
      router.push(`/orders?highlight=${order.uuid}`);
    } catch (failure) {
      // The server's own sentence, because a blocked design explains itself
      // ("87 W of cameras on a 38 W budget") far better than "order failed".
      Alert.alert(
        "Could not place the order",
        failure instanceof ApiError
          ? failure.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setPlacing(false);
    }
  }, [answers, getToken, reload]);

  const sendBoq = useCallback(
    async (categoryUuid: string, categoryName: string) => {
      setPlacing(true);
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Please sign in.");
        }
        const boq = await createBoq(
          { categoryUuid, projectInputs: answers },
          token,
        );
        reload();
        Alert.alert(
          "Sent for quoting",
          `${categoryName} is now ${boq.reference}. Our team prices it and the quote arrives under Offers.`,
          [{ text: "View offers", onPress: () => router.push("/offers") }],
        );
      } catch (failure) {
        Alert.alert(
          "Could not send the BOQ",
          failure instanceof ApiError
            ? failure.message
            : "Something went wrong. Please try again.",
        );
      } finally {
        setPlacing(false);
      }
    },
    [answers, getToken, reload],
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

  const products = data.filter((item) => item.kind === "product");
  // One entry per solution, keyed by the category it was added from — that
  // category is what the BOQ is built out of, so a cart holding two solutions
  // sends two BOQs rather than mixing the systems into one.
  const solutions = new Map<string, string>();
  for (const item of data) {
    if (item.kind === "solution" && item.categoryUuid) {
      solutions.set(item.categoryUuid, item.categoryName ?? "Solution");
    }
  }

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
            onRemove={() =>
              // A trash icon beside the quantity stepper is easy to hit by
              // mistake on a phone, and the line is gone with no undo.
              Alert.alert(
                "Remove from cart?",
                `"${item.name}" will be removed.`,
                [
                  { text: "Keep", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => mutate(item, "remove"),
                  },
                ],
              )
            }
          />
        )}
      />
      <View style={styles.footer}>
        <DesignCheck result={design} checking={checking} />
        {/* Under the findings, because a question only makes sense once the buyer
            has read what answering it would clear. */}
        <ProjectQuestions
          questions={design?.questions ?? []}
          answers={answers}
          onChange={setAnswers}
        />
        <View style={styles.summary}>
          <SummaryRow
            label="Subtotal"
            value={formatMoney(subtotal, currency)}
          />
          <SummaryRow label="VAT (15%)" value={formatMoney(vat, currency)} />
          <View style={styles.divider} />
          <SummaryRow
            label="Total"
            value={formatMoney(total, currency)}
            emphasis
          />
        </View>

        {blocked ? (
          <Text style={styles.gate}>
            Fix the {design?.blockers.length} problem
            {design?.blockers.length === 1 ? "" : "s"} above to continue.
          </Text>
        ) : null}

        {[...solutions.entries()].map(([categoryUuid, name]) => (
          <Button
            key={categoryUuid}
            label={`Send ${name} for a quote`}
            onPress={() => sendBoq(categoryUuid, name)}
            disabled={blocked}
            loading={placing}
          />
        ))}

        {products.length > 0 ? (
          <Button
            label="Checkout & pay"
            // Secondary when a solution is also in the cart: quoting the system is
            // the main path, and two identical primaries make the buyer choose
            // between two things that look equally intended.
            variant={solutions.size > 0 ? "outline" : "primary"}
            onPress={checkoutProducts}
            disabled={blocked}
            loading={placing}
          />
        ) : null}
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
  // Says why the button is dead. A disabled control with no sentence beside it
  // reads as a broken screen.
  gate: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 13,
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
