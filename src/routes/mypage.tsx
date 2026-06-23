import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, LogOut } from "lucide-react";
import { myVotes } from "@/lib/mock-data";

export const Route = createFileRoute("/mypage")({
  head: () => ({ meta: [{ title: "Pickly — 마이페이지" }] }),
  component: MyPage,
});

function MyPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-4 pb-32 space-y-7">
      {/* Profile */}
      <section className="surface-card p-5 flex items-center gap-4">
        <div className="size-16 rounded-full bg-gradient-brand flex items-center justify-center text-2xl font-bold text-background">
          J
        </div>
        <div className="flex-1">
          <p className="font-bold text-lg">정민기</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="inline-block size-1.5 rounded-full bg-[#FEE500] mr-1.5 align-middle" />
            Kakao 로그인
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-3">
        <Mini label="만든 투표" value={6} />
        <Mini label="받은 표" value={188} />
        <Mini label="베스트컷" value={4} />
      </section>

      {/* Lists */}
      <section className="space-y-4">
        <List title={`진행중인 투표 (${myVotes.active.length})`} items={myVotes.active} />
        <List title={`종료된 투표 (${myVotes.ended.length})`} items={myVotes.ended} />
      </section>

      {/* Danger */}
      <section className="pt-4">
        <button className="w-full rounded-[14px] border border-border text-destructive py-3.5 text-sm font-medium flex items-center justify-center gap-2">
          <LogOut className="size-4" /> 회원 탈퇴
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
  title,
  items,
}: {
  title: string;
  items: { id: string; title: string; participants: number; deadline: string }[];
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-2">{title}</h2>
      <div className="space-y-2">
        {items.map((v) => (
          <Link
            key={v.id}
            to="/result/$id"
            params={{ id: v.id }}
            className="surface-card px-4 py-3.5 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{v.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                참여 {v.participants}명 · {v.deadline}
              </p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
