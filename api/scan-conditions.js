export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { pdf_base64 } = req.body;
  if (!pdf_base64) return res.status(400).json({ error: 'No PDF provided' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdf_base64
              }
            },
            {
              type: 'text',
              text: `Read this planning decision notice. Extract ONLY the conditions that are the direct responsibility of the architect or architectural technologist. Include conditions relating to: materials, external appearance, drawings to be submitted for approval, design details, hard landscaping, boundary treatments, lighting design, signage design, and pre-commencement architectural submissions.

EXCLUDE conditions relating to: highways, ecology, drainage, archaeology, noise, contamination, construction management plans, community infrastructure levy, affordable housing, and other non-architectural matters.

Return ONLY a JSON array with no other text, no markdown, no explanation. Each item should have:
- number: the condition number as a string
- title: a short title (max 8 words)
- description: a single clear sentence describing what is required
- pre_commencement: true if the condition must be discharged before development commences, false otherwise
- discharge_required: true if a formal discharge application to the LPA is required

Example format:
[{"number":"3","title":"External materials to be agreed","description":"Samples of all external materials to be submitted to and approved by the LPA before construction commences.","pre_commencement":true,"discharge_required":true}]

If no architecturally relevant conditions exist, return an empty array: []`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || 'Claude API error' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '[]';

    // Strip any markdown fences if present
    const clean = text.replace(/```json\n?|\n?```/g, '').trim();
    const conditions = JSON.parse(clean);

    return res.status(200).json(conditions);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
