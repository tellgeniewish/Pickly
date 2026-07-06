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
}

function Create() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const create = useServerFn(createVote);
  const reverse = useServerFn(reverseGeocode);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState<24 | 72 | 168>(72);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([]);
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
      return;
    }
    const clusters = clusterByDistance(geo, 50);
    // Initial state with null names
    setLocationGroups(clusters.map((c) => ({ ...c, name: null })));
    // Reverse-geocode each cluster centroid
    let cancelled = false;
    (async () => {
      const named = await Promise.all(
        clusters.map(async (c) => {
          try {
            const r = await reverse({ data: { lat: c.centerLat, lng: c.centerLng } });
            return { ...c, name: r?.name ?? null };
          } catch {
            return { ...c, name: null };
          }
        }),
      );
      if (!cancelled) setLocationGroups(named);
    })();
    return () => {
      cancelled = true;
    };
  }, [photos, reverse]);

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
      // Extract EXIF GPS (best-effort, non-blocking failures)
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
      const derivedLocation = locationGroups.find((g) => g.name)?.name ?? null;
      const res = await create({
        data: {
          title: title.trim(),
          locationName: derivedLocation,
          deadlineHours: deadline,
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

      <div>
        <label className="text-sm text-muted-foreground">위치 (선택)</label>
        <input
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="예) 성수동 서울숲"
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

      {photos.length >= 2 && photos.length <= 10 && (
        <section>
          <div className="flex items-center gap-1.5">
            <MapPin className="size-4 text-primary" />
            <label className="text-sm text-muted-foreground">위치 정보 활용</label>
          </div>
          <div className="mt-2 rounded-2xl bg-muted/40 border border-border p-4 space-y-2.5">
            {locationGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                사진에서 위치 정보를 찾지 못했어요. (EXIF GPS 태그가 없거나 카메라 앱에서 위치 기록이 꺼져 있어요.)
              </p>
            ) : (
              locationGroups.map((g, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {g.name ??
                        `위도 ${g.centerLat.toFixed(4)}, 경도 ${g.centerLng.toFixed(4)}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {g.photoIndices.map((n) => `${n}번`).join(", ")} 사진
                    </p>
                  </div>
                  <span className="text-xs text-primary font-semibold shrink-0">
                    {g.photoIndices.length}장
                  </span>
                </div>
              ))
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground/70">
            같은 위치(50m 이내)로 판단된 사진끼리 묶었어요.
          </p>
        </section>
      )}

      <section>
        <label className="text-sm text-muted-foreground">마감</label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {([
            [24, "24시간"],
            [72, "3일"],
            [168, "7일"],
          ] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setDeadline(v)}
              className={`rounded-[14px] py-3 text-sm font-medium border transition-all ${
                deadline === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground"
              }`}
            >
              {l}
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
