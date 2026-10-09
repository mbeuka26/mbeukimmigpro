import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';
import { isAdmin, requireUser, serviceClient } from '../_shared/supabase.ts';

async function embedOpenAI(texts: string[], apiKey: string, model: string) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: texts }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Embedding failed');
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user } = await requireUser(req);
    if (!isAdmin(user)) return errorResponse('FORBIDDEN', 'Admin requis.', 403);

    const apiKey = Deno.env.get('CENTRAL_OPENAI_API_KEY');
    if (!apiKey) return errorResponse('EMBED_DISABLED', 'Embeddings distants désactivés (clé centrale OpenAI absente).', 503);

    const { documentId, modelId = 'text-embedding-3-small' } = await req.json();
    const db = serviceClient();
    const { data: chunks, error } = await db.from('kb_document_chunks').select('id, content').eq('document_id', documentId);
    if (error) return errorResponse('DB_ERROR', error.message, 500);
    if (!chunks?.length) return jsonResponse({ embedded: 0 });

    const vectors = await embedOpenAI(chunks.map((c) => c.content), apiKey, modelId);
    for (let i = 0; i < chunks.length; i++) {
      await db.from('kb_chunk_embeddings').upsert({
        chunk_id: chunks[i].id,
        model_id: modelId,
        embedding: vectors[i],
      });
    }
    await db.from('kb_documents').update({ embedding_model_id: modelId }).eq('id', documentId);
    return jsonResponse({ embedded: chunks.length, modelId });
  } catch (e) {
    return errorResponse('INTERNAL', e instanceof Error ? e.message : 'Erreur', 500);
  }
});
