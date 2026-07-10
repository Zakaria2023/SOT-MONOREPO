import { getUserFromRequest, unauthorized } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getBoq } from "services";

type Params = {
  params: Promise<{ uuid: string }>;
};

export const GET = async (request: Request, { params }: Params) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  const { uuid } = await params;
  const detail = await getBoq(uuid);
  // Only the BOQ's owner may read it — otherwise treat it as not found.
  if (!detail || detail.boq.userUuid !== user.uuid) {
    return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
};
