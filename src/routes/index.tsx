import { createFileRoute, Link } from "@tanstack/react-router";
import { PicklyLogo } from "@/components/PicklyLogo";

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
  return (
    <main className="relative min-h-screen overflow-hidden flex flex-col items-center justify-between px-6 py-16">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[360px] h-[360px] rounded-full bg-secondary/25 blur-[120px]" />
      </div>

      {/* Top logo */}
      <div className="pt-10 flex flex-col items-center gap-6">
        <PicklyLogo size={72} showWordmark={false} />
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-gradient">Pickly</span>
        </h1>
      </div>

      {/* Center copy */}
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

      {/* Social login */}
      <div className="w-full flex flex-col items-center gap-6">
        <div className="flex items-center gap-5">
          <SocialButton provider="google" />
          <SocialButton provider="kakao" />
          <SocialButton provider="naver" />
          <SocialButton provider="apple" />
        </div>
        <Link
          to="/home"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          둘러보기 →
        </Link>
      </div>
    </main>
  );
}

function SocialButton({ provider }: { provider: "google" | "kakao" | "naver" | "apple" }) {
  const styles = {
    google: { bg: "bg-white", text: "text-[#1f1f1f]", label: "G" },
    kakao: { bg: "bg-[#FEE500]", text: "text-[#191600]", label: "K" },
    naver: { bg: "bg-[#03C75A]", text: "text-white", label: "N" },
    apple: { bg: "bg-white", text: "text-black", label: "" },
  } as const;
  const s = styles[provider];
  return (
    <button
      aria-label={`${provider} 로그인`}
      className={`size-14 rounded-full ${s.bg} ${s.text} flex items-center justify-center text-xl font-bold shadow-lg shadow-black/30 transition-transform active:scale-95`}
    >
      {provider === "apple" ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
          <path d="M16.365 1.43c0 1.14-.4 2.21-1.1 3.04-.74.86-1.94 1.53-3.13 1.43-.13-1.11.46-2.27 1.1-3 .72-.85 1.96-1.45 3.13-1.47zM20.5 17.18c-.55 1.21-.81 1.75-1.52 2.83-.99 1.5-2.38 3.37-4.11 3.39-1.54.02-1.94-1-4.03-1-2.09 0-2.53.98-4.06 1-1.74.05-3.06-1.62-4.05-3.12C.7 16.85-.42 11.55 1.94 8.13c1.16-1.69 3.12-2.74 4.93-2.74 1.83 0 3 1 4.51 1 1.47 0 2.36-1 4.49-1 1.6 0 3.3.87 4.51 2.37-3.96 2.17-3.32 7.84.12 9.42z" />
        </svg>
      ) : (
        s.label
      )}
    </button>
  );
}
