import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SIGNED_URL_TTL = 60 * 60 * 24; // 24h

// ---------- createVote ----------
// Photos are already uploaded to storage under {userId}/{voteId}/{idx}.{ext}.
// Client sends the paths after uploading via the authenticated supabase client.
export const createVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(1).max(200),
        locationName: z.string().max(120).nullable().optional(),
        useLocation: z.boolean().optional(),
        deadlineHours: z.number().int().min(1).max(720),
        photos: z
          .array(
            z.object({
              path: z.string().min(1),
              lat: z.number().nullable().optional(),
              lng: z.number().nullable().optional(),
            }),
          )
          .min(2)
          .max(10),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const useLocation = data.useLocation !== false;

    // Resolve the location name on the SERVER so a flaky client-side geocode can
    // never leave the vote without a location (which would drop it from the
    // popular-spot ranking).
    let locationName = useLocation ? (data.locationName?.trim() || null) : null;
    if (useLocation && !locationName) {
      const withGps = data.photos.find((p) => p.lat != null && p.lng != null);
      if (withGps?.lat != null && withGps.lng != null) {
        const { resolvePlaceName } = await import("./kakao.server");
        locationName = await resolvePlaceName(withGps.lat, withGps.lng);
      }
    }

    const closesAt = new Date(Date.now() + data.deadlineHours * 3600 * 1000).toISOString();
    const { data: vote, error } = await supabase
      .from("votes")
      .insert({
        owner_id: userId,
        title: data.title,
        location_name: locationName,
        use_location: useLocation,
        deadline_hours: data.deadlineHours,
        closes_at: closesAt,
      })
      .select("id")
      .single();
    if (error || !vote) throw new Error(error?.message ?? "투표 생성 실패");

    const rows = data.photos.map((p, i) => ({
      vote_id: vote.id,
      storage_path: p.path,
      order_index: i,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
    }));
    const { error: pErr } = await supabase.from("vote_photos").insert(rows);
    if (pErr) throw new Error(pErr.message);
    return { id: vote.id };
  });


// ---------- getVote (public) ----------
export const getVote = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: vote, error } = await supabaseAdmin
      .from("votes")
      .select("id, title, location_name, closes_at, created_at, owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!vote) return null;
    const { data: photos } = await supabaseAdmin
      .from("vote_photos")
      .select("id, storage_path, order_index")
      .eq("vote_id", data.id)
      .order("order_index");
    const paths = (photos ?? []).map((p) => p.storage_path);
    const { data: signed } = await supabaseAdmin.storage
      .from("vote-photos")
      .createSignedUrls(paths, SIGNED_URL_TTL);
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    return {
      vote,
      photos: (photos ?? []).map((p) => ({
        id: p.id,
        url: byPath.get(p.storage_path) ?? "",
        order_index: p.order_index,
      })),
    };
  });

// ---------- submitVote (public, anonymous) ----------
export const submitVote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        voteId: z.string().uuid(),
        anonKey: z.string().min(8).max(64),
        displayName: z.string().max(40).nullable().optional(),
        choices: z
          .array(z.object({ photoId: z.string().uuid(), liked: z.boolean() }))
          .min(1)
          .max(20),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Find-or-create the session. Concurrent submits (double-tap / swipe + click on the
    // last card) can race here, so a unique-violation is treated as "someone else won" and
    // we simply re-read the existing row instead of failing the request.
    const findSession = async () => {
      const { data: row } = await supabaseAdmin
        .from("vote_sessions")
        .select("id")
        .eq("vote_id", data.voteId)
        .eq("anon_key", data.anonKey)
        .maybeSingle();
      return row?.id ?? null;
    };

    let sessionId = await findSession();
    if (!sessionId) {
      const { data: created, error } = await supabaseAdmin
        .from("vote_sessions")
        .insert({
          vote_id: data.voteId,
          anon_key: data.anonKey,
          display_name: data.displayName ?? null,
        })
        .select("id")
        .single();
      if (created) sessionId = created.id;
      else {
        sessionId = await findSession();
        if (!sessionId) throw new Error(error?.message ?? "세션 생성 실패");
      }
    }

    // Dedupe by photo_id (last choice wins) so a duplicated swipe can never violate
    // vote_choices_session_id_photo_id_key.
    const byPhoto = new Map<string, boolean>();
    for (const c of data.choices) byPhoto.set(c.photoId, c.liked);
    const rows = Array.from(byPhoto, ([photo_id, liked]) => ({
      session_id: sessionId!,
      photo_id,
      liked,
    }));
    // Upsert (not insert) so re-submitting the same session is idempotent.
    const { error: cErr } = await supabaseAdmin
      .from("vote_choices")
      .upsert(rows, { onConflict: "session_id,photo_id", ignoreDuplicates: false });
    // A concurrent duplicate submit is a no-op, not a failure: the rows are identical.
    if (cErr && (cErr as { code?: string }).code !== "23505") throw new Error(cErr.message);
    return { ok: true, sessionId };
  });

// ---------- getVoteResults (public) ----------
export const getVoteResults = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: vote } = await supabaseAdmin
      .from("votes")
      .select("id, title, location_name, closes_at, created_at, owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!vote) return null;

    const { data: photos } = await supabaseAdmin
      .from("vote_photos")
      .select("id, storage_path, order_index")
      .eq("vote_id", data.id)
      .order("order_index");
    const photoIds = (photos ?? []).map((p) => p.id);
    const { data: choices } = await supabaseAdmin
      .from("vote_choices")
      .select("photo_id, liked")
      .in("photo_id", photoIds.length ? photoIds : ["00000000-0000-0000-0000-000000000000"]);
    const { count: participantCount } = await supabaseAdmin
      .from("vote_sessions")
      .select("*", { count: "exact", head: true })
      .eq("vote_id", data.id);

    const tally = new Map<string, { likes: number; total: number }>();
    for (const c of choices ?? []) {
      const t = tally.get(c.photo_id) ?? { likes: 0, total: 0 };
      t.total += 1;
      if (c.liked) t.likes += 1;
      tally.set(c.photo_id, t);
    }

    const paths = (photos ?? []).map((p) => p.storage_path);
    const { data: signed } = await supabaseAdmin.storage
      .from("vote-photos")
      .createSignedUrls(paths, SIGNED_URL_TTL);
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

    const ranked = (photos ?? [])
      .map((p) => {
        const t = tally.get(p.id) ?? { likes: 0, total: 0 };
        const rate = t.total > 0 ? t.likes / t.total : 0;
        return {
          id: p.id,
          url: byPath.get(p.storage_path) ?? "",
          likes: t.likes,
          total: t.total,
          rate,
        };
      })
      .sort((a, b) => b.rate - a.rate || b.likes - a.likes);

    const { data: ai } = await supabaseAdmin
      .from("ai_analyses")
      .select("summary, space_keywords, top_analysis, created_at")
      .eq("vote_id", data.id)
      .maybeSingle();

    return {
      vote,
      participantCount: participantCount ?? 0,
      ranked,
      ai,
    };
  });

// ---------- runAiAnalysis ----------
// Idempotent: the analysis is stored in ai_analyses and reused forever unless
// `force` is passed, so viewers never spend extra AI calls re-analysing.
export const runAiAnalysis = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), force: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { analyzeVote } = await import("./ai-analysis.server");

    if (!data.force) {
      const { data: cached } = await supabaseAdmin
        .from("ai_analyses")
        .select("summary, space_keywords, top_analysis")
        .eq("vote_id", data.id)
        .maybeSingle();
      if (cached?.summary) {
        return {
          summary: cached.summary,
          space_keywords: (cached.space_keywords ?? []) as string[],
          top_analysis: (cached.top_analysis ?? []) as Record<string, string | number>[],
        };
      }
    }

    const { data: vote } = await supabaseAdmin
      .from("votes")
      .select("id, title, location_name")
      .eq("id", data.id)
      .maybeSingle();
    if (!vote) throw new Error("투표를 찾을 수 없어요.");

    const { data: photos } = await supabaseAdmin
      .from("vote_photos")
      .select("id, storage_path")
      .eq("vote_id", data.id);
    const photoIds = (photos ?? []).map((p) => p.id);
    if (photoIds.length === 0) throw new Error("사진이 없어요.");

    const { data: choices } = await supabaseAdmin
      .from("vote_choices")
      .select("photo_id, liked")
      .in("photo_id", photoIds);

    const tally = new Map<string, { likes: number; total: number }>();
    for (const c of choices ?? []) {
      const t = tally.get(c.photo_id) ?? { likes: 0, total: 0 };
      t.total += 1;
      if (c.liked) t.likes += 1;
      tally.set(c.photo_id, t);
    }
    if ((choices ?? []).length === 0) throw new Error("아직 표가 없어요. 친구들에게 링크를 보내주세요.");

    const ranked = (photos ?? [])
      .map((p) => ({
        id: p.id,
        storage_path: p.storage_path,
        rate: (tally.get(p.id)?.likes ?? 0) / Math.max(1, tally.get(p.id)?.total ?? 0),
      }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 3);

    const { data: signed } = await supabaseAdmin.storage
      .from("vote-photos")
      .createSignedUrls(
        ranked.map((r) => r.storage_path),
        SIGNED_URL_TTL,
      );
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

    const analysis = await analyzeVote({
      title: vote.title,
      locationName: vote.location_name,
      topPhotos: ranked.map((r, i) => ({
        rank: i + 1,
        imageUrl: byPath.get(r.storage_path) ?? "",
        likeRate: r.rate,
      })),
    });

    await supabaseAdmin.from("ai_analyses").upsert(
      {
        vote_id: data.id,
        summary: analysis.summary,
        space_keywords: analysis.space_keywords,
        top_analysis: analysis.top_analysis,
      },
      { onConflict: "vote_id" },
    );
    return analysis;
  });

// ---------- listMyVotes ----------
export const listMyVotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: votes, error } = await supabase
      .from("votes")
      .select("id, title, created_at, closes_at, location_name")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (votes ?? []).map((v) => v.id);
    if (ids.length === 0) return { active: [], ended: [], stats: { total: 0, votesReceived: 0 } };

    const { data: sessions } = await supabase
      .from("vote_sessions")
      .select("vote_id")
      .in("vote_id", ids);
    const counts = new Map<string, number>();
    for (const s of sessions ?? []) counts.set(s.vote_id, (counts.get(s.vote_id) ?? 0) + 1);

    const now = Date.now();
    const enriched = (votes ?? []).map((v) => ({
      id: v.id,
      title: v.title,
      participants: counts.get(v.id) ?? 0,
      closesAt: v.closes_at,
      active: new Date(v.closes_at).getTime() > now,
    }));
    return {
      active: enriched.filter((v) => v.active),
      ended: enriched.filter((v) => !v.active),
      stats: {
        total: enriched.length,
        votesReceived: Array.from(counts.values()).reduce((a, b) => a + b, 0),
      },
    };
  });

// ---------- getHomeStats (public) ----------
export const getHomeStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count: sessionsCount } = await supabaseAdmin
    .from("vote_sessions")
    .select("*", { count: "exact", head: true });
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count: todayVotes } = await supabaseAdmin
    .from("votes")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfDay.toISOString());
  return {
    totalParticipants: sessionsCount ?? 0,
    votesToday: todayVotes ?? 0,
  };
});

// ---------- getTopSpots (public) ----------
// Ranks real user vote locations by total likes received. Top 3 only.
// Only votes that opted into location usage have a location_name, so opting out
// keeps a vote out of this ranking entirely.
export const getTopSpots = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: allVotes } = await supabaseAdmin
    .from("votes")
    .select("id, location_name, use_location");
  if (!allVotes || allVotes.length === 0)
    return [] as { name: string; likes: number; recommend: number }[];

  const eligible = allVotes.filter((v) => v.use_location !== false);
  const voteIds = eligible.map((v) => v.id);
  if (voteIds.length === 0) return [];

  const { data: photos } = await supabaseAdmin
    .from("vote_photos")
    .select("id, vote_id, lat, lng")
    .in("vote_id", voteIds);
  const photoIds = (photos ?? []).map((p) => p.id);
  if (photoIds.length === 0) return [];

  const { data: choices } = await supabaseAdmin
    .from("vote_choices")
    .select("photo_id, liked")
    .in("photo_id", photoIds);

  // Rank the locations of the actual photos, not one location copied onto the
  // whole vote. Photos within 50m are one spot, matching the create screen.
  const gpsPhotos = (photos ?? []).filter(
    (p): p is typeof p & { lat: number; lng: number } => p.lat != null && p.lng != null,
  );
  if (gpsPhotos.length === 0) return [];
  const choiceCounts = new Map<string, { likes: number; total: number }>();
  for (const choice of choices ?? []) {
    const count = choiceCounts.get(choice.photo_id) ?? { likes: 0, total: 0 };
    count.total += 1;
    if (choice.liked) count.likes += 1;
    choiceCounts.set(choice.photo_id, count);
  }

  const { haversineMeters } = await import("./geo");
  const clusters: Array<{ lat: number; lng: number; count: number; likes: number; total: number }> = [];
  for (const photo of gpsPhotos) {
    const counts = choiceCounts.get(photo.id);
    if (!counts) continue;
    const cluster = clusters.find(
      (item) => haversineMeters({ lat: item.lat, lng: item.lng }, photo) <= 50,
    );
    if (cluster) {
      cluster.count += 1;
      cluster.lat += (photo.lat - cluster.lat) / cluster.count;
      cluster.lng += (photo.lng - cluster.lng) / cluster.count;
      cluster.likes += counts.likes;
      cluster.total += counts.total;
    } else {
      clusters.push({ lat: photo.lat, lng: photo.lng, count: 1, ...counts });
    }
  }

  const top = clusters
    .filter((item) => item.likes > 0)
    .sort((a, b) => b.likes - a.likes || b.likes / b.total - a.likes / a.total)
    .slice(0, 3);
  const { resolvePlaceName } = await import("./kakao.server");
  return Promise.all(
    top.map(async (item) => ({
      name: (await resolvePlaceName(item.lat, item.lng)) ?? `${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`,
      likes: item.likes,
      recommend: Math.round((item.likes / item.total) * 100),
    })),
  );
});
