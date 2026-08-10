export type ExamType = "TYT" | "AYT";

export type SubjectDefinition = {
  id: string;
  exam: ExamType;
  name: string;
  shortName: string;
  maxQuestions: number;
  weight: number;
  tint: "blue" | "violet" | "amber" | "mint";
};

export type SubjectAnswer = {
  correct: number;
  wrong: number;
  blank: number;
};

export type Answers = Record<string, SubjectAnswer>;

export const subjectDefinitions: SubjectDefinition[] = [
  { id: "tyt-turkce", exam: "TYT", name: "Türkçe", shortName: "TR", maxQuestions: 40, weight: 1.15, tint: "blue" },
  { id: "tyt-matematik", exam: "TYT", name: "Matematik", shortName: "MA", maxQuestions: 40, weight: 1.35, tint: "violet" },
  { id: "tyt-sosyal", exam: "TYT", name: "Sosyal Bilimler", shortName: "SB", maxQuestions: 20, weight: 0.8, tint: "amber" },
  { id: "tyt-fen", exam: "TYT", name: "Fen Bilimleri", shortName: "FB", maxQuestions: 20, weight: 0.9, tint: "mint" },
  { id: "ayt-matematik", exam: "AYT", name: "Matematik", shortName: "MA", maxQuestions: 40, weight: 1.45, tint: "violet" },
  { id: "ayt-fizik", exam: "AYT", name: "Fizik", shortName: "Fİ", maxQuestions: 14, weight: 0.85, tint: "blue" },
  { id: "ayt-kimya", exam: "AYT", name: "Kimya", shortName: "Kİ", maxQuestions: 13, weight: 0.75, tint: "amber" },
  { id: "ayt-biyoloji", exam: "AYT", name: "Biyoloji", shortName: "Bİ", maxQuestions: 13, weight: 0.75, tint: "mint" },
];

export const defaultAnswers: Answers = {
  "tyt-turkce": { correct: 32, wrong: 5, blank: 3 },
  "tyt-matematik": { correct: 24, wrong: 4, blank: 12 },
  "tyt-sosyal": { correct: 14, wrong: 3, blank: 3 },
  "tyt-fen": { correct: 13, wrong: 2, blank: 5 },
  "ayt-matematik": { correct: 28, wrong: 4, blank: 8 },
  "ayt-fizik": { correct: 9, wrong: 2, blank: 3 },
  "ayt-kimya": { correct: 10, wrong: 1, blank: 2 },
  "ayt-biyoloji": { correct: 9, wrong: 2, blank: 2 },
};

export type UniversityRecommendation = {
  id: string;
  university: string;
  department: string;
  city: string;
  lastScore: number;
  website: string;
  status: "Güçlü ihtimal" | "Sınırda" | "Geliştirilebilir";
  accent: "navy" | "purple" | "gold";
};

export const recommendations: UniversityRecommendation[] = [
  { id: "itu", university: "İstanbul Teknik Üniversitesi", department: "Endüstri Mühendisliği", city: "İstanbul", lastScore: 468.2, website: "https://itu.edu.tr/", status: "Güçlü ihtimal", accent: "navy" },
  { id: "yildiz", university: "Yıldız Teknik Üniversitesi", department: "Yazılım Mühendisliği", city: "İstanbul", lastScore: 432.1, website: "https://yildiz.edu.tr/", status: "Sınırda", accent: "purple" },
  { id: "iyte", university: "İzmir Yüksek Teknoloji Enstitüsü", department: "Bilgisayar Mühendisliği", city: "İzmir", lastScore: 410.4, website: "https://iyte.edu.tr/", status: "Geliştirilebilir", accent: "gold" },
  { id: "hacettepe", university: "Hacettepe Üniversitesi", department: "İşletme", city: "Ankara", lastScore: 397.8, website: "https://www.hacettepe.edu.tr/", status: "Sınırda", accent: "navy" },
  { id: "ankara", university: "Ankara Üniversitesi", department: "Yönetim Bilişim Sistemleri", city: "Ankara", lastScore: 385.6, website: "https://www.ankara.edu.tr/", status: "Sınırda", accent: "purple" },
  { id: "ege", university: "Ege Üniversitesi", department: "İktisat", city: "İzmir", lastScore: 374.3, website: "https://ege.edu.tr/", status: "Güçlü ihtimal", accent: "gold" },
  { id: "marmara", university: "Marmara Üniversitesi", department: "Uluslararası Ticaret", city: "İstanbul", lastScore: 361.7, website: "https://www.marmara.edu.tr/", status: "Güçlü ihtimal", accent: "navy" },
  { id: "dokuz-eylul", university: "Dokuz Eylül Üniversitesi", department: "Endüstri Mühendisliği", city: "İzmir", lastScore: 349.5, website: "https://www.deu.edu.tr/", status: "Güçlü ihtimal", accent: "purple" },
  { id: "gazi", university: "Gazi Üniversitesi", department: "Mimarlık", city: "Ankara", lastScore: 338.2, website: "https://gazi.edu.tr/", status: "Güçlü ihtimal", accent: "gold" },
  { id: "akdeniz", university: "Akdeniz Üniversitesi", department: "Turizm İşletmeciliği", city: "Antalya", lastScore: 326.9, website: "https://akdeniz.edu.tr/", status: "Güçlü ihtimal", accent: "navy" },
  { id: "uludag", university: "Bursa Uludağ Üniversitesi", department: "Psikoloji", city: "Bursa", lastScore: 318.4, website: "https://uludag.edu.tr/", status: "Güçlü ihtimal", accent: "purple" },
];

function clamp(value: unknown, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(max, Math.max(0, Math.round(number)));
}

export function normalizeAnswers(answers: Answers, exam: ExamType) {
  return subjectDefinitions
    .filter((subject) => subject.exam === exam)
    .reduce<Answers>((result, subject) => {
      const answer = answers[subject.id] || { correct: 0, wrong: 0, blank: 0 };
      const correct = clamp(answer.correct, subject.maxQuestions);
      const wrong = clamp(answer.wrong, subject.maxQuestions - correct);
      result[subject.id] = { correct, wrong, blank: subject.maxQuestions - correct - wrong };
      return result;
    }, {});
}

export function calculateScore(answers: Answers, exam: ExamType) {
  const subjects = subjectDefinitions.filter((subject) => subject.exam === exam);
  const normalized = normalizeAnswers(answers, exam);
  const totalPossible = subjects.reduce((sum, subject) => sum + subject.maxQuestions * subject.weight, 0);
  const weightedNet = subjects.reduce((sum, subject) => {
    const answer = normalized[subject.id];
    const net = Math.max(0, answer.correct - answer.wrong / 4);
    return sum + net * subject.weight;
  }, 0);
  const percentage = totalPossible ? weightedNet / totalPossible : 0;
  const score = Math.round((100 + percentage * 400) * 10) / 10;
  const totalNet = Math.round(subjects.reduce((sum, subject) => {
    const answer = normalized[subject.id];
    return sum + Math.max(0, answer.correct - answer.wrong / 4);
  }, 0) * 10) / 10;
  const totalCorrect = subjects.reduce((sum, subject) => sum + normalized[subject.id].correct, 0);
  const totalWrong = subjects.reduce((sum, subject) => sum + normalized[subject.id].wrong, 0);
  const successRate = Math.round((totalCorrect / Math.max(1, subjects.reduce((sum, subject) => sum + subject.maxQuestions, 0))) * 100);
  const percentile = Math.max(0.1, Math.round((100 - percentage * 96) * 10) / 10);
  const ranked = recommendations
    .filter((item) => item.lastScore <= score)
    .sort((a, b) => b.lastScore - a.lastScore)
    .slice(0, 10)
    .map((item) => ({
      ...item,
      status: score >= item.lastScore + 6 ? "Güçlü ihtimal" : score >= item.lastScore - 18 ? "Sınırda" : "Geliştirilebilir",
    })) as UniversityRecommendation[];

  return { exam, score, totalNet, totalCorrect, totalWrong, successRate, percentile, subjects: normalized, recommendations: ranked };
}
