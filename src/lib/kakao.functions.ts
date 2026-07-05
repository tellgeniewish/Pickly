import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

// Reverse geocode lat/lng → short region name (e.g., "서울 성동구 성수동")
export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ lat: z.number(), lng: z.number() }).parse(input))
  .handler(async ({ data }) => {
    const j = await kakaoFetch(
      `/v2/local/geo/coord2regioncode.json?x=${data.lng}&y=${data.lat}`,
    );
    const doc = j?.documents?.find((d: any) => d.region_type === "H") ?? j?.documents?.[0];
    if (!doc) return { name: null as string | null };
    const name = [doc.region_1depth_name, doc.region_2depth_name, doc.region_3depth_name]
      .filter(Boolean)
      .join(" ");
    return { name: name || null };
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
