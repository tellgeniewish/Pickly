import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, CheckCircle2, LogIn, MapPin, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import exifr from "exifr";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { createVote } from "@/lib/votes.functions";
import { reverseGeocode } from "@/lib/kakao.functions";
import { clusterByDistance, type GeoCluster } from "@/lib/geo";

export const Route = createFileRoute("/create")({
  head: () => ({ meta: [{ title: "Pickly — 새 투표 만들기" }] }),
  component: Create,
});

interface LocalPhoto {
  id: string;
  file: File;
  preview: string;
  lat?: number;
  lng?: number;
}

interface LocationGroup extends GeoCluster {
  name: string | null;
  resolving: boolean;
}

function Create() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const create = useServerFn(createVote);
  const reverse = useServerFn(reverseGeocode);
  const [title, setTitle] = useState("");
  const [deadlineDays, setDeadlineDays] = useState<number>(3);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([]);
  const [useLocationForRanking, setUseLocationForRanking] = useState(true);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => photos.forEach((p) => URL.revokeObjectURL(p.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute location clusters whenever photos change
  useEffect(() => {
    const geo = photos
      .map((p, i) =>
        p.lat != null && p.lng != null ? { index: i + 1, lat: p.lat, lng: p.lng } : null,
      )
      .filter((x): x is { index: number; lat: number; lng: number } => x !== null);
    if (geo.length === 0) {
      setLocationGroups([]);
      setEditingIdx(null);
      return;
    }
    const clusters = clusterByDistance(geo, 50);
    setLocationGroups(clusters.map((c) => ({ ...c, name: null, resolving: true })));
    setEditingIdx(null);
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        clusters.map(async (c, i) => {
          try {
            const r = await reverse({ data: { lat: c.centerLat, lng: c.centerLng } });
            return { i, name: r?.name ?? null };
          } catch {
            return { i, name: null as string | null };
          }
        }),
      );
      if (cancelled) return;
      setLocationGroups((prev) => {
        const next = [...prev];
        for (const { i, name } of results) {
          if (next[i]) next[i] = { ...next[i], name, resolving: false };
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [photos, reverse]);

  const geoIndices = photos
    .map((p, i) => (p.lat != null && p.lng != null ? i + 1 : null))
    .filter((n): n is number => n !== null);

  const toggleAssign = (targetIdx: number, num: number) => {
    setLocationGroups((prev) => {
      const inTarget = prev[targetIdx]?.photoIndices.includes(num);
      const next = prev.map((g, i) => {
        if (i === targetIdx) {
          const photoIndices = inTarget
            ? g.photoIndices.filter((n) => n !== num)
            : [...g.photoIndices, num].sort((a, b) => a - b);
          return { ...g, photoIndices };
        }
        if (!inTarget) return { ...g, photoIndices: g.photoIndices.filter((n) => n !== num) };
        return g;
      });
      return next.filter((g, i) => g.photoIndices.length > 0 || i === targetIdx);
    });
  };

  if (!loading && !user) {
    return (
      <main className="mx-auto max-w-md px-5 pt-16 pb-32 text-center space-y-6">
        <h1 className="text-2xl font-bold">로그인이 필요해요</h1>
        <p className="text-sm text-muted-foreground">투표를 만들려면 먼저 Google로 로그인해주세요.</p>
        <button
          onClick={() => navigate({ to: "/" })}
          className="w-full rounded-[14px] bg-gradient-brand py-4 font-semibold text-background flex items-center justify-center gap-2"
        >
          <LogIn className="size-5" /> 로그인 화면으로
        </button>
      </main>
    );
  }

  const onPick = async (files: FileList | null) => {
    if (!files) return;
    const remaining = 10 - photos.length;
    const next: LocalPhoto[] = [];
    for (const f of Array.from(files).slice(0, remaining)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 8 * 1024 * 1024) {
        toast.error(`${f.name}은(는) 8MB를 넘어 제외됐어요.`);
        continue;
      }
      const photo: LocalPhoto = {
        id: crypto.randomUUID(),
        file: f,
        preview: URL.createObjectURL(f),
      };
      try {
        const gps = await exifr.gps(f);
        if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
          photo.lat = gps.latitude;
          photo.lng = gps.longitude;
        }
      } catch {
        // ignore EXIF errors
      }
      next.push(photo);
    }
    setPhotos((prev) => [...prev, ...next]);
  };

  const remove = (id: string) => {
    const p = photos.find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.preview);
    setPhotos(photos.filter((x) => x.id !== id));
  };

  const canSubmit = photos.length >= 2 && title.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!user) return;
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const voteId = crypto.randomUUID();
      const paths: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const ext = p.file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${voteId}/${i}.${ext}`;
        const { error } = await supabase.storage
          .from("vote-photos")
          .upload(path, p.file, { contentType: p.file.type, upsert: false });
        if (error) throw error;
        paths.push(path);
      }
      // Only include location for ranking when user opts in.
      const derivedLocation = useLocationForRanking
        ? (locationGroups.find((g) => g.name)?.name ?? null)
        : null;
      const res = await create({
        data: {
          title: title.trim(),
          locationName: derivedLocation,
          deadlineHours: deadlineDays * 24,
          photoPaths: paths,
        },
      });
      toast.success("투표가 생성됐어요!");
      navigate({ to: "/share/$id", params: { id: res.id } });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-5 pt-4 pb-32 space-y-7">
      <h1 className="text-2xl font-bold">새 투표 만들기</h1>

      <div>
        <label className="text-sm text-muted-foreground">투표 제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="투표의 제목을 작성해주세요!"
          className="mt-2 w-full bg-muted border border-border rounded-[14px] px-4 py-3.5 text-base placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition"
        />
      </div>

      <section>
        <div className="flex items-center justify-between">
          <label className="text-sm text-muted-foreground">사진 업로드 (2~10장)</label>
          <span className="text-xs text-primary font-medium">{photos.length} / 10</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void onPick(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="mt-2 grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={p.id} className="relative aspect-square rounded-2xl overflow-hidden group">
              <img src={p.preview} alt="" className="absolute inset-0 size-full object-cover" />
              <div className="absolute top-1.5 left-1.5 size-6 rounded-full bg-background/80 backdrop-blur text-xs font-bold flex items-center justify-center">
                {i + 1}
              </div>
              {p.lat != null && (
                <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-background/80 backdrop-blur text-[10px] flex items-center gap-0.5">
                  <MapPin className="size-2.5 text-primary" />
                  <span>GPS</span>
                </div>
              )}
              <button
                onClick={() => remove(p.id)}
                className="absolute top-1.5 right-1.5 size-6 rounded-full bg-background/70 backdrop-blur flex items-center justify-center"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          {photos.length < 10 && (
            <button
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Camera className="size-6" />
              <span className="text-xs">추가</span>
            </button>
          )}
        </div>
      </section>

      <section>
        <div
          className={`rounded-2xl border p-4 transition-colors ${
            useLocationForRanking ? "bg-muted/40 border-border" : "bg-muted/20 border-border/60"
          }`}
        >
          <button
            type="button"
            onClick={() => setUseLocationForRanking((v) => !v)}
            className="w-full flex items-start gap-2.5 text-left"
            aria-pressed={useLocationForRanking}
          >
            <CheckCircle2
              className={`size-5 shrink-0 mt-0.5 transition-colors ${
                useLocationForRanking ? "text-primary" : "text-muted-foreground/50"
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm">위치 정보 활용</p>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    useLocationForRanking
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {useLocationForRanking ? "ON" : "OFF"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {useLocationForRanking
                  ? "EXIF 기반으로 50m 단위 자동 그룹화 됩니다. 홈화면의 이번 주 인기 포토스팟 통계에 반영돼요."
                  : "OFF 상태에서는 홈화면의 이번 주 인기 포토스팟 통계에 반영되지 않아요."}
              </p>
            </div>
          </button>

          {useLocationForRanking && (
            <>
              {photos.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground/80">
                  사진을 추가하면 위치가 자동으로 여기 표시돼요.
                </p>
              ) : locationGroups.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground/80">
                  추가한 사진에서 EXIF 위치 정보를 찾지 못했어요. (카메라 앱 위치 기록이 꺼져 있거나, 스크린샷/편집본일 수 있어요.)
                </p>
              ) : (
                <div className="mt-3 border-t border-border/60 pt-3 space-y-3">
                  {locationGroups.map((g, idx) => {
                    const isEditing = editingIdx === idx;
                    return (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {g.resolving
                                  ? "위치 확인 중..."
                                  : (g.name ??
                                    `위도 ${g.centerLat.toFixed(4)}, 경도 ${g.centerLng.toFixed(4)}`)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {g.photoIndices.length === 0
                                  ? "지정된 사진 없음"
                                  : g.photoIndices.map((n) => `${n}번`).join(", ")}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingIdx(isEditing ? null : idx);
                            }}
                            className={`flex items-center gap-1 text-xs transition-colors shrink-0 ${
                              isEditing ? "text-primary" : "text-muted-foreground hover:text-primary"
                            }`}
                          >
                            <RefreshCw className="size-3.5" />
                            {isEditing ? "완료" : "재설정"}
                          </button>
                        </div>
                        {isEditing && (
                          <div className="ml-6 rounded-xl bg-background/40 border border-border/60 p-2.5">
                            <p className="text-[11px] text-muted-foreground mb-2">
                              이 위치에 속하는 사진 번호를 눌러서 골라주세요.
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {geoIndices.map((n) => {
                                const on = g.photoIndices.includes(n);
                                return (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => toggleAssign(idx, n)}
                                    className={`size-8 rounded-full text-xs font-bold border transition-colors ${
                                      on
                                        ? "bg-primary text-background border-primary"
                                        : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                                    }`}
                                  >
                                    {n}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <label className="text-sm text-muted-foreground">마감 (1~7일)</label>
          <span className="text-sm font-semibold text-primary">
            {deadlineDays}일 후 마감
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={7}
          step={1}
          value={deadlineDays}
          onChange={(e) => setDeadlineDays(Number(e.target.value))}
          className="mt-3 w-full accent-primary"
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground px-0.5">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDeadlineDays(d)}
              className={`w-5 text-center ${
                deadlineDays === d ? "text-primary font-bold" : ""
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </section>

      <div className="fixed bottom-0 inset-x-0 z-30 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-6 px-5">
        <div className="mx-auto max-w-md">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full rounded-[14px] bg-gradient-brand glow-primary py-4 font-semibold text-background text-base disabled:opacity-40 disabled:cursor-not-allowed disabled:glow-none"
          >
            {submitting
              ? "생성 중..."
              : photos.length < 2
                ? `사진을 ${2 - photos.length}장 더 올려주세요`
                : "투표 생성"}
          </button>
        </div>
      </div>
    </main>
  );
}
