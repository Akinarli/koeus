import { NextResponse } from "next/server";
import { NcbiError } from "@/lib/ncbi";

// Normalize any thrown error into a JSON response. Shared by the API routes.
export function handleError(err: unknown) {
  if (err instanceof NcbiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 500 });
}
