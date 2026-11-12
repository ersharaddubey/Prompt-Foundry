/**
 * OpenRouter free-model client with failover.
 * Used for: prompt enhance, safety, challenge ideas, battle helpers.
 */

const FREE_MODELS = [
  process.env.OPENROUTER_MODEL,
  'deepseek/deepseek-chat-v3-0324:free',
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-32b:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1:free',
].filter(Boolean);

// Deduplicate
const MODELS = [...new Set(FREE_MODELS)];

function keywordSafety(prompt) {
  const lower = (prompt || '').toLowerCase();
  const categories = {
    nsfw: ['nude', 'nsfw', 'explicit', 'porn', 'naked', 'sex', 'xxx'],
    violence: ['blood', 'gore', 'kill', 'murder', 'weapon', 'gun', 'knife'],
    hate: ['hate', 'racist', 'slur'],
  };
  const hits = {};
  let score = 100;
  for (const [cat, words] of Object.entries(categories)) {
    const found = words.filter((w) => lower.includes(w));
    hits[cat] = found;
    score -= found.length * 25;
  }
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    label: score >= 80 ? 'Safe' : score >= 50 ? 'Caution' : 'High risk',
    color: score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red',
    hits,
    source: 'keyword',
  };
}

function ruleEnhance(prompt) {
  let enhanced = prompt.trim();
  const lower = enhanced.toLowerCase();
  if (!lower.includes('detailed') && !lower.includes('8k')) {
    enhanced += ', highly detailed, sharp focus, 8k resolution';
  }
  if (!lower.includes('lighting') && !lower.includes('light')) {
    enhanced += ', professional lighting';
  }
  if (!lower.includes('composition')) {
    enhanced += ', balanced composition';
  }
  if (!lower.includes('masterpiece') && !lower.includes('best quality')) {
    enhanced = `masterpiece, best quality, ${enhanced}`;
  }
  return enhanced;
}

/**
 * Call OpenRouter chat with automatic model failover on 429 / errors.
 */
export async function openRouterChat(messages, { temperature = 0.7, maxTokens = 512 } = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return { ok: false, error: 'OPENROUTER_API_KEY not set', content: null, model: null };
  }

  let lastError = null;
  for (const model of MODELS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'https://somyalaya.app',
          'X-Title': 'Somyalaya Prompt Foundry',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (res.status === 429) {
        lastError = `rate limited: ${model}`;
        continue;
      }
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        lastError = `HTTP ${res.status} ${model}: ${t.slice(0, 120)}`;
        // try next model on 4xx/5xx except auth
        if (res.status === 401 || res.status === 403) {
          return { ok: false, error: 'OpenRouter auth failed — check OPENROUTER_API_KEY', content: null, model };
        }
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim() || '';
      if (!content) {
        lastError = `empty response: ${model}`;
        continue;
      }
      return { ok: true, content, model, error: null };
    } catch (e) {
      lastError = e.message;
      continue;
    }
  }

  return { ok: false, error: lastError || 'All OpenRouter free models failed', content: null, model: null };
}

export async function enhancePromptLLM(prompt) {
  const result = await openRouterChat(
    [
      {
        role: 'system',
        content:
          'You are an expert AI image prompt engineer. Improve the user prompt for Flux/SD image generation. Add lighting, composition, style, quality tags. Keep the original subject. Reply with ONLY the improved prompt, no quotes or explanation.',
      },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.75, maxTokens: 300 }
  );

  if (result.ok) {
    return {
      original: prompt.trim(),
      enhanced: result.content.replace(/^["']|["']$/g, '').trim(),
      source: 'openrouter',
      model: result.model,
      tips: ['Enhanced with OpenRouter free LLM', `Model: ${result.model}`],
    };
  }

  // Fallback rule-based
  const enhanced = ruleEnhance(prompt);
  const safety = keywordSafety(prompt);
  return {
    original: prompt.trim(),
    enhanced,
    source: 'rules',
    model: null,
    tips: ['OpenRouter unavailable — used rule-based enhancer', result.error || ''],
    safetyScore: safety.score,
    safetyLabel: safety.label,
  };
}

export async function safetyScoreLLM(prompt) {
  const result = await openRouterChat(
    [
      {
        role: 'system',
        content: `You moderate prompts for a public AI image app. Reply with ONLY valid JSON (no markdown):
{"score":0-100,"label":"Safe"|"Caution"|"High risk","reasons":["..."],"safeRewrite":"optional safer version if score<80"}
score 100 = fully safe, 0 = very unsafe.`,
      },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.2, maxTokens: 250 }
  );

  if (result.ok) {
    try {
      let raw = result.content;
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
      const parsed = JSON.parse(raw);
      const score = Math.max(0, Math.min(100, Number(parsed.score) || 50));
      return {
        score,
        label: parsed.label || (score >= 80 ? 'Safe' : score >= 50 ? 'Caution' : 'High risk'),
        color: score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red',
        hits: { reasons: parsed.reasons || [] },
        safeRewrite: parsed.safeRewrite || null,
        source: 'openrouter',
        model: result.model,
      };
    } catch (_) {
      // fall through to keyword
    }
  }

  return { ...keywordSafety(prompt), model: null };
}

export async function challengeIdeasLLM(theme) {
  const result = await openRouterChat(
    [
      {
        role: 'system',
        content:
          'You invent creative AI image prompts. Given a daily challenge theme, return ONLY a JSON array of exactly 5 short image prompts (strings). No markdown.',
      },
      { role: 'user', content: `Theme: ${theme}` },
    ],
    { temperature: 0.9, maxTokens: 400 }
  );

  if (result.ok) {
    try {
      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const arr = JSON.parse(jsonMatch[0]);
        if (Array.isArray(arr) && arr.length) {
          return { ideas: arr.slice(0, 5).map(String), source: 'openrouter', model: result.model };
        }
      }
    } catch (_) {}
  }

  // fallback static ideas
  return {
    ideas: [
      `${theme}, cinematic lighting, highly detailed, 8k`,
      `${theme}, dramatic atmosphere, golden hour, masterpiece`,
      `${theme}, wide angle, epic composition, ultra realistic`,
      `${theme}, moody colors, shallow depth of field`,
      `${theme}, fantasy art style, intricate details`,
    ],
    source: 'fallback',
    model: null,
  };
}

export async function battleCommentLLM(promptA, promptB) {
  const result = await openRouterChat(
    [
      {
        role: 'system',
        content:
          'Compare two AI image prompts for creativity and clarity. Reply ONLY JSON: {"winner":"A"|"B"|"tie","comment":"one short sentence"}',
      },
      { role: 'user', content: `Prompt A: ${promptA}\n\nPrompt B: ${promptB}` },
    ],
    { temperature: 0.5, maxTokens: 150 }
  );

  if (result.ok) {
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { ...parsed, source: 'openrouter', model: result.model };
      }
    } catch (_) {}
  }

  return { winner: 'tie', comment: 'Both prompts look strong — community votes decide.', source: 'fallback', model: null };
}

export async function imageHintPromptsLLM(hint = '') {
  const result = await openRouterChat(
    [
      {
        role: 'system',
        content:
          'Generate image-generation prompts. Reply ONLY a JSON array of 4 detailed prompts. If a hint is given, follow it.',
      },
      {
        role: 'user',
        content: hint?.trim()
          ? `Create 4 strong image prompts related to: ${hint}`
          : 'Create 4 strong general artistic image prompts suitable for Flux AI',
      },
    ],
    { temperature: 0.85, maxTokens: 400 }
  );

  if (result.ok) {
    try {
      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const arr = JSON.parse(jsonMatch[0]);
        if (Array.isArray(arr)) return arr.slice(0, 4).map(String);
      }
    } catch (_) {}
  }

  const base = hint?.trim() || 'A high quality photograph, detailed subject, natural lighting';
  return [
    base,
    `${base}, cinematic color grading, shallow depth of field`,
    `${base}, soft ambient light, 85mm lens, bokeh`,
    `${base}, dramatic lighting, ultra detailed, 8k`,
  ];
}

export { keywordSafety, ruleEnhance, MODELS as OPENROUTER_FREE_MODELS };
