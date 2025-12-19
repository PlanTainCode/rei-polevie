async function testAI() {
  const key = process.env.OPENROUTER_API_KEY;
  console.log('API Key exists:', !!key);
  console.log('API Key length:', key?.length || 0);
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      messages: [
        { role: 'user', content: 'Скажи просто "привет"' },
      ],
      max_tokens: 100,
    }),
  });

  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

testAI().catch(console.error);
