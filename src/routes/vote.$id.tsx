import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Heart, X } from "lucide-react";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getVote, submitVote } from "@/lib/votes.functions";
import { getAnonKey, getAnonName } from "@/lib/anon";


export const Route = createFileRoute("/vote/$id")({
  head: () => ({ meta: [{ title: "Pickly — 투표하기" }] }),
  component: VotePage,
});

type Choice = { photoId: string; liked: boolean };

function VotePage() {
  const { id } = Route.useParams();
  const fetchVote = useServerFn(getVote);
  const submit = useServerFn(submitVote);

  const q = useQuery({ queryKey: ["vote", id], queryFn: () => fetchVote({ data: { id } }) });
  const [idx, setIdx] = useState(0);
  const [history, setHistory] = useState<Choice[]>([]);
  const [done, setDone] = useState(false);
  const [drag, setDrag] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // Guards against a single card being recorded twice (swipe release + button/click
  // firing back-to-back before React commits the next index) and against double submits.
  const lastHandledPhoto = useRef<string | null>(null);
  const submittedRef = useRef(false);

  if (q.isLoading)
    return <main className="mx-auto max-w-md px-5 pt-10 text-center text-muted-foreground">불러오는 중...</main>;
  if (!q.data)
    return <main className="mx-auto max-w-md px-5 pt-10 text-center">투표를 찾을 수 없어요.</main>;

  const { vote, photos } = q.data;
  const total = photos.length;
  const current = photos[idx];

  const advance = async (liked: boolean) => {
    if (!current || submitting) return;
    if (lastHandledPhoto.current === current.id) return;
    lastHandledPhoto.current = current.id;

    const next = [...history.filter((h) => h.photoId !== current.id), { photoId: current.id, liked }];
    setHistory(next);
    setDrag(0);
    if (idx + 1 >= total) {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        const anonKey = getAnonKey();
        if (!anonKey) throw new Error("브라우저 저장소를 사용할 수 없어요.");
        await submit({
          data: { voteId: id, anonKey, displayName: getAnonName(), choices: next },
        });
        setDone(true);
      } catch (e) {
        console.error(e);
        submittedRef.current = false;
        lastHandledPhoto.current = null;
        toast.error(e instanceof Error ? e.message : "제출 실패");
      } finally {
        setSubmitting(false);
      }
    } else {
      setIdx(idx + 1);
    }
  };

  const undo = () => {
    if (history.length === 0 || submitting) return;
    setHistory(history.slice(0, -1));
    setIdx(Math.max(0, idx - 1));
    lastHandledPhoto.current = null;
    setDone(false);
  };


  return (
    <main className="mx-auto max-w-md min-h-[calc(100vh-4rem)] px-5 pt-4 pb-8 flex flex-col">
      <div className="flex items-center gap-3">
        <Link to="/home" className="size-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground truncate">{vote.title}</span>
            <span className="text-xs font-semibold">{Math.min(idx + 1, total)} / {total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-brand transition-all duration-300"
              style={{ width: `${((done ? total : idx) / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center py-6 relative">
        {!done && current && (
          <SwipeCard
            key={current.id}
            url={current.url}
            drag={drag}
            onDrag={setDrag}
            onLike={() => advance(true)}
            onSkip={() => advance(false)}
          />
        )}
        {done && (
          <DoneCard voteId={id} submitting={submitting} />
        )}
      </div>

      {!done && (
        <>
          <div className="flex items-center justify-center gap-5">
            <ActionButton variant="skip" onClick={() => advance(false)} disabled={submitting} />
            <button
              onClick={undo}
              disabled={history.length === 0 || submitting}
              className="text-xs text-muted-foreground disabled:opacity-40 px-3 py-2"
            >
              ↶ 되돌리기
            </button>
            <ActionButton variant="like" onClick={() => advance(true)} disabled={submitting} />
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">← 별로 · 좋음 →</p>
        </>
      )}
    </main>
  );
}

function SwipeCard({
  url, drag, onDrag, onLike, onSkip,
}: { url: string; drag: number; onDrag: (v: number) => void; onLike: () => void; onSkip: () => void }) {
  const onPointerDown = (e: React.PointerEvent) => {
    const startX = e.clientX;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      onDrag(Math.max(-1, Math.min(1, dx / 160)));
    };
    const up = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      el.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (dx > 110) onLike();
      else if (dx < -110) onSkip();
      else onDrag(0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const rot = drag * 12;
  const tx = drag * 80;
  return (
    <div
      onPointerDown={onPointerDown}
      className="relative w-full max-w-[340px] aspect-[3/4] rounded-[24px] overflow-hidden surface-card cursor-grab active:cursor-grabbing select-none touch-none transition-transform"
      style={{
        transform: `translateX(${tx}px) rotate(${rot}deg)`,
        transition: drag === 0 ? "transform 0.3s ease" : "none",
      }}
    >
      <img src={url} alt="투표 사진" className="absolute inset-0 size-full object-cover pointer-events-none" draggable={false} />
      <div className="absolute top-6 right-6 px-3 py-1.5 rounded-lg border-2 border-primary text-primary font-extrabold tracking-wider rotate-12 transition-opacity" style={{ opacity: Math.max(0, drag) }}>
        LIKE
      </div>
      <div className="absolute top-6 left-6 px-3 py-1.5 rounded-lg border-2 border-destructive text-destructive font-extrabold tracking-wider -rotate-12 transition-opacity" style={{ opacity: Math.max(0, -drag) }}>
        SKIP
      </div>
    </div>
  );
}

function ActionButton({ variant, onClick, disabled }: { variant: "like" | "skip"; onClick: () => void; disabled?: boolean }) {
  const isLike = variant === "like";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`size-16 rounded-full flex items-center justify-center transition-transform active:scale-90 disabled:opacity-50 ${
        isLike ? "bg-gradient-brand glow-primary text-background" : "bg-muted text-muted-foreground border border-border"
      }`}
      aria-label={isLike ? "좋음" : "별로"}
    >
      {isLike ? <Heart className="size-7 fill-current" /> : <X className="size-7" strokeWidth={2.5} />}
    </button>
  );
}

function DoneCard({ voteId, submitting }: { voteId: string; submitting: boolean }) {
  return (
    <div className="surface-card p-8 text-center w-full max-w-[340px]">
      <div className="text-5xl">{submitting ? "⏳" : "🎉"}</div>
      <h2 className="mt-3 text-xl font-bold">{submitting ? "제출 중..." : "투표 완료!"}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {submitting ? "잠시만 기다려주세요." : "친구의 베스트컷 선정에 도움을 주셨어요."}
      </p>
      {!submitting && (
        <Link
          to="/result/$id"
          params={{ id: voteId }}
          className="mt-6 inline-block w-full rounded-[14px] bg-gradient-brand py-3.5 font-semibold text-background"
        >
          결과 보기
        </Link>
      )}
    </div>
  );
}
