import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Sparkles } from "lucide-react";
import { sampleVote, aiInsight } from "@/lib/mock-data";

export const Route = createFileRoute("/result/$id")({
  head: () => ({ meta: [{ title: "Pickly — 결과 보기" }] }),
  component: Result,
});

const rankBadges = ["🥇", "🥈", "🥉"];

function Result() {
  const sorted = [...sampleVote.photos].sort((a, b) => b.recommend - a.recommend);

  return (
    <main className="mx-auto max-w-md px-5 pt-4 pb-32 space-y-7">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold leading-tight">{sampleVote.title}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{sampleVote.location}</span>
          <span>·</span>
          <span>
            총 <span className="text-foreground font-semibold">{sampleVote.participants}명</span>의
            친구가 참여
          </span>
        </div>
      </header>

      {/* AI Insight */}
      <section className="relative surface-card p-5 overflow-hidden">
        <div className="absolute -top-16 -right-16 size-48 rounded-full bg-secondary/20 blur-3xl pointer-events-none" />
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-gradient-brand flex items-center justify-center">
            <Sparkles className="size-4 text-background" />
          </div>
          <h2 className="font-semibold">AI 분석</h2>
          <span className="ml-auto text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
            GPT-4o Vision
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-foreground/90">{aiInsight.summary}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {aiInsight.spaceKeywords.map((k) => (
            <span
              key={k}
              className="text-xs font-medium bg-gradient-brand-soft border border-primary/30 text-primary px-2.5 py-1 rounded-full"
            >
              #{k}
            </span>
          ))}
        </div>
      </section>

      {/* Ranking */}
      <section className="space-y-3">
        <h2 className="font-semibold">베스트컷 랭킹</h2>
        {sorted.map((p, i) => (
          <RankCard
            key={p.id}
            rank={i + 1}
            url={p.url}
            recommend={p.recommend}
            analysis={aiInsight.topAnalysis[i]}
          />
        ))}
      </section>

      {/* Save */}
      <button className="w-full rounded-[14px] border border-border bg-muted/40 py-3.5 font-medium text-sm flex items-center justify-center gap-2">
        <Download className="size-4" /> 결과 이미지 저장
      </button>

      <Link
        to="/home"
        className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        홈으로
      </Link>
    </main>
  );
}

function RankCard({
  rank,
  url,
  recommend,
  analysis,
}: {
  rank: number;
  url: string;
  recommend: number;
  analysis?: (typeof aiInsight.topAnalysis)[number];
}) {
  const isTop = rank <= 3;
  return (
    <div
      className={`surface-card overflow-hidden ${
        rank === 1 ? "ring-2 ring-primary/50 glow-primary" : ""
      }`}
    >
      <div className="flex gap-3 p-3">
        <div className="relative shrink-0 w-24 aspect-[3/4] rounded-xl overflow-hidden">
          <img
            src={url}
            alt={`${rank}위 사진`}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">{isTop ? rankBadges[rank - 1] : ""}</span>
            <span className="font-bold">{rank}위</span>
            <span className="ml-auto text-lg font-bold text-gradient">{recommend}%</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-brand"
              style={{ width: `${recommend}%` }}
            />
          </div>
          {analysis && (
            <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
              <li>
                <span className="text-foreground/70">구도</span> · {analysis.구도}
              </li>
              <li>
                <span className="text-foreground/70">표정</span> · {analysis.표정}
              </li>
              <li>
                <span className="text-foreground/70">조명</span> · {analysis.조명}
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
