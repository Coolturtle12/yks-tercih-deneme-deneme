import { calculateScore, type Answers, type ExamType } from "../../lib/yks";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const exam: ExamType = body.exam === "AYT" ? "AYT" : "TYT";
    const answers = (body.answers || {}) as Answers;
    return Response.json({ ok: true, data: calculateScore(answers, exam) });
  } catch {
    return Response.json({ ok: false, error: "Sonuçlar işlenemedi." }, { status: 400 });
  }
}
