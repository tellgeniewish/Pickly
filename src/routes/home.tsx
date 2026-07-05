import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Flame, ImagePlus, LogIn, Users, Vote } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { photoSpots } from "@/lib/mock-data";
import { getHomeStats, listMyVotes } from "@/lib/votes.functions";
import { getSpotEnrichments } from "@/lib/kakao.functions";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Pickly — 홈" }] }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const fetchStats = useServerFn(getHomeStats);
  const fetchMyVotes = useServerFn(listMyVotes);
  const fetchSpotEnrichments = useServerFn(getSpotEnrichments);

  const statsQuery = useQuery({
    queryKey: ["home-stats"],
    queryFn: () => fetchStats(),
  });
  const spotNames = photoSpots.map((s) => s.name);
  const spotEnrichmentQuery = useQuery({
    queryKey: ["spot-enrichments", ...spotNames],
    queryFn: () => fetchSpotEnrichments({ data: { names: spotNames } }),
    staleTime: 60 * 60 * 1000,
  });
  const myVotesQuery = useQuery({
    queryKey: ["my-votes", user?.id ?? "guest"],
    queryFn: () => fetchMyVotes(),
    enabled: !!user,
  });

  const requireAuth = () => {
    if (!user) {
      navigate({ to: "/" });
      return false;
    }
    return true;
  };

  return (
    <main className="mx-auto max-w-md px-5 pb-32 pt-4 space-y-7">
      <section>
        <p className="text-muted-foreground text-sm">
          {loading ? "..." : user ? `안녕하세요 👋` : "게스트로 둘러보는 중"}
        </p>
        <h1 className="text-2xl font-bold mt-1">
          오늘은 어떤 <span className="text-gradient">베스트컷</span>을 찾아볼까요?
        </h1>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Users className="size-5" />}
          label="누적 참여자"
          value={(statsQuery.data?.totalParticipants ?? 0).toLocaleString()}
          suffix="명"
        />
        <StatCard
          icon={<Vote className="size-5" />}
          label="오늘 생성된 투표"
          value={(statsQuery.data?.votesToday ?? 0).toString()}
          suffix="개"
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Flame className="size-5 text-primary" />
          <h2 className="font-semibold">이번 주 인기 포토스팟</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 snap-x snap-mandatory">
          {photoSpots.map((spot) => (
            <div key={spot.rank} className="snap-start shrink-0 w-[240px] surface-card overflow-hidden">
              <div className="relative aspect-[4/3]">
                <img src={spot.image} alt={spot.name} loading="lazy" className="absolute inset-0 size-full object-cover" />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/70 backdrop-blur text-xs font-semibold">
                  🏆 {spot.rank}위
                </div>
                <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-background to-transparent" />
              </div>
              <div className="p-3.5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{spot.name}</p>
                  <p className="text-xs text-primary font-bold">추천율 {spot.recommend}%</p>
                </div>
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  {spot.tags.map((t) => (
                    <span key={t} className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {user ? (
        <Link to="/create" className="block w-full rounded-[14px] bg-gradient-brand p-[1.5px] glow-primary">
          <div className="rounded-[12.5px] bg-background/40 backdrop-blur px-5 py-4 flex items-center justify-center gap-2.5">
            <ImagePlus className="size-5 text-foreground" />
            <span className="font-semibold tracking-tight">새 투표 만들기</span>
          </div>
        </Link>
      ) : (
        <button
          onClick={requireAuth}
          className="w-full rounded-[14px] bg-gradient-brand py-4 font-semibold text-background flex items-center justify-center gap-2.5"
        >
          <LogIn className="size-5" />
          로그인하고 새 투표 만들기
        </button>
      )}

      {user && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            내 진행중인 투표 ({myVotesQuery.data?.active.length ?? 0})
          </h2>
          <div className="space-y-2">
            {(myVotesQuery.data?.active ?? []).map((v) => <VoteRow key={v.id} vote={v} />)}
            {myVotesQuery.data?.active.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                진행중인 투표가 없어요. 새 투표를 만들어보세요!
              </p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function StatCard({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string; suffix: string }) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        <span className="text-muted-foreground text-sm">{suffix}</span>
      </div>
    </div>
  );
}

function VoteRow({ vote }: { vote: { id: string; title: string; participants: number; closesAt: string } }) {
  const remaining = Math.max(0, Math.ceil((new Date(vote.closesAt).getTime() - Date.now()) / (1000 * 3600 * 24)));
  return (
    <Link
      to="/result/$id"
      params={{ id: vote.id }}
      className="block rounded-2xl bg-muted/40 hover:bg-muted px-3.5 py-3 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium truncate">{vote.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            참여 {vote.participants}명 · D-{remaining}
          </p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
      </div>
    </Link>
  );
}
