import { NextRequest } from 'next/server';
import { secretsManager } from '@/lib/secrets-manager';

interface StreamTranslationRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  provider?: string;
  context?: string;
  apiKey?: string;
}

export async function POST(request: NextRequest) {
  const body: StreamTranslationRequest = await request.json();
  const { 
    text, 
    targetLanguage, 
    sourceLanguage = 'auto', 
    provider = 'openai', 
    context,
    apiKey: userApiKey 
  } = body;

  if (!text || !targetLanguage) {
    return new Response('Missing required fields', { status: 400 });
  }

  // Initialize secrets
  await secretsManager.initialize();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const systemPrompt = `You are a professional translator specializing in video game localization.
Translate the following text from ${sourceLanguage} to ${targetLanguage}.
${context ? `Context: ${context}` : ''}

IMPORTANT: Output ONLY the translated text, nothing else. No explanations, no quotes, just the translation.`;

        let apiUrl: string;
        let headers: Record<string, string>;
        let body: any;

        switch (provider) {
          case 'openai':
          case 'gpt5': {
            const apiKey = secretsManager.get('OPENAI_API_KEY');
            if (!apiKey) throw new Error('OpenAI API key not configured');
            
            apiUrl = 'https://api.openai.com/v1/chat/completions';
            headers = {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            };
            body = {
              model: provider === 'gpt5' ? 'gpt-4o' : 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
              ],
              temperature: 0.3,
              stream: true
            };
            break;
          }
          
          case 'claude': {
            const apiKey = userApiKey || secretsManager.get('ANTHROPIC_API_KEY');
            if (!apiKey) throw new Error('Anthropic API key not configured');
            
            apiUrl = 'https://api.anthropic.com/v1/messages';
            headers = {
              'x-api-key': apiKey,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01',
            };
            body = {
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 4096,
              system: systemPrompt,
              messages: [{ role: 'user', content: text }],
              stream: true
            };
            break;
          }
          
          case 'gemini': {
            const apiKey = userApiKey || secretsManager.get('GEMINI_API_KEY');
            if (!apiKey) throw new Error('Gemini API key not configured');
            
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${apiKey}`;
            headers = { 'Content-Type': 'application/json' };
            body = {
              contents: [{
                parts: [{ text: `${systemPrompt}\n\nText to translate:\n${text}` }]
              }],
              generationConfig: { temperature: 0.3 }
            };
            break;
          }
          
          case 'deepseek': {
            const apiKey = secretsManager.get('DEEPSEEK_API_KEY');
            if (!apiKey) throw new Error('DeepSeek API key not configured');
            
            apiUrl = 'https://api.deepseek.com/v1/chat/completions';
            headers = {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            };
            body = {
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
              ],
              temperature: 0.3,
              stream: true
            };
            break;
          }
          
          default:
            throw new Error(`Streaming not supported for provider: ${provider}`);
        }

        // Send start event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', provider })}\n\n`));

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error ${response.status}: ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || line.startsWith(':')) continue;
            
            const dataMatch = line.match(/^data: (.+)$/);
            if (!dataMatch) continue;
            
            const data = dataMatch[1];
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              let chunk = '';

              // OpenAI/DeepSeek format
              if (parsed.choices?.[0]?.delta?.content) {
                chunk = parsed.choices[0].delta.content;
              }
              // Claude format
              else if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                chunk = parsed.delta.text;
              }
              // Gemini format
              else if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                chunk = parsed.candidates[0].content.parts[0].text;
              }

              if (chunk) {
                fullText += chunk;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`));
              }
            } catch (e) {
              // Skip unparseable lines
            }
          }
        }

        // Send complete event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'complete', 
          fullText,
          provider,
          sourceLanguage,
          targetLanguage
        })}\n\n`));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
