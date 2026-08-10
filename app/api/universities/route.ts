import { recommendations } from "../../lib/yks";

export async function GET() {
  return Response.json({ ok: true, data: recommendations, updatedAt: "2026-08-10" });
}
