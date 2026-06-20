function jsonResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function compactMeasurements(rows = []) {
  return rows.slice(-200).map((row) => ({
    measuredAt: row.measuredAt,
    dorm: row.dorm,
    location: row.location,
    timeBand: row.timeBandReference,
    rainMm: row.rainMm,
    latencyMs: row.latencyMs,
    jitterMs: row.jitterMs,
    failurePct: row.failurePct,
    downloadMbps: row.downloadMbps,
    riskScore: row.riskScore,
    remoteSaved: row.remoteSaved,
  }));
}

function extractGeminiText(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || "").join("\n").trim();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse({ error: "POST only" }, 405);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "GEMINI_API_KEY 환경변수가 설정되지 않았습니다." }, 500);
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse({ error: "요청 JSON을 읽지 못했습니다." }, 400);
  }

  const measurements = compactMeasurements(payload.measurements || []);
  const question = String(payload.question || "").trim();
  const analysis = payload.analysis || {};

  if (!measurements.length) {
    return jsonResponse({
      text: "아직 Supabase에 저장된 측정 튜플이 없습니다. 먼저 여러 위치에서 측정하고 원격 기록을 불러온 뒤 AI 분석을 실행해 주세요.",
    });
  }

  const model = "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const prompt = [
    "너는 데이터 사이언스 팀 프로젝트의 네트워크 품질 분석 도우미다.",
    "반드시 제공된 측정 데이터와 기준값만 근거로 한국어로 답한다.",
    "데이터가 부족하면 부족하다고 말하고, 임의로 측정값을 지어내지 않는다.",
    "AP 설치 후보, 회피 시간대, 추가 측정 계획을 실무적으로 제안한다.",
    "",
    JSON.stringify(
      {
        userQuestion: question || "현재 측정 데이터를 분석해서 AP 설치 우선순위와 사용 추천 시간대를 알려줘.",
        stabilityThresholds: analysis.stabilityThresholds,
        sourceSummary: analysis.sourceSummary,
        measurements,
      },
      null,
      2,
    ),
  ].join("\n");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return jsonResponse({ error: data.error?.message || `Gemini API error: ${response.status}` }, response.status);
    }

    return jsonResponse({ text: extractGeminiText(data) || "분석 결과를 읽지 못했습니다." });
  } catch (error) {
    return jsonResponse({ error: `Gemini 분석 요청 실패: ${error.message}` }, 500);
  }
};
