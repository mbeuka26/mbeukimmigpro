import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';
import { isAdmin, requireUser, serviceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user } = await requireUser(req);
    if (!isAdmin(user)) return errorResponse('FORBIDDEN', 'Admin requis.', 403);

    const db = serviceClient();
    const [central, jobs, docs, errors] = await Promise.all([
      db.from('central_ai_config').select('*').eq('id', 1).maybeSingle(),
      db.from('crawl_jobs').select('status').limit(500),
      db.from('kb_documents').select('validation_status'),
      db.from('llm_usage_logs').select('success').eq('success', false).limit(50),
    ]);

    const jobStats = (jobs.data ?? []).reduce((acc: Record<string, number>, j) => {
      acc[j.status] = (acc[j.status] ?? 0) + 1;
      return acc;
    }, {});

    const docStats = (docs.data ?? []).reduce((acc: Record<string, number>, d) => {
      acc[d.validation_status] = (acc[d.validation_status] ?? 0) + 1;
      return acc;
    }, {});

    return jsonResponse({
      centralAi: {
        enabled: central.data?.enabled ?? false,
        configured: Boolean(Deno.env.get('CENTRAL_OPENAI_API_KEY') || Deno.env.get('CENTRAL_ANTHROPIC_API_KEY')),
      },
      crawlJobs: jobStats,
      documents: docStats,
      recentProviderErrors: errors.data?.length ?? 0,
      byokMasterConfigured: Boolean(Deno.env.get('BYOK_MASTER_KEY_BASE64')),
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return errorResponse('UNAUTHORIZED', 'Authentification requise.', 401);
    }
    return errorResponse('INTERNAL', e instanceof Error ? e.message : 'Erreur', 500);
  }
});
