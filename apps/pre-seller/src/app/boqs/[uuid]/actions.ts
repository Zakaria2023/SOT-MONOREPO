"use server";

import { requirePreSeller } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { removeBoqItem, updateBoqItemQuantity } from "services";

export const updateItemQuantity = async (
  boqUuid: string,
  boqItemUuid: string,
  quantity: number,
): Promise<void> => {
  const user = await requirePreSeller();
  await updateBoqItemQuantity({ preSellerId: user.id, boqItemUuid, quantity });
  revalidatePath(`/boqs/${boqUuid}`);
};

export const removeItem = async (
  boqUuid: string,
  boqItemUuid: string,
): Promise<void> => {
  const user = await requirePreSeller();
  await removeBoqItem({ preSellerId: user.id, boqItemUuid });
  revalidatePath(`/boqs/${boqUuid}`);
};
