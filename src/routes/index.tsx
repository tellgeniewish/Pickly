import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PicklyLogo } from "@/components/PicklyLogo";
import { lovable } from "@/integrations/lovable";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pickly — 로그인" },
      { name: "description", content: "친구들의 반응으로 베스트컷을 찾아보세요." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/home" });
  }, [loading, session, navigate]);

  const onGoogle = async () => {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) {
      toast.error("로그인 중 오류가 발생했어요.");
      setBusy(false);
      return;
    }
    if (res.redirected) return;
    navigate({ to: "/home" });
  };

  const onUnsupported = (name: string) => {
    toast.message(`${name} 로그인은 준비 중이에요`, {
      description: "지금은 Google 로그인 또는 게스트로 진행해주세요.",
    });
  };

  return (
    <main className="relative min-h-screen overflow-hidden flex flex-col items-center justify-between px-6 py-16">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[360px] h-[360px] rounded-full bg-secondary/25 blur-[120px]" />
      </div>

      <div className="pt-10 flex flex-col items-center gap-6">
        <PicklyLogo size={72} showWordmark={false} />
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-gradient">Pickly</span>
        </h1>
      </div>

      <div className="text-center space-y-3">
        <p className="text-2xl font-semibold leading-snug">
          친구들의 반응으로
          <br />
          <span className="text-gradient">베스트컷</span>을 찾아보세요!
        </p>
        <p className="text-muted-foreground text-sm">
          스와이프 한 번이면 충분해요. AI가 이유까지 알려드려요.
        </p>
      </div>

      <div className="w-full flex flex-col items-center gap-5">
        <button
          onClick={onGoogle}
          disabled={busy}
          className="w-full max-w-[320px] rounded-[14px] bg-white text-[#1f1f1f] py-3.5 font-semibold flex items-center justify-center gap-2.5 shadow-lg shadow-black/30 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <GoogleG />
          {busy ? "이동 중..." : "Google로 계속하기"}
        </button>

        <div className="flex items-center gap-5">
          <SocialButton provider="kakao" onClick={() => onUnsupported("카카오")} />
          <SocialButton provider="naver" onClick={() => onUnsupported("네이버")} />
          <SocialButton provider="apple" onClick={() => onUnsupported("애플")} />
        </div>

        <Link
          to="/home"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          게스트로 둘러보기 →
        </Link>
      </div>
    </main>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.4-1.12 2.59-2.39 3.39v2.82h3.86c2.26-2.08 3.56-5.15 3.56-8.45z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.86-2.82c-1.07.72-2.45 1.15-4.08 1.15-3.13 0-5.79-2.11-6.74-4.96H1.28v3.11C3.26 21.3 7.31 24 12 24z"/>
      <path fill="#FBBC05" d="M5.26 14.46c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.79H1.28C.46 8.42 0 10.16 0 12s.46 3.58 1.28 5.21l3.98-2.75z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.79l3.98 3.11C6.21 6.86 8.87 4.75 12 4.75z"/>
    </svg>
  );
}

function SocialButton({
  provider,
  onClick,
}: {
  provider: "kakao" | "naver" | "apple";
  onClick: () => void;
}) {
  const bg = {
    kakao: "bg-[#FEE500]",
    naver: "bg-[#03C75A]",
    apple: "bg-white",
  }[provider];
  return (
    <button
      onClick={onClick}
      aria-label={`${provider} 로그인`}
      className={`size-14 rounded-full ${bg} flex items-center justify-center shadow-lg shadow-black/30 transition-transform active:scale-95 opacity-70 hover:opacity-100`}
    >
      {provider === "kakao" && (
        <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
          <path fill="#191600" d="M12 3C6.48 3 2 6.58 2 10.99c0 2.86 1.88 5.36 4.71 6.78-.2.7-.72 2.6-.83 3.01-.13.51.19.5.4.36.16-.1 2.6-1.77 3.65-2.48.68.1 1.37.15 2.07.15 5.52 0 10-3.58 10-7.99S17.52 3 12 3z"/>
        </svg>
      )}
      {provider === "naver" && (
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
          <path fill="#fff" d="M16.27 12.84 7.65 0H0v24h7.73V11.16L16.35 24H24V0h-7.73z"/>
        </svg>
      )}
      {provider === "apple" && (
        <svg viewBox="0 0 24 24" fill="black" className="size-7" aria-hidden="true">
          <g transform="translate(1.4 -0.4)">
            <path d="M16.365 1.43c0 1.14-.4 2.21-1.1 3.04-.74.86-1.94 1.53-3.13 1.43-.13-1.11.46-2.27 1.1-3 .72-.85 1.96-1.45 3.13-1.47zM20.5 17.18c-.55 1.21-.81 1.75-1.52 2.83-.99 1.5-2.38 3.37-4.11 3.39-1.54.02-1.94-1-4.03-1-2.09 0-2.53.98-4.06 1-1.74.05-3.06-1.62-4.05-3.12C.7 16.85-.42 11.55 1.94 8.13c1.16-1.69 3.12-2.74 4.93-2.74 1.83 0 3 1 4.51 1 1.47 0 2.36-1 4.49-1 1.6 0 3.3.87 4.51 2.37-3.96 2.17-3.32 7.84.12 9.42z"/>
          </g>
        </svg>
      )}
    </button>
  );
}
