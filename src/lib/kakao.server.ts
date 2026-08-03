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

async function osmReverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lng),
      zoom: "18",
      addressdetails: "1",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Pickly/1.0 (https://pickly-photo.lovable.app)",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      name?: string;
      display_name?: string;
      address?: Record<string, string>;
    };
    const address = data.address ?? {};
    return (
      data.name ||
      address.amenity ||
      address.shop ||
      address.tourism ||
      address.building ||
      address.road ||
      address.neighbourhood ||
      address.suburb ||
      data.display_name?.split(",")[0]?.trim() ||
      null
    );
  } catch {
    return null;
  }
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
  if (doc) {
    const name = [doc.region_1depth_name, doc.region_2depth_name, doc.region_3depth_name]
      .filter(Boolean)
      .join(" ");
    if (name) return name;
  }

  // Kakao may reject Local API calls when the app's Map/Local product is not
  // enabled. Keep location-based ranking functional with a public reverse
  // geocoder until the Kakao app permission is enabled.
  return osmReverseGeocode(lat, lng);
}
