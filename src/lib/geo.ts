// Haversine distance in meters
export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface GeoPhoto {
  index: number; // 1-based photo number
  lat: number;
  lng: number;
}

export interface GeoCluster {
  centerLat: number;
  centerLng: number;
  photoIndices: number[]; // 1-based
}

// Group photos within thresholdMeters (default 50m) using a simple greedy Haversine cluster.
export function clusterByDistance(photos: GeoPhoto[], thresholdMeters = 50): GeoCluster[] {
  const clusters: GeoCluster[] = [];
  for (const p of photos) {
    const target = clusters.find(
      (c) => haversineMeters({ lat: c.centerLat, lng: c.centerLng }, { lat: p.lat, lng: p.lng }) <= thresholdMeters,
    );
    if (target) {
      target.photoIndices.push(p.index);
      // update centroid (running average)
      const n = target.photoIndices.length;
      target.centerLat = target.centerLat + (p.lat - target.centerLat) / n;
      target.centerLng = target.centerLng + (p.lng - target.centerLng) / n;
    } else {
      clusters.push({ centerLat: p.lat, centerLng: p.lng, photoIndices: [p.index] });
    }
  }
  return clusters;
}
