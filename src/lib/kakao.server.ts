// Server-only Kakao Local helpers. Imported by server functions (never by client code).

const KAKAO_BASE = "https://dapi.kakao.com";

function getKey(): string | null {
  return process.env["KAKAO_REST_API_KEY"] || null;
}

export async function kakaoFetch(path: string): Promise<any | null> {
  const key = getKey();
  if (!key) return null;
  const res = await fetch(`${KAKAO_BASE}${path}`, {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * lat/lng -> nearest POI place name (e.g. "서울숲"), falling back to the
 * administrative region name. Returns null only when Kakao is unreachable.
 */
export async function resolvePlaceName(lat: number, lng: number): Promise<string | null> {
  const codes = ["AT4", "CE7", "FD6", "CT1", "CS2", "SW8", "PS3", "HP8", "AC5", "PK6", "OL7"];
  let best: { name: string; dist: number } | null = null;
  for (const code of codes) {
    const j = await kakaoFetch(
      `/v2/local/search/category.json?category_group_code=${code}&x=${lng}&y=${lat}&radius=500&sort=distance&size=1`,
    );
    const doc = j?.documents?.[0];
    if (doc?.place_name) {
      const dist = Number(doc.distance ?? 0);
      if (!best || dist < best.dist) best = { name: doc.place_name as string, dist };
      if (dist < 30) break;
    }
  }
  if (best) return best.name;

  const j = await kakaoFetch(`/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`);
  const doc = j?.documents?.find((d: any) => d.region_type === "H") ?? j?.documents?.[0];
  if (!doc) return null;
  const name = [doc.region_1depth_name, doc.region_2depth_name, doc.region_3depth_name]
    .filter(Boolean)
    .join(" ");
  return name || null;
}
