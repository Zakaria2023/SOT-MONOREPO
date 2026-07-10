import { getUserFromRequest, unauthorized } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getApprovedOffersForUser } from "services";

type Params = {
  params: Promise<{ uuid: string }>;
};

export const GET = async (request: Request, { params }: Params) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  const { uuid } = await params;
  return NextResponse.json(await getApprovedOffersForUser(user.uuid, uuid));
};
