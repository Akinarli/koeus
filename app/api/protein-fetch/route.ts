import { NextResponse } from "next/server";
import { efetchText } from "@/lib/ncbi";
import { parseGenpept, ParseError } from "@/lib/parseGenpept";
import { handleError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// efetch a single protein as raw GenPept (rettype=gp), then parse it into the
// structured ProteinRecord the frontend renders. ?raw=1 returns the flat file
// untouched (handy for debugging / validating the parser).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") ?? "").trim();
  const raw = searchParams.get("raw") === "1";

  if (!id) {
    return NextResponse.json({ error: "missing ?id=<protein id>" }, { status: 400 });
  }

  try {
    const text = await efetchText("protein", id, { rettype: "gp" });

    if (raw) {
      return new NextResponse(text, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const record = await parseGenpept(text);
    return NextResponse.json(record);
  } catch (err) {
    if (err instanceof ParseError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return handleError(err);
  }
}
