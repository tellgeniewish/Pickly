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

export type KakaoLocalError = "no_key" | "service_disabled" | "request_failed" | null;

export interface PlaceHit {
  placeName: string;
  addressName: string | null;
  lat: number;
  lng: number;
}

/**
 * Keyword place search (카카오 Local - 키워드로 장소 검색).
 * POI search, not address search: "아임파이" → "아임파이 외대본점".
 * Tries a location-biased search first, then a nationwide search so that a
 * cafe far from the EXIF coordinate is still findable.
 */
export async function searchPlacesByKeyword(
  query: string,
  lat?: number,
  lng?: number,
): Promise<{ places: PlaceHit[]; error: KakaoLocalError }> {
  const key = getKey();
  if (!key) return { places: [], error: "no_key" };

  const attempts: URLSearchParams[] = [];
  if (lat != null && lng != null) {
    attempts.push(
      new URLSearchParams({
        query,
        size: "10",
        x: String(lng),
        y: String(lat),
        radius: "20000",
        sort: "distance",
      }),
    );
  }
  attempts.push(new URLSearchParams({ query, size: "10" }));

  let error: KakaoLocalError = null;
  for (const params of attempts) {
    const res = await fetch(`${KAKAO_BASE}/v2/local/search/keyword.json?${params.toString()}`, {
      headers: { Authorization: `KakaoAK ${key}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      error = res.status === 401 || res.status === 403
        ? body.includes("OPEN_MAP_AND_LOCAL")
          ? "service_disabled"
          : "request_failed"
        : "request_failed";
      continue;
    }
    const j = (await res.json()) as { documents?: any[] };
    const docs = j.documents ?? [];
    if (docs.length > 0) {
      return {
        places: docs.map((d) => ({
          placeName: String(d.place_name ?? ""),
          addressName: (d.road_address_name || d.address_name || null) as string | null,
          lat: Number(d.y),
          lng: Number(d.x),
        })),
        error: null,
      };
    }
    error = null;
  }
  return { places: [], error };
}

export interface PlaceDetail {
  placeName: string;
  roadAddress: string | null;
  address: string | null;
  placeUrl: string | null;
  placeId: string | null;
  lat: number;
  lng: number;
}

/**
 * Detail for a known spot: we already have accurate coordinates from EXIF
 * clustering, so the keyword search is only used to enrich the spot with
 * addresses + the Kakao Map place URL. Among several hits we pick the one
 * closest to the stored coordinate instead of blindly taking the first.
 */
export async function fetchPlaceDetail(
  name: string,
  lat: number,
  lng: number,
): Promise<PlaceDetail | null> {
  const params = new URLSearchParams({
    query: name,
    size: "10",
    x: String(lng),
    y: String(lat),
    radius: "20000",
    sort: "distance",
  });
  const j = await kakaoFetch(`/v2/local/search/keyword.json?${params.toString()}`);
  const docs: any[] = j?.documents ?? [];
  if (docs.length === 0) return null;
  const { haversineMeters } = await import("./geo");
  const best = docs
    .map((d) => ({
      d,
      dist: haversineMeters({ lat, lng }, { lat: Number(d.y), lng: Number(d.x) }),
    }))
    .sort((a, b) => a.dist - b.dist)[0]!.d;
  return {
    placeName: String(best.place_name ?? name),
    roadAddress: (best.road_address_name || null) as string | null,
    address: (best.address_name || null) as string | null,
    placeUrl: (best.place_url || null) as string | null,
    placeId: (best.id ?? null) as string | null,
    lat: Number(best.y) || lat,
    lng: Number(best.x) || lng,
  };
}

/** Kakao static map (REST, server-side key) used when no JS map key is configured. */
export async function fetchStaticMap(lat: number, lng: number): Promise<string | null> {
  const key = getKey();
  if (!key) return null;
  try {
    const url = `${KAKAO_BASE}/v2/maps/staticmap?markers=type:d|size:mid|pos:${lng} ${lat}&level=4&MAPTYPE=ROADMAP&IW=640&IH=480`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
    const b64 = typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(buf).toString("base64");
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}
