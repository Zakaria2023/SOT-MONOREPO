import { createDocumentDownloadUrl } from "storage";

export const GET = async (
  req: Request,
  context: { params: Promise<{ documentId: string }> },
) => {
  try {
    const { documentId } = await context.params;
    const fileName = new URL(req.url).searchParams.get("fileName") ?? undefined;

    const downloadUrl = await createDocumentDownloadUrl({ documentId, fileName });

    return Response.redirect(downloadUrl);
  } catch (error) {
    console.error("Failed to create document download URL:", error);
    return Response.json(
      { error: "Failed to download document" },
      { status: 500 },
    );
  }
};
