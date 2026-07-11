import {
  getStringField,
  getUserFromRequest,
  readBody,
  unauthorized,
} from "@/lib/helpers";
import { NextResponse } from "next/server";
import { selectOffer, toErrorResponse } from "services";

type Params = {
  params: Promise<{ uuid: string }>;
};

export const POST = async (request: Request, { params }: Params) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  const offerUuid = getStringField(await readBody(request), "offerUuid");
  if (!offerUuid) {
    return NextResponse.json({ error: "offerUuid is required" }, { status: 400 });
  }

  const { uuid } = await params;
  try {
    await selectOffer({ userUuid: user.uuid, boqUuid: uuid, offerUuid });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { status, message } = toErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
};
