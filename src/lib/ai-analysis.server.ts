/**
 * Lovable AI Gateway helper — server only.
 * Calls Gemini Vision to analyze the top-ranked photos of a vote.
 */

export interface TopPhotoInput {
  rank: number;
  imageUrl: string; // publicly reachable signed URL
  likeRate: number; // 0..1
}

export interface AiAnalysisResult {
  summary: string;
  space_keywords: string[];
  top_analysis: Array<{
    rank: number;
    구도: string;
    표정: string;
    색감: string;
    배경: string;
    조명: string;
  }>;
}

export async function analyzeVote(params: {
  title: string;
  locationName: string | null;
  topPhotos: TopPhotoInput[];
}): Promise<AiAnalysisResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
  if (params.topPhotos.length === 0) {
    return { summary: "아직 표가 부족해요.", space_keywords: [], top_analysis: [] };
  }

  const systemPrompt = `당신은 사진 큐레이터입니다. 인스타/프로필/썸네일용 사진을 평가합니다.
사용자가 여러 장의 사진을 올려 친구들에게 투표를 받았고, 이제 상위 3장을 분석합니다.
반드시 다음 JSON 스키마를 정확히 지키세요. 다른 텍스트는 금지.
{
  "summary": string,                       // 왜 좋은 반응을 얻었는지 2-3문장 (한국어)
  "space_keywords": string[],              // 위치/분위기 키워드 3~5개 (예: 감성, 노을, 자연광)
  "top_analysis": [ {                       // 각 사진별 분석 (rank 순서대로)
    "rank": number,
    "구도": string,
    "표정": string,
    "색감": string,
    "배경": string,
    "조명": string
  } ]
}`;

  const userText = `투표 제목: ${params.title}
${params.locationName ? `위치: ${params.locationName}` : ""}
상위 ${params.topPhotos.length}장의 사진과 추천율:
${params.topPhotos.map((p) => `- ${p.rank}위 (추천율 ${Math.round(p.likeRate * 100)}%)`).join("\n")}

위 순서대로 첨부한 이미지를 보고 분석해주세요.`;

  const content: Array<Record<string, unknown>> = [{ type: "text", text: userText }];
  for (const p of params.topPhotos) {
    content.push({ type: "image_url", image_url: { url: p.imageUrl } });
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "raw-fetch",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI 사용량 한도에 도달했어요. 잠시 후 다시 시도해주세요.");
    if (res.status === 402) throw new Error("AI 크레딧이 부족해요. 워크스페이스 결제를 확인해주세요.");
    throw new Error(`AI 분석 실패 (${res.status}): ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: AiAnalysisResult;
  try {
    parsed = JSON.parse(raw) as AiAnalysisResult;
  } catch {
    throw new Error("AI 응답 파싱에 실패했어요.");
  }
  return {
    summary: parsed.summary ?? "",
    space_keywords: Array.isArray(parsed.space_keywords) ? parsed.space_keywords.slice(0, 6) : [],
    top_analysis: Array.isArray(parsed.top_analysis) ? parsed.top_analysis : [],
  };
}
