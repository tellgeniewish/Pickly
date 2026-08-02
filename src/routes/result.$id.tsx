import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Loader2, Share2, Sparkles } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getVoteResults, runAiAnalysis } from "@/lib/votes.functions";

export const Route = createFileRoute("/result/$id")({
  head: () => ({ meta: [{ title: "Pickly — 결과 보기" }] }),
  component: Result,
});

const rankBadges = ["🥇", "🥈", "🥉"];

function Result() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchResults = useServerFn(getVoteResults);
  const runAi = useServerFn(runAiAnalysis);
  const autoRan = useRef(false);

  const q = useQuery({
    queryKey: ["results", id],
    queryFn: () => fetchResults({ data: { id } }),
  });

  const ai = useMutation({
    mutationFn: (force?: boolean) => runAi({ data: { id, force: force ?? false } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["results", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "분석 실패"),
  });

  // Auto-run once: the result is cached in the DB, so any later viewer just reads it.
  const needsAnalysis = !!q.data && !q.data.ai && q.data.participantCount > 0;
  const aiMutate = ai.mutate;
  useEffect(() => {
    if (needsAnalysis && !autoRan.current) {
      autoRan.current = true;
      aiMutate(false);
    }
  }, [needsAnalysis, aiMutate]);

  if (q.isLoading)
    return <main className="mx-auto max-w-md px-5 pt-10 text-center text-muted-foreground">불러오는 중...</main>;
  if (!q.data) return <main className="mx-auto max-w-md px-5 pt-10 text-center">투표를 찾을 수 없어요.</main>;

  const { vote, participantCount, ranked, ai: aiData } = q.data;


  const share = async () => {
    const url = `${window.location.origin}/vote/${id}`;
    if (navigator.share) navigator.share({ title: vote.title, url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(url);
      toast.success("링크가 복사됐어요!");
    }
  };

  return (
    <main className="mx-auto max-w-md px-5 pt-4 pb-32 space-y-7">
      <header>
        <h1 className="text-2xl font-bold leading-tight">{vote.title}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          {vote.location_name && (
            <>
              <span>📍 {vote.location_name}</span>
              <span>·</span>
            </>
          )}
          <span>
            총 <span className="text-foreground font-semibold">{participantCount}명</span> 참여
          </span>
        </div>
      </header>

      <section className="relative surface-card p-5 overflow-hidden">
        <div className="absolute -top-16 -right-16 size-48 rounded-full bg-secondary/20 blur-3xl pointer-events-none" />
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-gradient-brand flex items-center justify-center">
            <Sparkles className="size-4 text-background" />
          </div>
          <h2 className="font-semibold">AI 분석</h2>
          <span className="ml-auto text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
            Gemini Vision
          </span>
        </div>

        {aiData ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">{aiData.summary}</p>
            {Array.isArray(aiData.space_keywords) && aiData.space_keywords.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(aiData.space_keywords as string[]).map((k) => (
                  <span
                    key={k}
                    className="text-xs font-medium bg-gradient-brand-soft border border-primary/30 text-primary px-2.5 py-1 rounded-full"
                  >
                    #{k}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={() => ai.mutate(true)}
              disabled={ai.isPending}
              className="mt-4 w-full rounded-[14px] border border-primary/40 bg-gradient-brand-soft py-2.5 text-sm font-semibold text-primary flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {ai.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> 재분석 중...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> AI 재분석
                </>
              )}
            </button>
          </>
        ) : ai.isPending || needsAnalysis ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            AI가 베스트컷을 분석하고 있어요...
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              {participantCount === 0
                ? "아직 표가 없어요. 친구들에게 링크를 보내면 AI 분석이 자동으로 실행돼요."
                : "분석을 불러오지 못했어요. 다시 시도해 주세요."}
            </p>
            {participantCount > 0 && (
              <button
                onClick={() => ai.mutate(true)}
                disabled={ai.isPending}
                className="w-full rounded-[14px] bg-gradient-brand py-3 font-semibold text-background text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Sparkles className="size-4" /> 다시 분석하기
              </button>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">베스트컷 랭킹</h2>
        {ranked.map((p, i) => (
          <RankCard
            key={p.id}
            rank={i + 1}
            url={p.url}
            rate={p.rate}
            likes={p.likes}
            total={p.total}
            analysis={aiData && Array.isArray(aiData.top_analysis) ? (aiData.top_analysis as Array<Record<string, string | number>>)[i] : undefined}
          />
        ))}
        {ranked.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">사진이 없어요.</p>
        )}
      </section>

      <button
        onClick={share}
        className="w-full rounded-[14px] border border-border bg-muted/40 py-3.5 font-medium text-sm flex items-center justify-center gap-2"
      >
        <Share2 className="size-4" /> 링크 다시 공유
      </button>

      <Link to="/home" className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
        홈으로
      </Link>
    </main>
  );
}

function RankCard({
  rank, url, rate, likes, total, analysis,
}: {
  rank: number;
  url: string;
  rate: number;
  likes: number;
  total: number;
  analysis?: Record<string, string | number>;
}) {
  const pct = Math.round(rate * 100);
  return (
    <div className={`surface-card overflow-hidden ${rank === 1 ? "ring-2 ring-primary/50 glow-primary" : ""}`}>
      <div className="flex gap-3 p-3">
        <div className="relative shrink-0 w-24 aspect-[3/4] rounded-xl overflow-hidden">
          <img src={url} alt={`${rank}위 사진`} className="absolute inset-0 size-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">{rank <= 3 ? rankBadges[rank - 1] : ""}</span>
            <span className="font-bold">{rank}위</span>
            <span className="ml-auto text-lg font-bold text-gradient">{pct}%</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-gradient-brand" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {likes} / {total} 좋음
          </p>
          {analysis && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
              {["구도", "표정", "조명"].map((k) =>
                analysis[k] ? (
                  <li key={k}>
                    <span className="text-foreground/70">{k}</span> · {String(analysis[k])}
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
