import { getUserFromRequest, unauthorized } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { getUserBoq } from "services";

type Params = {
  params: Promise<{ uuid: string }>;
};

export const GET = async (request: Request, { params }: Params) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  const { uuid } = await params;
  const detail = await getUserBoq(user.uuid, uuid);
  if (!detail) {
    return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
};
