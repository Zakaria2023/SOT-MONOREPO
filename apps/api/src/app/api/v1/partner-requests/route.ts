import { readBody } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { createPartnerRequest, toErrorResponse } from "services";
import { partnerRequestSchema } from "validators";

export const POST = async (request: Request) => {
  const parsed = partnerRequestSchema.safeParse(await readBody(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form and try again." },
      { status: 400 },
    );
  }

  try {
    const created = await createPartnerRequest(parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const { status, message } = toErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
};
