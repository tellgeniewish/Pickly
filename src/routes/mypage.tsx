import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, LogIn, LogOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { listMyVotes } from "@/lib/votes.functions";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export const Route = createFileRoute("/mypage")({
  head: () => ({ meta: [{ title: "Pickly — 마이페이지" }] }),
  component: MyPage,
});

function MyPage() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const fetch = useServerFn(listMyVotes);

  const q = useQuery({
    queryKey: ["my-votes", user?.id],
    queryFn: () => fetch(),
    enabled: !!user,
  });

  if (!loading && !user) {
    return (
      <main className="mx-auto max-w-md px-5 pt-16 pb-32 text-center space-y-6">
        <h1 className="text-2xl font-bold">로그인이 필요해요</h1>
        <button
          onClick={() => navigate({ to: "/" })}
          className="w-full rounded-[14px] bg-gradient-brand py-4 font-semibold text-background flex items-center justify-center gap-2"
        >
          <LogIn className="size-5" /> 로그인 화면으로
        </button>
      </main>
    );
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("로그아웃 되었어요.");
    navigate({ to: "/" });
  };

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "사용자";
  const avatar = user?.user_metadata?.avatar_url as string | undefined;

  const stats = q.data?.stats ?? { total: 0, votesReceived: 0 };
  const active = q.data?.active ?? [];
  const ended = q.data?.ended ?? [];

  return (
    <main className="mx-auto max-w-md px-5 pt-4 pb-32 space-y-7">
      <section className="surface-card p-5 flex items-center gap-4">
        {avatar ? (
          <img src={avatar} alt="" className="size-16 rounded-full object-cover" />
        ) : (
          <div className="size-16 rounded-full bg-gradient-brand flex items-center justify-center text-2xl font-bold text-background">
            {displayName[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <p className="font-bold text-lg">{displayName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="inline-block size-1.5 rounded-full bg-white mr-1.5 align-middle" />
            Google 로그인
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Mini label="만든 투표" value={stats.total} />
        <Mini label="받은 표" value={stats.votesReceived} />
        <Mini label="진행중" value={active.length} />
      </section>

      <section className="space-y-4">
        <List title={`진행 중인 투표 (${active.length})`} items={active} />
        <List title={`종료된 투표 (${ended.length})`} items={ended} />
      </section>

      <section className="pt-4">
        <button
          onClick={signOut}
          className="w-full rounded-[14px] border border-border text-muted-foreground py-3.5 text-sm font-medium flex items-center justify-center gap-2"
        >
          <LogOut className="size-4" /> 로그아웃
        </button>
      </section>
    </main>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card py-4 text-center">
      <p className="text-2xl font-bold text-gradient">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function List({
  title, items,
}: { title: string; items: Array<{ id: string; title: string; participants: number; closesAt: string }> }) {
  if (items.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground text-center py-4">없어요.</p>
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-2">{title}</h2>
      <div className="space-y-2">
        {items.map((v) => {
          const remaining = Math.max(0, Math.ceil((new Date(v.closesAt).getTime() - Date.now()) / (1000 * 3600 * 24)));
          return (
            <Link
              key={v.id}
              to="/result/$id"
              params={{ id: v.id }}
              className="surface-card px-4 py-3.5 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{v.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  참여 {v.participants}명 · {remaining > 0 ? `D-${remaining}` : "종료"}
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
