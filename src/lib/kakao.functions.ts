import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server-side memo to avoid re-hitting Kakao for the same spot list on every request.
const spotCache = new Map<string, { at: number; data: SpotEnrichment }>();
const SPOT_TTL_MS = 60 * 60 * 1000; // 1h

interface SpotEnrichment {
  keywords: string[];
  imageDataUrl: string | null;
  placeName: string | null;
}

const KAKAO_BASE = "https://dapi.kakao.com";

function getKey(): string | null {
  return process.env.KAKAO_REST_API_KEY || null;
}

async function kakaoFetch(path: string): Promise<any | null> {
  const key = getKey();
  if (!key) return null;
  const res = await fetch(`${KAKAO_BASE}${path}`, {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// Reverse geocode lat/lng → nearest POI place name (e.g., "서울숲", "엔트러사이트 한남점").
// Falls back to administrative region name if no POI is within range.
export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ lat: z.number(), lng: z.number() }).parse(input))
  .handler(async ({ data }) => {
    const { resolvePlaceName } = await import("./kakao.server");
    return { name: await resolvePlaceName(data.lat, data.lng) };
  });

// Keyword place search (카카오 로컬 - 키워드로 장소 검색).
// Used by the "위치 변경" flow on the create screen.
export const searchPlaces = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().min(1).max(60),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { searchPlacesByKeyword } = await import("./kakao.server");
    return searchPlacesByKeyword(data.query.trim(), data.lat, data.lng);
  });



// Given a place query, return keywords + a representative image (Kakao static map).
// We deliberately DO NOT return user-generated photos — only a Kakao static map for the place location.
export const lookupPlace = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ query: z.string().min(1).max(60) }).parse(input))
  .handler(async ({ data }) => {
    const key = getKey();
    if (!key) return { keywords: [] as string[], imageDataUrl: null as string | null, placeName: null as string | null };

    const j = await kakaoFetch(`/v2/local/search/keyword.json?query=${encodeURIComponent(data.query)}&size=5`);
    const doc = j?.documents?.[0];
    if (!doc) return { keywords: [], imageDataUrl: null, placeName: null };

    // Keywords from category_name: e.g., "여행 > 관광,명소 > 공원" → ["여행","관광,명소","공원"]
    const parts: string[] = String(doc.category_name || "")
      .split(">")
      .map((s: string) => s.trim())
      .filter(Boolean);
    // Split any comma-joined leaves and dedupe
    const flat = Array.from(new Set(parts.flatMap((p) => p.split(",").map((s) => s.trim()).filter(Boolean))));
    const keywords = flat.slice(-3); // most specific 3

    // Fetch a Kakao static map image server-side and return as data URL for safe display.
    const lat = Number(doc.y);
    const lng = Number(doc.x);
    let imageDataUrl: string | null = null;
    try {
      const staticUrl = `https://map0.daumcdn.net/map_2d_hd/2410wof/L3/${Math.floor((lng + 180) * 100)}/${Math.floor((90 - lat) * 100)}.png`;
      // Kakao internal tile URLs are unreliable; use the documented Static Map REST API instead.
      const restUrl = `${KAKAO_BASE}/v2/maps/staticmap?markers=type:d|size:mid|pos:${lng} ${lat}&level=3&MAPTYPE=ROADMAP&IW=480&IH=320`;
      void staticUrl;
      const res = await fetch(restUrl, { headers: { Authorization: `KakaoAK ${key}` } });
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        const b64 = typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(buf).toString("base64");
        imageDataUrl = `data:image/png;base64,${b64}`;
      }
    } catch {
      imageDataUrl = null;
    }

    return { keywords, imageDataUrl, placeName: doc.place_name as string };
  });

// Batch enrichment for known photo-spot names (used by home page top-3).
// Cached in-memory for 1h. Always safe: never returns user-generated photos.
export const getSpotEnrichments = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ names: z.array(z.string().min(1).max(60)).min(1).max(10) }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = getKey();
    if (!key) {
      return data.names.map((name) => ({ name, keywords: [] as string[], imageDataUrl: null as string | null }));
    }
    const now = Date.now();
    const results = await Promise.all(
      data.names.map(async (name): Promise<{ name: string } & SpotEnrichment> => {
        const cached = spotCache.get(name);
        if (cached && now - cached.at < SPOT_TTL_MS) return { name, ...cached.data };
        const j = await kakaoFetch(`/v2/local/search/keyword.json?query=${encodeURIComponent(name)}&size=1`);
        const doc = j?.documents?.[0];
        if (!doc) {
          const empty: SpotEnrichment = { keywords: [], imageDataUrl: null, placeName: null };
          spotCache.set(name, { at: now, data: empty });
          return { name, ...empty };
        }
        const parts = String(doc.category_name || "")
          .split(">")
          .map((s: string) => s.trim())
          .filter(Boolean);
        const flat = Array.from(
          new Set(parts.flatMap((p) => p.split(",").map((s) => s.trim()).filter(Boolean))),
        );
        const keywords = flat.slice(-3);
        const lat = Number(doc.y);
        const lng = Number(doc.x);
        let imageDataUrl: string | null = null;
        try {
          const url = `${KAKAO_BASE}/v2/maps/staticmap?markers=type:d|size:mid|pos:${lng} ${lat}&level=3&MAPTYPE=ROADMAP&IW=480&IH=320`;
          const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
          if (res.ok) {
            const buf = new Uint8Array(await res.arrayBuffer());
            let bin = "";
            for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
            const b64 = typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(buf).toString("base64");
            imageDataUrl = `data:image/png;base64,${b64}`;
          }
        } catch {
          imageDataUrl = null;
        }
        const enrichment: SpotEnrichment = {
          keywords,
          imageDataUrl,
          placeName: doc.place_name as string,
        };
        spotCache.set(name, { at: now, data: enrichment });
        return { name, ...enrichment };
      }),
    );
    return results;
  });


// Spot detail for the "포토스팟 상세" screen. Coordinates are already known, so
// this call only enriches the spot with addresses / Kakao Map place URL, plus a
// server-rendered static map as a fallback when no JS map key is configured.
export const getSpotPlaceDetail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().min(1).max(80), lat: z.number(), lng: z.number() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { fetchPlaceDetail, fetchStaticMap } = await import("./kakao.server");
    const [detail, staticMap] = await Promise.all([
      fetchPlaceDetail(data.name, data.lat, data.lng),
      fetchStaticMap(data.lat, data.lng),
    ]);
    return {
      detail,
      staticMapDataUrl: staticMap,
      fallbackQueryUrl: `https://map.kakao.com/?q=${encodeURIComponent(data.name)}`,
    };
  });

// Kakao Maps JavaScript key (JS 앱 키). Kept in server env and handed to the
// client only when needed — never hardcoded in the bundle.
export const getKakaoMapJsKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env["KAKAO_JS_APP_KEY"] || null };
});
