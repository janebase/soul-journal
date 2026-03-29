export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { text, stage, selectedTag, reviewSource } = body;

  if (!text?.trim()) {
    return new Response(JSON.stringify({ error: "No text provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stageCtx = {
    1: "사용자가 오늘 하루 있었던 일을 자유롭게 적는 브레인덤프(1단계) 글입니다.",
    2: `사용자가 '${selectedTag || ""}' 주제에 대해 깊이 파고든 2단계 글입니다.`,
    3: `사용자가 ${reviewSource === "2" ? "2단계에서 깊이 파고든" : "1단계 브레인덤프"} 글을 다시 읽으며 영혼 확인 중(3단계)입니다.`,
  };

  const prompt = `${stageCtx[stage] || stageCtx[1]}

내 글:
"${text.slice(0, 800)}"

이 글을 읽고 두 가지를 해줘:
1. 이 글이 에고(껍데기, 누군가를 의식한 글) / 이너차일드(무의식, 반복되는 신념의 글) / 하이어셀프(영혼, 무아지경에서 나온 글) 중 어디서 나온 것 같은지 한 문장으로 짚어줘.
2. 그 다음 더 깊이 들어갈 수 있는 질문 하나만 해줘.

규칙: 판단하거나 가르치지 말고 부드럽게. 따뜻하지만 예리하게. 한국어로만. 총 3-4문장.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const reply = data.content?.[0]?.text || "잠시 후 다시 시도해주세요.";
    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "연결 실패" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = { path: "/api/ask-soul" };
