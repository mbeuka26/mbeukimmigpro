// hub-diagnostics — Diagnostic d'intégration Hub Central ↔ SaaS (admin uniquement).
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdmin } from '../_shared/supabase-env.ts';
import {
  ensureHubConfigured,
  getHubClient,
  toSafeHubError,
  isHubSchemaAccessTypeError,
} from '../_shared/hub-service.ts';
import { ensureBridgeConfigured } from '../_shared/saas-profile.ts';
import { assertServiceRoleConfigured } from '../_shared/edge-response.ts';

type StepStatus = 'PASS' | 'WARN' | 'FAIL';

type DiagnosticStep = {
  id: string;
  label: string;
  status: StepStatus;
  code?: string;
  message: string;
  next_action?: string;
};

function step(
  id: string,
  label: string,
  status: StepStatus,
  message: string,
  opts?: { code?: string; next_action?: string },
): DiagnosticStep {
  return { id, label, status, message, code: opts?.code, next_action: opts?.next_action };
}

function maskId(value: string | undefined | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const correlation_id = crypto.randomUUID();

  try {
    if (req.headers.get('x-admin-secret') !== Deno.env.get('ADMIN_SECRET')) {
      return json({ error: 'Non autorisé', correlation_id }, 403);
    }

    const steps: DiagnosticStep[] = [];
    const env = {
      hub_url: Deno.env.get('MBEUK_HUB_URL') ?? '',
      product_id: Deno.env.get('MBEUK_PRODUCT_ID') ?? '',
      application_id: Deno.env.get('MBEUK_APPLICATION_ID') ?? '',
      environment: Deno.env.get('MBEUK_ENVIRONMENT') ?? 'production',
      has_api_key: Boolean(Deno.env.get('MBEUK_HUB_API_KEY')),
      has_bridge_secret: Boolean(Deno.env.get('MBEUK_AUTH_BRIDGE_SECRET')),
      has_service_role: Boolean(Deno.env.get('MBEUK_SERVICE_ROLE_KEY')),
    };

    // 1. SDK configuration
    steps.push(
      env.hub_url && env.has_api_key && env.product_id
        ? step('sdk_config', 'Configuration SDK serveur', 'PASS', 'MBEUK_HUB_URL, MBEUK_HUB_API_KEY et MBEUK_PRODUCT_ID présents.')
        : step('sdk_config', 'Configuration SDK serveur', 'FAIL', 'Configuration Hub incomplète côté Edge Functions.', {
          code: 'HUB_ENV_MISSING',
          next_action: 'Définissez MBEUK_HUB_URL, MBEUK_HUB_API_KEY et MBEUK_PRODUCT_ID dans les secrets Supabase.',
        }),
    );

    // 2–4. App / Product / Environment
    steps.push(
      env.application_id
        ? step('app_id', 'Application ID', 'PASS', `Application configurée (${maskId(env.application_id)}).`)
        : step('app_id', 'Application ID', 'WARN', 'MBEUK_APPLICATION_ID absent — requis si le produit Hub est lié à une application.', {
          code: 'APP_ID_MISSING',
          next_action: 'Ajoutez MBEUK_APPLICATION_ID dans les secrets Supabase.',
        }),
    );
    steps.push(
      env.product_id
        ? step('product_id', 'Product ID', 'PASS', `Produit configuré (${maskId(env.product_id)}).`)
        : step('product_id', 'Product ID', 'FAIL', 'MBEUK_PRODUCT_ID manquant.', { code: 'PRODUCT_ID_MISSING' }),
    );
    steps.push(
      step('environment', 'Environnement', 'PASS', `Environnement : ${env.environment}.`),
    );

    // 5. Network connectivity
    if (env.hub_url && env.has_api_key) {
      try {
        const hub = getHubClient();
        const health = await hub.health();
        steps.push(
          health?.ok !== false
            ? step('network', 'Connectivité Hub', 'PASS', 'Hub Central répond (health OK).')
            : step('network', 'Connectivité Hub', 'WARN', 'Hub Central répond mais health indique un problème.', {
              code: 'HUB_HEALTH_WARN',
              next_action: 'Vérifiez les logs Hub Central et le déploiement Vercel.',
            }),
        );
      } catch (e) {
        const safe = toSafeHubError(e);
        steps.push(step('network', 'Connectivité Hub', 'FAIL', safe.message, {
          code: safe.code,
          next_action: 'Vérifiez MBEUK_HUB_URL et la disponibilité du Hub.',
        }));
      }
    } else {
      steps.push(step('network', 'Connectivité Hub', 'FAIL', 'Impossible de tester — configuration incomplète.', {
        code: 'HUB_ENV_MISSING',
      }));
    }

    // 6–7. Bridge + service role (SaaS local)
    try {
      ensureBridgeConfigured();
      steps.push(step('bridge', 'Pont RLS Supabase', 'PASS', 'MBEUK_AUTH_BRIDGE_SECRET configuré (32+ caractères).'));
    } catch (e) {
      steps.push(step('bridge', 'Pont RLS Supabase', 'FAIL', (e as Error).message, {
        code: 'BRIDGE_SECRET_MISSING',
        next_action: 'Ajoutez MBEUK_AUTH_BRIDGE_SECRET dans les secrets Supabase.',
      }));
    }

    try {
      assertServiceRoleConfigured();
      steps.push(step('service_role', 'Service role SaaS', 'PASS', 'MBEUK_SERVICE_ROLE_KEY configuré.'));
    } catch (e) {
      steps.push(step('service_role', 'Service role SaaS', 'FAIL', (e as Error).message, {
        code: 'SERVICE_ROLE_MISSING',
      }));
    }

    // 8. Schema SaaS local
    try {
      const supabaseAdmin = createSupabaseAdmin();
      const { error: subErr } = await supabaseAdmin.from('subscriptions').select('hub_license_id').limit(1);
      steps.push(
        !subErr
          ? step('saas_schema', 'Schéma SaaS (subscriptions)', 'PASS', 'Table subscriptions accessible.')
          : step('saas_schema', 'Schéma SaaS (subscriptions)', 'FAIL', subErr.message, {
            code: 'SAAS_SCHEMA_ERROR',
            next_action: 'Appliquez les migrations MbeukAgri (000005, 000006, 000007).',
          }),
      );
    } catch (e) {
      steps.push(step('saas_schema', 'Schéma SaaS', 'FAIL', (e as Error).message, { code: 'SAAS_DB_ERROR' }));
    }

    // 9–10. Hub product / license API (sans données utilisateur)
    if (steps.find((s) => s.id === 'network')?.status === 'PASS') {
      try {
        ensureHubConfigured();
        const hub = getHubClient();
        // Validation sans email réel — vérifie que l'API licence répond (erreur attendue = schéma ou not found)
        await hub.licenses.validateLicense({
          email: 'diagnostics@mbeuk.invalid',
          device_identifier: 'diag-no-device',
        });
        steps.push(step('license_api', 'API licences Hub', 'PASS', 'Endpoint licences Hub accessible.'));
      } catch (e) {
        if (isHubSchemaAccessTypeError(e)) {
          steps.push(step('license_api', 'API licences Hub', 'FAIL', 'Migration Hub Central requise (licenses.access_type).', {
            code: 'HUB_SCHEMA_OUTDATED',
            next_action: 'Appliquez HUB_CENTRAL_licenses_access_type.sql sur le Supabase Hub Central.',
          }));
        } else {
          const safe = toSafeHubError(e);
          const acceptable = ['NOT_FOUND', 'NO_LICENSE', 'LICENSE_NOT_FOUND', 'VALIDATION_ERROR', 'HTTP_ERROR']
            .some((c) => safe.code.includes(c) || safe.message.toLowerCase().includes('not found'));
          steps.push(
            acceptable
              ? step('license_api', 'API licences Hub', 'PASS', 'Endpoint licences Hub répond (aucune licence test — attendu).')
              : step('license_api', 'API licences Hub', 'WARN', safe.message, { code: safe.code }),
          );
        }
      }
    }

    // 11. Checkout capability (dry — pas de session utilisateur)
    steps.push(
      step('checkout', 'Checkout Hub', 'WARN', 'Test checkout non exécuté sans session utilisateur Hub.', {
        code: 'CHECKOUT_SKIPPED',
        next_action: 'Connectez un utilisateur test puis appelez hub-checkout pour valider le flux paiement.',
      }),
    );

    // 12–17. Webhook / payment — côté Hub Central uniquement
    steps.push(
      step('webhook', 'Webhooks paiement', 'WARN', 'Vérification webhook Chariow à effectuer côté Hub Central (admin).', {
        code: 'WEBHOOK_HUB_SIDE',
        next_action: 'Vérifiez app/api/webhooks/chariow sur le Hub et les logs de paiement.',
      }),
    );

    const summary = {
      pass: steps.filter((s) => s.status === 'PASS').length,
      warn: steps.filter((s) => s.status === 'WARN').length,
      fail: steps.filter((s) => s.status === 'FAIL').length,
    };

    const overall: StepStatus = summary.fail > 0 ? 'FAIL' : summary.warn > 0 ? 'WARN' : 'PASS';

    return json({
      ok: overall !== 'FAIL',
      correlation_id,
      saas: 'MbeukAgri',
      overall,
      summary,
      config: {
        environment: env.environment,
        product_id_masked: maskId(env.product_id),
        application_id_masked: maskId(env.application_id),
        hub_url: env.hub_url || null,
      },
      steps,
    });
  } catch (e) {
    const safe = toSafeHubError(e);
    return json({ error: safe.message, code: safe.code, correlation_id }, safe.status || 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
