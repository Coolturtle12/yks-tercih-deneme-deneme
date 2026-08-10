"use client";

import { useMemo, useState } from "react";
import {
  calculateScore,
  defaultAnswers,
  subjectDefinitions,
  type Answers,
  type ExamType,
  type UniversityRecommendation,
} from "./lib/yks";

const icons = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="m15.2 8.8-2.4 4.1-4.1 2.4 2.4-4.1 4.1-2.4Z" /></>,
  chart: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 3-4 3 2 5-7" /></>,
  bookmark: <path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.5L6 21V4.8Z" />,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.4" /><path d="m16 16 4.5 4.5" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
};

function Icon({ name, size = 18 }: { name: keyof typeof icons; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

const navItems = [
  { label: "Genel Bakış", icon: "grid" as const, active: true },
  { label: "Tercih Asistanı", icon: "compass" as const },
  { label: "Puan Hesapla", icon: "chart" as const },
  { label: "Kaydedilenler", icon: "bookmark" as const },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}

export default function Home() {
  const [exam, setExam] = useState<ExamType>("TYT");
  const [answers, setAnswers] = useState<Answers>(defaultAnswers);
  const [result, setResult] = useState(() => calculateScore(defaultAnswers, "TYT"));
  const [isCalculating, setIsCalculating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeNav, setActiveNav] = useState("Genel Bakış");
  const greeting = "İyi günler";

  const visibleSubjects = useMemo(() => subjectDefinitions.filter((subject) => subject.exam === exam), [exam]);
  const activeNet = useMemo(() => visibleSubjects.reduce((sum, subject) => {
    const answer = answers[subject.id] || { correct: 0, wrong: 0 };
    return sum + Math.max(0, answer.correct - answer.wrong / 4);
  }, 0), [answers, visibleSubjects]);

  function switchExam(nextExam: ExamType) {
    setExam(nextExam);
    setResult(calculateScore(answers, nextExam));
  }

  function updateAnswer(id: string, field: "correct" | "wrong", value: string, max: number) {
    const parsed = value === "" ? 0 : Number(value);
    const bounded = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
    setAnswers((current) => {
      const previous = current[id] || { correct: 0, wrong: 0, blank: max };
      const other = field === "correct" ? previous.wrong : previous.correct;
      const nextValue = Math.min(max - other, bounded);
      const correct = field === "correct" ? nextValue : previous.correct;
      const wrong = field === "wrong" ? nextValue : previous.wrong;
      return { ...current, [id]: { correct, wrong, blank: max - correct - wrong } };
    });
  }

  function handleNavClick(label: string) {
    setActiveNav(label);
    if (label === "Genel Bakış") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const target = label === "Puan Hesapla" ? "score-form" : "recommendations";
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (label === "Kaydedilenler") setSaved(true);
  }

  async function calculateFromApi() {
    setIsCalculating(true);
    try {
      const response = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam, answers }),
      });
      const payload = await response.json();
      if (payload.ok) setResult(payload.data);
    } finally {
      setIsCalculating(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">R</span><span>rota</span><small>YKS 2026</small></div>
        <div className="side-label">Çalışma alanı</div>
        <nav className="side-nav" aria-label="Ana menü">
          {navItems.map((item) => <button className={`nav-item ${activeNav === item.label ? "active" : ""}`} key={item.label} onClick={() => handleNavClick(item.label)}><Icon name={item.icon} /><span>{item.label}</span>{activeNav === item.label && <i />}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="tip-card"><span className="tip-icon"><Icon name="info" size={16} /></span><div><strong>Küçük adımlar.</strong><p>Bugünkü netini gör, yarınını planla.</p></div></div>
          <div className="profile"><div className="avatar">K</div><div><strong>Kullanıcı</strong><span>12. sınıf</span></div><span className="profile-dots">•••</span></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Genel Bakış</span><b>/</b><strong>Son durum</strong></div>
          <div className="top-actions"><button className="search-button"><Icon name="search" size={17} /><span>Arama yap</span><kbd>⌘ K</kbd></button><button className="icon-button notification"><Icon name="bell" size={18} /><i /></button><div className="mini-avatar">K</div></div>
        </header>

        <div className="content-wrap">
          <section className="intro-row">
            <div><p className="eyebrow">PAZARTESİ, 10 AĞUSTOS 2026</p><h1>{greeting} <span>✦</span></h1><p className="intro-copy">Hedefine giden yolu bugün biraz daha netleştirelim.</p></div>
            <button className="outline-button" onClick={() => document.getElementById("score-form")?.scrollIntoView({ behavior: "smooth" })}><Icon name="plus" size={16} /> Yeni deneme ekle</button>
          </section>

          <section className="hero-grid">
            <div className="hero-card">
              <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
              <div className="hero-content"><div className="pill pill-light"><span /> Kişisel YKS panelin</div><h2>Tercihlerini<br /><em>veriyle</em> netleştir.</h2><p>Deneme sonuçlarını gir, gerçekçi puanını gör ve sana uygun bölümleri keşfet.</p><button className="light-button" onClick={() => document.getElementById("score-form")?.scrollIntoView({ behavior: "smooth" })}>Sonuçlarımı gir <Icon name="arrow" size={16} /></button></div>
              <div className="hero-note"><span className="note-line" /><div><strong>Bu hafta</strong><span>4 deneme işlendi</span></div></div>
            </div>
            <div className="trend-card"><div className="card-heading"><div><span className="section-kicker">SON 4 HAFTA</span><h3>Netlerindeki değişim</h3></div><button className="more-button">•••</button></div><div className="trend-value"><strong>+12,4</strong><span><Icon name="arrow" size={13} /> %8,6</span></div><div className="chart-area"><div className="chart-y"><span>90</span><span>60</span><span>30</span><span>0</span></div><div className="chart"><div className="grid-line line-1" /><div className="grid-line line-2" /><div className="grid-line line-3" /><svg viewBox="0 0 420 122" preserveAspectRatio="none"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8067ef" stopOpacity=".21" /><stop offset="1" stopColor="#8067ef" stopOpacity="0" /></linearGradient></defs><path d="M0 102 C35 96 42 88 72 91 S112 76 137 81 S176 60 201 67 S237 54 264 57 S300 43 325 45 S365 25 420 16 V122 H0Z" fill="url(#chartFill)" /><path d="M0 102 C35 96 42 88 72 91 S112 76 137 81 S176 60 201 67 S237 54 264 57 S300 43 325 45 S365 25 420 16" fill="none" stroke="#8067ef" strokeWidth="3" strokeLinecap="round" /></svg><div className="chart-labels"><span>12 May</span><span>19 May</span><span>26 May</span><span>2 Haz</span></div></div></div></div>
          </section>

          <section className="stats-row"><div className="stat-card"><span className="stat-icon blue"><Icon name="chart" size={18} /></span><div><span>Ortalama netin</span><strong>{formatNumber(activeNet)} <small>/ 120</small></strong></div><em className="positive">+4,2</em></div><div className="stat-card"><span className="stat-icon violet"><Icon name="compass" size={18} /></span><div><span>Tahmini puanın</span><strong>{formatNumber(result.score)}</strong></div><em className="positive">+8,6%</em></div><div className="stat-card"><span className="stat-icon gold"><Icon name="bookmark" size={18} /></span><div><span>Kaydedilen tercih</span><strong>12 <small>bölüm</small></strong></div><em className="neutral">Bu ay</em></div></section>

          <section className="section-heading"><div><p className="eyebrow">HIZLI HESAPLAMA</p><h2>Deneme sonuçların</h2></div><span className="last-updated"><span /> Son güncelleme: bugün, 19:42</span></section>
          <section className="workspace-grid" id="score-form">
            <div className="form-card"><div className="form-header"><div><h3>Netlerini hesapla</h3><p>Doğru ve yanlış sayılarını gir. Puanın anında güncellensin.</p></div><div className="exam-switcher"><button className={exam === "TYT" ? "selected" : ""} onClick={() => switchExam("TYT")}>TYT</button><button className={exam === "AYT" ? "selected" : ""} onClick={() => switchExam("AYT")}>AYT</button></div></div><div className="info-strip"><Icon name="info" size={15} /><span>Doğru + yanlış sayısı dersin soru sayısını aşamaz. Boşlar kalan sorulardan otomatik hesaplanır.</span></div><div className="subject-list">{visibleSubjects.map((subject) => { const answer = answers[subject.id] || { correct: 0, wrong: 0, blank: subject.maxQuestions }; const correct = Math.min(subject.maxQuestions, answer.correct); const wrong = Math.min(subject.maxQuestions - correct, answer.wrong); const blank = subject.maxQuestions - correct - wrong; const net = Math.max(0, correct - wrong / 4); const progress = Math.min(100, ((correct + wrong) / subject.maxQuestions) * 100); return <div className="subject-row" key={subject.id}><div className={`subject-badge ${subject.tint}`}>{subject.shortName}</div><div className="subject-main"><div className="subject-title"><strong>{subject.name}</strong><span>{subject.maxQuestions} soru</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div><div className="answer-inputs"><label><span>Doğru</span><input aria-label={`${subject.name} doğru`} type="number" min="0" max={subject.maxQuestions} value={correct} onChange={(event) => updateAnswer(subject.id, "correct", event.target.value, subject.maxQuestions)} /></label><label><span>Yanlış</span><input aria-label={`${subject.name} yanlış`} type="number" min="0" max={subject.maxQuestions} value={wrong} onChange={(event) => updateAnswer(subject.id, "wrong", event.target.value, subject.maxQuestions)} /></label><label><span>Boş</span><input className="blank-input" aria-label={`${subject.name} boş`} type="number" value={blank} readOnly /></label></div><div className="net-value"><span>Net</span><strong>{formatNumber(net)}</strong></div></div> })}</div><div className="form-footer"><span><Icon name="check" size={15} /> Verilerin kaydedildi</span><button className="calculate-button" onClick={calculateFromApi} disabled={isCalculating}>{isCalculating ? "Hesaplanıyor…" : "Puanımı hesapla"} <Icon name="arrow" size={16} /></button></div></div>

            <aside className="result-card"><div className="result-top"><div><span className="section-kicker light-kicker">TAHMİNİ {exam} PUANI</span><h3>Sonucun hazır.</h3></div><span className="result-status"><span /> İyi gidiyor</span></div><div className="score-display"><strong>{formatNumber(result.score)}</strong><span>/ 500</span></div><div className="score-bar"><span style={{ width: `${Math.min(100, ((result.score - 100) / 400) * 100)}%` }} /></div><div className="result-metrics"><div><span>Toplam net</span><strong>{formatNumber(result.totalNet)}</strong></div><div><span>Başarı yüzdesi</span><strong>%{result.successRate}</strong></div><div><span>Türkiye yüzdeliği</span><strong>%{formatNumber(result.percentile)}</strong></div></div><div className="result-divider" /><div className="result-foot"><span>Geçen denemeye göre</span><strong><Icon name="arrow" size={13} /> 8,6 puan</strong></div></aside>
          </section>

          <section className="section-heading recommendations-heading" id="recommendations"><div><p className="eyebrow">PUANINA EN YAKIN</p><h2>Gidebileceğin ilk 10 seçenek</h2></div><button className={`save-all ${saved ? "saved" : ""}`} onClick={() => setSaved(!saved)}><Icon name="bookmark" size={16} /> {saved ? "Kaydedildi" : "Tümünü kaydet"}</button></section>
          <section className="recommendation-grid">{result.recommendations.length > 0 ? result.recommendations.map((item: UniversityRecommendation) => <a className="university-card" key={item.id} href={item.website} target="_blank" rel="noopener noreferrer" aria-label={`${item.university} resmi sitesini aç`}><div className={`uni-logo ${item.accent}`}>{item.university.split(" ").map((word) => word[0]).slice(0, 2).join("")}</div><div className="uni-content"><div className="uni-meta"><span>{item.city}</span><span className={`status-dot ${item.status === "Güçlü ihtimal" ? "green" : "purple"}`} /> <span>{item.status}</span></div><h3>{item.university}</h3><p>{item.department}</p><div className="uni-score"><span>2025 taban puanı</span><strong>{formatNumber(item.lastScore)}</strong></div></div><span className="card-arrow" aria-hidden="true"><Icon name="chevron" size={17} /></span></a>) : <div className="empty-recommendations"><div className="empty-icon"><Icon name="compass" size={18} /></div><div><strong>Bu puan aralığında kayıtlı tercih yok.</strong><p>Netlerini güncellediğinde sana uygun ilk 10 seçeneği burada göstereceğiz.</p></div></div>}</section>
          <footer className="page-footer"><span>Rota · Daha bilinçli tercihler için.</span><span>Veriler 2025 yerleşim sonuçlarıyla güncellenmiştir <Icon name="info" size={14} /></span></footer>
        </div>
      </main>
    </div>
  );
}
