const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export async function generateSoftwareCopy({ apiKey, name, tagline, notes }) {
  if (!apiKey?.trim()) {
    throw new Error('Add your Groq API key in Admin → Settings first.');
  }

  const prompt = `You write product copy for ShiftZero desktop software posts.
Software name: ${name || 'Untitled'}
Tagline hint: ${tagline || 'n/a'}
Owner notes: ${notes || 'n/a'}

Return ONLY valid JSON with this shape:
{
  "tagline": "one short sentence under 90 chars",
  "description": "2-3 sentences, clear, no hype spam, free forever / on-device / Windows",
  "features": ["key point 1", "key point 2", "key point 3", "key point 4"]
}`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a concise product copywriter. Output JSON only.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq error (${res.status}): ${errText.slice(0, 180)}`);
  }

  const payload = await res.json();
  const raw = payload?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);

  return {
    tagline: String(parsed.tagline || '').trim(),
    description: String(parsed.description || '').trim(),
    features: Array.isArray(parsed.features)
      ? parsed.features.map((f) => String(f).trim()).filter(Boolean).slice(0, 6)
      : []
  };
}
