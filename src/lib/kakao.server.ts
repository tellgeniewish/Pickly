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
 * lat/lng -> human readable place name.
 * Primary: Kakao Local "좌표 -> 행정구역정보" (coord2regioncode) — the API the
 * product spec is built on. Then the nearest POI, then OSM as a last resort.
 */
export async function resolvePlaceName(lat: number, lng: number): Promise<string | null> {
  // 1) Kakao coord2regioncode: 행정동 기준 지역명 (예: "성수동1가")
  const region = await kakaoFetch(`/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`);
  const rdoc = region?.documents?.find((d: any) => d.region_type === "H") ?? region?.documents?.[0];
  const regionName = rdoc
    ? (rdoc.region_3depth_name || rdoc.region_2depth_name || rdoc.address_name || null)
    : null;

  // 2) Nearby POI (예: "서울숲") — more recognisable than a 행정동 when available.
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
  if (regionName) return regionName;

  // Kakao may reject Local API calls when the app's Map/Local product is not
  // enabled. Keep location-based ranking functional with a public reverse
  // geocoder until the Kakao app permission is enabled.
  return osmReverseGeocode(lat, lng);
}


/**
 * Place photo for a spot name. User-uploaded photos are personal data and must
 * never be shown publicly, so the home ranking uses a photo *of the place*.
 * Kakao Daum image search works with the same REST key we already have.
 */
export async function fetchPlacePhoto(placeName: string): Promise<string | null> {
  const queries = [`${placeName} 풍경`, placeName];
  for (const q of queries) {
    const j = await kakaoFetch(
      `/v2/search/image?query=${encodeURIComponent(q)}&sort=accuracy&size=10`,
    );
    const docs: any[] = j?.documents ?? [];
    const hit = docs.find((d) => d?.image_url && Number(d.width ?? 0) >= 640) ?? docs[0];
    const url = hit?.image_url || hit?.thumbnail_url;
    if (url) return url as string;
  }
  return null;
}
