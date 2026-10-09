import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';
import { requireUser, serviceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    await requireUser(req);
    const { query, countryCode, limit = 8 } = await req.json();
    if (!query || String(query).trim().length < 2) {
      return errorResponse('INVALID_INPUT', 'Requête trop courte.');
    }
    const db = serviceClient();
    const q = String(query).trim();

    let sql = db
      .from('kb_document_chunks')
      .select('id, content, chunk_index, document_id, kb_documents!inner(title, canonical_url, country_code, validation_status, verified_at)')
      .textSearch('search_vector', q, { type: 'websearch', config: 'simple' })
      .eq('kb_documents.validation_status', 'approved')
      .limit(Math.min(limit, 20));

    if (countryCode) {
      sql = sql.eq('kb_documents.country_code', countryCode);
    }

    const { data, error } = await sql;
    if (error) return errorResponse('SEARCH_ERROR', error.message, 500);

    const passages = (data ?? []).map((row: Record<string, unknown>) => {
      const doc = row.kb_documents as Record<string, unknown>;
      return {
        chunkId: row.id,
        excerpt: row.content,
        title: doc?.title,
        url: doc?.canonical_url,
        countryCode: doc?.country_code,
        verifiedAt: doc?.verified_at,
      };
    });

    return jsonResponse({
      mode: passages.length ? 'text_search' : 'no_results',
      passages,
      disclaimer: 'Informations indicatives — vérifiez les sources officielles.',
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return errorResponse('UNAUTHORIZED', 'Authentification requise.', 401);
    }
    return errorResponse('INTERNAL', e instanceof Error ? e.message : 'Erreur', 500);
  }
});
