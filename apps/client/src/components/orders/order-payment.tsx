"use client";

import { useFakePayment } from "@/app/orders/[uuid]/use-fake-payment";
import { CreditCard, Lock, ShieldCheck } from "lucide-react";
import { Controller } from "react-hook-form";
import { Input } from "ui";
import { formatCardExpiry, formatCardNumber } from "utils";

type OrderPaymentProps = {
  orderUuid: string;
  total: string;
};

export const OrderPayment = ({ orderUuid, total }: OrderPaymentProps) => {
  const {
    form: {
      register,
      control,
      formState: { errors },
    },
    state,
    isPending,
    onSubmit,
  } = useFakePayment(orderUuid);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="font-grotesk flex items-center gap-2 text-sm text-secondary">
        <ShieldCheck size={16} className="text-primary" />
        Your payment is held by SOT and only released to the installer once your
        system is verified and handed over.
      </p>

      <Input
        label="Name on card"
        placeholder="Jane Doe"
        autoComplete="cc-name"
        error={errors.cardName?.message}
        {...register("cardName")}
      />

      <Controller
        control={control}
        name="cardNumber"
        render={({ field }) => (
          <Input
            label="Card number"
            placeholder="4242 4242 4242 4242"
            inputMode="numeric"
            autoComplete="cc-number"
            icon={<CreditCard size={16} />}
            value={field.value}
            onChange={(event) =>
              field.onChange(formatCardNumber(event.target.value))
            }
            error={errors.cardNumber?.message}
          />
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={control}
          name="expiry"
          render={({ field }) => (
            <Input
              label="Expiry"
              placeholder="MM/YY"
              inputMode="numeric"
              autoComplete="cc-exp"
              value={field.value}
              onChange={(event) =>
                field.onChange(formatCardExpiry(event.target.value))
              }
              error={errors.expiry?.message}
            />
          )}
        />
        <Input
          label="CVC"
          placeholder="123"
          inputMode="numeric"
          autoComplete="cc-csc"
          maxLength={4}
          error={errors.cvc?.message}
          {...register("cvc")}
        />
      </div>

      {state.error && <p className="text-sm text-red-500">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
      >
        <Lock size={16} />
        {isPending ? "Processing…" : `Pay ${total}`}
      </button>

      <p className="text-xs text-faint">
        Demo checkout — no real card is charged. Enter any test card details. A
        licensed payment gateway is wired here at launch.
      </p>
    </form>
  );
};
