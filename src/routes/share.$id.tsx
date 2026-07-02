import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/share/$id")({
  head: () => ({ meta: [{ title: "Pickly — 투표 공유" }] }),
  component: Share,
});

function Share() {
  const { id } = Route.useParams();
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(`/vote/${id}`);

  useEffect(() => {
    if (typeof window !== "undefined") setUrl(`${window.location.origin}/vote/${id}`);
  }, [id]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // noop
    }
  };

  const shareText = `Pickly에서 사진 골라주세요 → ${url}`;
  const kakaoShare = () => {
    if (navigator.share) {
      navigator.share({ title: "Pickly 투표", text: shareText, url }).catch(() => {});
    } else {
      onCopy();
    }
  };

  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-16 flex flex-col items-center text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 blur-3xl bg-primary/40 rounded-full" />
        <div className="size-24 rounded-full bg-gradient-brand flex items-center justify-center glow-primary">
          <Check className="size-12 text-background" strokeWidth={3} />
        </div>
      </div>

      <h1 className="mt-7 text-2xl font-bold">투표가 생성됐어요 🎉</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        링크를 친구들에게 공유하고 반응을 받아보세요.
      </p>

      <div className="mt-8 w-full surface-card p-2 pl-4 flex items-center gap-2">
        <span className="flex-1 truncate text-sm text-muted-foreground text-left">{url}</span>
        <button
          onClick={onCopy}
          className="px-3.5 py-2.5 rounded-xl bg-muted hover:bg-surface-2 text-sm font-medium flex items-center gap-1.5"
        >
          {copied ? (
            <>
              <Check className="size-4 text-primary" /> 복사됨
            </>
          ) : (
            <>
              <Copy className="size-4" /> 복사
            </>
          )}
        </button>
      </div>

      <button
        onClick={kakaoShare}
        className="mt-3 w-full rounded-[14px] bg-[#FEE500] text-[#191600] py-4 font-semibold flex items-center justify-center gap-2"
      >
        <MessageCircle className="size-5" /> 친구에게 공유하기
      </button>

      <Link
        to="/vote/$id"
        params={{ id }}
        className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        친구들이 보는 화면 미리보기 →
      </Link>
      <Link
        to="/result/$id"
        params={{ id }}
        className="mt-3 w-full rounded-[14px] border border-border py-3.5 font-medium text-sm"
      >
        내 투표 결과 보기
      </Link>
    </main>
  );
}
