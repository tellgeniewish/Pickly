import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Heart, X } from "lucide-react";
import { useState } from "react";
import { sampleVote } from "@/lib/mock-data";

export const Route = createFileRoute("/vote/$id")({
  head: () => ({ meta: [{ title: "Pickly — 투표하기" }] }),
  component: VotePage,
});

type Choice = "like" | "skip";

function VotePage() {
  const photos = sampleVote.photos;
  const [idx, setIdx] = useState(0);
  const [history, setHistory] = useState<Choice[]>([]);
  const [done, setDone] = useState(false);
  const [drag, setDrag] = useState(0); // -1..1

  const total = photos.length;
  const current = photos[idx];

  const advance = (choice: Choice) => {
    const next = [...history, choice];
    setHistory(next);
    setDrag(0);
    if (idx + 1 >= total) {
      setDone(true);
    } else {
      setIdx(idx + 1);
    }
  };

  const undo = () => {
    if (history.length === 0) return;
    setHistory(history.slice(0, -1));
    setIdx(Math.max(0, idx - 1));
    setDone(false);
  };

  return (
    <main className="mx-auto max-w-md min-h-[calc(100vh-4rem)] px-5 pt-4 pb-8 flex flex-col">
      {/* Top: progress */}
      <div className="flex items-center gap-3">
        <Link
          to="/home"
          className="size-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">{sampleVote.title}</span>
            <span className="text-xs font-semibold">
              {Math.min(idx + (done ? 1 : 1), total)} / {total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-brand transition-all duration-300"
              style={{
                width: `${((done ? total : idx) / total) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center py-6 relative">
        {!done && current && (
          <SwipeCard
            key={current.id}
            url={current.url}
            drag={drag}
            onDrag={setDrag}
            onLike={() => advance("like")}
            onSkip={() => advance("skip")}
          />
        )}
        {done && <DoneCard total={total} />}
      </div>

      {/* Actions */}
      {!done && (
        <>
          <div className="flex items-center justify-center gap-5">
            <ActionButton variant="skip" onClick={() => advance("skip")} />
            <button
              onClick={undo}
              disabled={history.length === 0}
              className="text-xs text-muted-foreground disabled:opacity-40 px-3 py-2"
            >
              ↶ 되돌리기
            </button>
            <ActionButton variant="like" onClick={() => advance("like")} />
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            ← 별로 &nbsp;·&nbsp; 좋음 →
          </p>
        </>
      )}
    </main>
  );
}

function SwipeCard({
  url,
  drag,
  onDrag,
  onLike,
  onSkip,
}: {
  url: string;
  drag: number;
  onDrag: (v: number) => void;
  onLike: () => void;
  onSkip: () => void;
}) {
  // basic pointer drag
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
      <img
        src={url}
        alt="투표 사진"
        loading="eager"
        className="absolute inset-0 size-full object-cover pointer-events-none"
        draggable={false}
      />
      {/* like overlay */}
      <div
        className="absolute top-6 right-6 px-3 py-1.5 rounded-lg border-2 border-primary text-primary font-extrabold tracking-wider rotate-12 transition-opacity"
        style={{ opacity: Math.max(0, drag) }}
      >
        LIKE
      </div>
      <div
        className="absolute top-6 left-6 px-3 py-1.5 rounded-lg border-2 border-destructive text-destructive font-extrabold tracking-wider -rotate-12 transition-opacity"
        style={{ opacity: Math.max(0, -drag) }}
      >
        SKIP
      </div>
    </div>
  );
}

function ActionButton({ variant, onClick }: { variant: "like" | "skip"; onClick: () => void }) {
  const isLike = variant === "like";
  return (
    <button
      onClick={onClick}
      className={`size-16 rounded-full flex items-center justify-center transition-transform active:scale-90 ${
        isLike
          ? "bg-gradient-brand glow-primary text-background"
          : "bg-muted text-muted-foreground border border-border"
      }`}
      aria-label={isLike ? "좋음" : "별로"}
    >
      {isLike ? <Heart className="size-7 fill-current" /> : <X className="size-7" strokeWidth={2.5} />}
    </button>
  );
}

function DoneCard({ total }: { total: number }) {
  return (
    <div className="surface-card p-8 text-center w-full max-w-[340px]">
      <div className="text-5xl">🎉</div>
      <h2 className="mt-3 text-xl font-bold">투표 완료!</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        총 {total}장의 사진에 선호도를 표시했습니다. 친구의 베스트컷 선정에 도움을 주셨어요.
      </p>
      <Link
        to="/home"
        className="mt-6 inline-block w-full rounded-[14px] bg-gradient-brand py-3.5 font-semibold text-background"
      >
        닫기
      </Link>
    </div>
  );
}
