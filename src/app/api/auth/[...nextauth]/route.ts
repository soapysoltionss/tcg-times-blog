import { handlers } from "@/auth";

// NextAuth handles auth. We wrap each handler to ensure that Vercel/Cloudflare
// do not cache these responses or strip Set-Cookie headers.
// Without `Cache-Control: private, no-store`, Vercel's CDN can add
// `cache-control: public, max-age=0` which causes Cloudflare to strip
// Set-Cookie headers, breaking the OAuth state/PKCE cookie flow.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function withNoCache(handler: any, req: Request): Promise<Response> {
  const res = (await handler(req)) as Response;
  const newHeaders = new Headers(res.headers);
  newHeaders.set("Cache-Control", "private, no-cache, no-store, max-age=0");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: newHeaders,
  });
}

export async function GET(req: Request) {
  return withNoCache(handlers.GET, req);
}

export async function POST(req: Request) {
  return withNoCache(handlers.POST, req);
}

