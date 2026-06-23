import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Check, MapPin, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import vote1 from "@/assets/vote-1.jpg";
import vote2 from "@/assets/vote-2.jpg";
import vote3 from "@/assets/vote-3.jpg";
import vote4 from "@/assets/vote-4.jpg";

export const Route = createFileRoute("/create")({
  head: () => ({ meta: [{ title: "Pickly — 새 투표 만들기" }] }),
  component: Create,
});

const mockUploaded = [
  { idx: 1, url: vote1, location: "서울숲" },
  { idx: 2, url: vote2, location: "엔트러사이트 한남점" },
  { idx: 3, url: vote3, location: "서울숲" },
  { idx: 4, url: vote4, location: "서울숲" },
];

const grouped = [
  { name: "서울숲", indexes: [1, 3, 4] },
  { name: "엔트러사이트 한남점", indexes: [2] },
];

function Create() {
  const navigate = useNavigate();
  const [useLocation, setUseLocation] = useState(true);
  const [deadline, setDeadline] = useState("3일");

  return (
    <main className="mx-auto max-w-md px-5 pt-4 pb-32 space-y-7">
      <h1 className="text-2xl font-bold">새 투표 만들기</h1>

      {/* Title input */}
      <div>
        <label className="text-sm text-muted-foreground">투표 제목</label>
        <input
          placeholder="투표의 제목을 작성해주세요!"
          defaultValue="이번 주말 인스타 업로드용 ✨"
          className="mt-2 w-full bg-muted border border-border rounded-[14px] px-4 py-3.5 text-base placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition"
        />
      </div>

      {/* Photo upload */}
      <section>
        <div className="flex items-center justify-between">
          <label className="text-sm text-muted-foreground">사진 업로드 (2~10장)</label>
          <span className="text-xs text-primary font-medium">{mockUploaded.length} / 10</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {mockUploaded.map((p) => (
            <div key={p.idx} className="relative aspect-square rounded-2xl overflow-hidden group">
              <img
                src={p.url}
                alt={`업로드 ${p.idx}`}
                loading="lazy"
                className="absolute inset-0 size-full object-cover"
              />
              <div className="absolute top-1.5 left-1.5 size-6 rounded-full bg-background/80 backdrop-blur text-xs font-bold flex items-center justify-center">
                {p.idx}
              </div>
              <button className="absolute top-1.5 right-1.5 size-6 rounded-full bg-background/70 backdrop-blur flex items-center justify-center">
                <X className="size-3" />
              </button>
            </div>
          ))}
          <button className="aspect-square rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
            <Camera className="size-6" />
            <span className="text-xs">추가</span>
          </button>
        </div>
      </section>

      {/* Location toggle */}
      <section className="surface-card p-4 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <button
            onClick={() => setUseLocation((v) => !v)}
            className={`mt-0.5 size-5 rounded-md flex items-center justify-center transition-colors ${
              useLocation ? "bg-gradient-brand" : "bg-muted border border-border"
            }`}
          >
            {useLocation && <Check className="size-3.5 text-background" strokeWidth={3} />}
          </button>
          <div className="flex-1">
            <p className="font-medium">위치 정보 활용</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              EXIF 기반으로 50m 단위 자동 그룹화 됩니다. 포토스팟 통계에 활용돼요.
            </p>
          </div>
        </label>

        {useLocation && (
          <div className="space-y-2 pt-2 border-t border-border">
            {grouped.map((g) => (
              <div
                key={g.name}
                className="flex items-center justify-between gap-3 bg-muted/40 rounded-xl px-3.5 py-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="size-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.indexes.map((i) => `${i}번`).join(", ")}
                    </p>
                  </div>
                </div>
                <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 shrink-0">
                  <RefreshCw className="size-3" /> 재설정
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Deadline */}
      <section>
        <label className="text-sm text-muted-foreground">마감일</label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {["24시간", "3일", "7일"].map((d) => (
            <button
              key={d}
              onClick={() => setDeadline(d)}
              className={`rounded-[14px] py-3 text-sm font-medium border transition-all ${
                deadline === d
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </section>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-6 px-5">
        <div className="mx-auto max-w-md">
          <button
            onClick={() => navigate({ to: "/share/$id", params: { id: "demo" } })}
            className="w-full rounded-[14px] bg-gradient-brand glow-primary py-4 font-semibold text-background text-base"
          >
            투표 생성
          </button>
        </div>
      </div>
    </main>
  );
}
