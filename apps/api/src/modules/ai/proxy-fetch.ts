import { ProxyAgent, fetch as undiciFetch } from 'undici';

const PROXY_URL = process.env.PROXY_URL; // http://user:pass@host:port

let proxyAgent: ProxyAgent | undefined;

if (PROXY_URL) {
  proxyAgent = new ProxyAgent(PROXY_URL);
  console.log('[ProxyFetch] Using proxy:', PROXY_URL.replace(/:[^:@]+@/, ':***@'));
}

export async function proxyFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  if (proxyAgent) {
    // Используем undici с прокси
    const response = await undiciFetch(url, {
      ...options,
      dispatcher: proxyAgent,
    } as any);
    return response as unknown as Response;
  }

  // Без прокси - обычный fetch
  return fetch(url, options);
}

