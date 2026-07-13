"use client";

import { useSyncExternalStore } from "react";
import type { GuestCartItem } from "services";

export type { GuestCartItem };

const STORAGE_KEY = "guest-cart";
const CHANGE_EVENT = "guest-cart-change";
const EMPTY: GuestCartItem[] = [];

const isGuestCartItem = (value: unknown): value is GuestCartItem =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as GuestCartItem).productUuid === "string" &&
  typeof (value as GuestCartItem).quantity === "number";

const parse = (raw: string | null): GuestCartItem[] => {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isGuestCartItem) : [];
  } catch {
    return [];
  }
};

// Fresh read for mutations.
const readItems = (): GuestCartItem[] =>
  typeof window === "undefined"
    ? []
    : parse(window.localStorage.getItem(STORAGE_KEY));

const writeItems = (items: GuestCartItem[]): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

export const addToGuestCart = (productUuid: string, quantity = 1): void => {
  const items = readItems();
  const existing = items.find((item) => item.productUuid === productUuid);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ productUuid, quantity });
  }
  writeItems(items);
};

export const setGuestCartQuantity = (
  productUuid: string,
  quantity: number,
): void => {
  if (quantity < 1) {
    return;
  }
  writeItems(
    readItems().map((item) =>
      item.productUuid === productUuid ? { ...item, quantity } : item,
    ),
  );
};

export const removeFromGuestCart = (productUuid: string): void => {
  writeItems(readItems().filter((item) => item.productUuid !== productUuid));
};

export const clearGuestCart = (): void => writeItems([]);

/** One-off read of the guest cart (outside React), e.g. for the login merge. */
export const readGuestCartOnce = (): GuestCartItem[] => readItems();

// Cached snapshot so useSyncExternalStore gets a stable reference between
// changes (a fresh array each call would loop forever).
let cachedRaw: string | null = null;
let cachedItems: GuestCartItem[] = EMPTY;

const getSnapshot = (): GuestCartItem[] => {
  if (typeof window === "undefined") {
    return EMPTY;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedItems = parse(raw);
  }
  return cachedItems;
};

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

/** Reactive guest cart items — updates across components on any change. */
export const useGuestCart = (): GuestCartItem[] =>
  useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

export const guestCartCount = (items: GuestCartItem[]): number =>
  items.reduce((total, item) => total + item.quantity, 0);
