import { chunkText, extractTextFromHtml, fingerprintContent } from '../../../shared/rag/chunk.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';
import { isAdmin, requireUser, serviceClient } from '../_shared/supabase.ts';

async function authorized(req: Request, user?: { app_metadata?: Record<string, unknown> }) {
  const cron = Deno.env.get('CRAWLER_CRON_SECRET');
  const header = req.headers.get('x-cron-secret');
  if (cron && header === cron) return true;
  return user && isAdmin(user);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    let user;
    try {
      ({ user } = await requireUser(req));
    } catch {
      user = undefined;
    }
    if (!(await authorized(req, user))) {
      return errorResponse('FORBIDDEN', 'Admin ou secret cron requis.', 403);
    }

    const db = serviceClient();
    const { sourceId, limit = 2 } = await req.json().catch(() => ({}));

    let query = db.from('kb_sources').select('*').eq('enabled', true).limit(Math.min(limit, 5));
    if (sourceId) query = query.eq('id', sourceId);

    const { data: sources, error } = await query;
    if (error) return errorResponse('DB_ERROR', error.message, 500);

    const results: unknown[] = [];

    for (const source of sources ?? []) {
      const job = await db.from('crawl_jobs').insert({ source_id: source.id, status: 'running', started_at: new Date().toISOString() }).select('id').single();
      try {
        const res = await fetch(source.canonical_url, {
          headers: { 'User-Agent': 'MbeukImmigBot/1.0 (+https://mbeukimmig.local)' },
        });
        const html = await res.text();
        const hash = fingerprintContent(html);
        const { data: lastSnap } = await db.from('kb_source_snapshots').select('content_hash, id').eq('source_id', source.id).order('collected_at', { ascending: false }).limit(1).maybeSingle();

        const unchanged = lastSnap?.content_hash === hash;
        const status = res.ok ? (unchanged ? 'unchanged' : 'changed') : 'inaccessible';

        const { data: snap } = await db.from('kb_source_snapshots').insert({
          source_id: source.id,
          content_hash: hash,
          http_status: res.status,
          status,
          error_message: res.ok ? null : `HTTP ${res.status}`,
        }).select('id').single();

        if (res.ok && !unchanged) {
          const text = extractTextFromHtml(html);
          const fp = fingerprintContent(text);
          const { data: doc } = await db.from('kb_documents').insert({
            source_id: source.id,
            snapshot_id: snap?.id,
            title: source.authority,
            canonical_url: source.canonical_url,
            country_code: source.country_code,
            program_code: source.program_code,
            language: source.language,
            content_fingerprint: fp,
            validation_status: 'pending',
          }).select('id').single();

          const chunks = chunkText(text);
          for (let i = 0; i < chunks.length; i++) {
            await db.from('kb_document_chunks').insert({
              document_id: doc?.id,
              chunk_index: i,
              content: chunks[i],
              token_estimate: Math.ceil(chunks[i].length / 4),
            });
          }
        }

        await db.from('crawl_jobs').update({ status: 'done', finished_at: new Date().toISOString() }).eq('id', job.data?.id);
        results.push({ sourceId: source.id, status, http: res.status });
      } catch (err) {
        await db.from('crawl_jobs').update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: err instanceof Error ? err.message : 'fetch failed',
        }).eq('id', job.data?.id);
        results.push({ sourceId: source.id, status: 'failed' });
      }
    }

    return jsonResponse({ processed: results.length, results });
  } catch (e) {
    return errorResponse('INTERNAL', e instanceof Error ? e.message : 'Erreur', 500);
  }
});
