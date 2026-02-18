import * as mammoth from 'mammoth';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

async function testExtraction() {
  const file = 'templates/тз/ТЗ ИЭИ. Корпус 3 Синдика.docx';
  const buffer = await readFile(join(process.cwd(), file));
  const { value: text } = await mammoth.extractRawText({ buffer });
  
  console.log('=== ТЕКСТ ТЗ (первые 2000 символов) ===\n');
  console.log(text.substring(0, 2000));
  
  console.log('\n\n=== ЗАПРОС К DeepSeek AI ===\n');
  
  const systemPrompt = `Ты — эксперт по инженерным изысканиям в России. Извлеки данные из ТЗ и верни ТОЛЬКО валидный JSON.`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Извлеки данные из технического задания:\n\n${text}` },
      ],
      temperature: 0.1,
      max_tokens: 8000,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log('=== ОТВЕТ DeepSeek AI ===\n');
  console.log(content);
  
  await writeFile('scripts/extraction-result.json', content);
  console.log('\n\nРезультат сохранён в scripts/extraction-result.json');
}

testExtraction().catch(console.error);
