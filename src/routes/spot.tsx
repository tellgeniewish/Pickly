import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, MapPin } from "lucide-react";
import { z } from "zod";
import { getSpotPlaceDetail } from "@/lib/kakao.functions";

const searchSchema = z.object({
  name: z.string().catch(""),
  lat: z.coerce.number().catch(NaN),
  lng: z.coerce.number().catch(NaN),
  rank: z.coerce.number().catch(0),
  rate: z.coerce.number().catch(0),
  kw: z.string().catch(""),
});

export const Route = createFileRoute("/spot")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Pickly — 포토스팟 상세" },
      { name: "description", content: "인기 포토스팟의 지도 위치와 장소 정보를 확인해요." },
      { property: "og:title", content: "Pickly 포토스팟 상세" },
      { property: "og:description", content: "인기 포토스팟의 지도 위치와 장소 정보를 확인해요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpotDetail,
});

const JS_KEY = import.meta.env.VITE_KAKAO_JS_APP_KEY as string | undefined;

let sdkPromise: Promise<void> | null = null;
function loadKakaoSdk(): Promise<void> {
  if (!JS_KEY) return Promise.reject(new Error("no_js_key"));
  if ((window as any).kakao?.maps) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("kakao-maps-sdk") as HTMLScriptElement | null;
    const onReady = () => (window as any).kakao.maps.load(() => resolve());
    if (existing) {
      existing.addEventListener("load", onReady);
      existing.addEventListener("error", () => reject(new Error("sdk_failed")));
      return;
    }
    const s = document.createElement("script");
    s.id = "kakao-maps-sdk";
    s.async = true;
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${JS_KEY}&libraries=services&autoload=false`;
    s.onload = onReady;
    s.onerror = () => reject(new Error("sdk_failed"));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

function SpotDetail() {
  const { name, lat, lng, rank, rate, kw } = Route.useSearch();
  const keywords = kw ? kw.split(",").filter(Boolean) : [];
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const medal = ["🥇", "🥈", "🥉"][rank - 1] ?? "🏅";

  const fetchDetail = useServerFn(getSpotPlaceDetail);
  const detailQuery = useQuery({
    queryKey: ["spot-detail", name, lat, lng],
    queryFn: () => fetchDetail({ data: { name, lat, lng } }),
    enabled: !!name && hasCoords,
    staleTime: 10 * 60 * 1000,
  });

  const detail = detailQuery.data?.detail ?? null;
  const placeUrl = detail?.placeUrl ?? detailQuery.data?.fallbackQueryUrl ?? null;

  return (
    <main className="mx-auto max-w-md px-5 pb-32 pt-4 space-y-5">
      <Link to="/home" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" />
        뒤로가기
      </Link>

      <section>
        <h1 className="text-2xl font-bold flex items-start gap-1.5">
          <MapPin className="size-6 text-primary shrink-0 mt-0.5" />
          <span className="min-w-0 break-words">{name || "포토스팟"}</span>
        </h1>
        {rank > 0 && (
          <p className="mt-1.5 text-sm text-muted-foreground">
            {medal} 이번 주 인기 포토스팟 #{rank}
          </p>
        )}
        {rate > 0 && <p className="text-sm font-semibold text-primary mt-0.5">추천율 {rate}%</p>}
        {keywords.length > 0 && (
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {keywords.map((t) => (
              <span key={t} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                #{t}
              </span>
            ))}
          </div>
        )}
      </section>

      {!hasCoords ? (
        <div className="surface-card p-5 text-center space-y-3">
          <p className="text-sm text-muted-foreground">위치 정보를 확인할 수 없습니다.</p>
          <Link to="/home" className="text-sm text-primary font-medium">
            홈으로 돌아가기
          </Link>
        </div>
      ) : (
        <SpotMap
          lat={detail?.lat ?? lat}
          lng={detail?.lng ?? lng}
          name={detail?.placeName ?? name}
          staticMapDataUrl={detailQuery.data?.staticMapDataUrl ?? null}
          loading={detailQuery.isLoading}
        />
      )}

      {hasCoords && (
        <section className="surface-card p-4 space-y-2">
          <p className="font-semibold">{detail?.placeName ?? name}</p>
          {detailQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">장소 정보를 불러오는 중...</p>
          ) : detail ? (
            <>
              {detail.roadAddress && (
                <p className="text-sm text-muted-foreground">
                  도로명 주소: <span className="text-foreground">{detail.roadAddress}</span>
                </p>
              )}
              {detail.address && (
                <p className="text-sm text-muted-foreground">
                  지번 주소: <span className="text-foreground">{detail.address}</span>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">해당 장소의 지도 정보를 찾을 수 없습니다.</p>
          )}
          {placeUrl && (
            <a
              href={placeUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-brand py-3 font-semibold text-background"
            >
              카카오맵에서 장소 보기
              <ExternalLink className="size-4" />
            </a>
          )}
        </section>
      )}
    </main>
  );
}

function SpotMap({
  lat,
  lng,
  name,
  staticMapDataUrl,
  loading,
}: {
  lat: number;
  lng: number;
  name: string;
  staticMapDataUrl: string | null;
  loading: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"idle" | "ready" | "error">("idle");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!JS_KEY || !ref.current) {
      setStatus("error");
      return;
    }
    let cancelled = false;
    loadKakaoSdk()
      .then(() => {
        if (cancelled || !ref.current) return;
        const kakao = (window as any).kakao;
        const center = new kakao.maps.LatLng(lat, lng);
        const map = new kakao.maps.Map(ref.current, { center, level: 4 });
        const marker = new kakao.maps.Marker({ position: center, map });
        const info = new kakao.maps.InfoWindow({
          content: `<div style="padding:6px 10px;font-size:12px;color:#111">${name}</div>`,
        });
        kakao.maps.event.addListener(marker, "click", () => info.open(map, marker));
        map.setCenter(center);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, name, attempt]);

  return (
    <section className="surface-card overflow-hidden">
      <div className="relative h-[320px] bg-muted">
        <div ref={ref} className="absolute inset-0" />
        {status !== "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-5">
            {staticMapDataUrl ? (
              <img src={staticMapDataUrl} alt={`${name} 지도`} className="absolute inset-0 size-full object-cover" />
            ) : loading ? (
              <p className="text-sm text-muted-foreground">지도를 불러오는 중...</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">지도를 불러오지 못했습니다.</p>
                <button
                  onClick={() => {
                    sdkPromise = null;
                    setStatus("idle");
                    setAttempt((a) => a + 1);
                  }}
                  className="text-sm text-primary font-medium"
                >
                  다시 시도
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
