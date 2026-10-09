import { runEligibilityV1 } from '../eligibility/rules.ts';

export interface ToolContext {
  userId: string;
  projectId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  permissions: ('authenticated')[];
  maxCallsPerRun: number;
  execute(input: Record<string, unknown>, ctx: ToolContext): Promise<Record<string, unknown>>;
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    name: 'run_eligibility',
    description: 'Exécute le moteur déterministe v1 (FR/CA).',
    permissions: ['authenticated'],
    maxCallsPerRun: 3,
    async execute(input) {
      const result = runEligibilityV1({
        countryCode: String(input.countryCode || ''),
        pathwayCode: String(input.pathwayCode || ''),
        input: (input.profile as Record<string, unknown>) || {},
      });
      return { result };
    },
  },
  {
    name: 'search_knowledge_base',
    description: 'Placeholder — recherche serveur via rag-search.',
    permissions: ['authenticated'],
    maxCallsPerRun: 5,
    async execute() {
      return { note: 'Utiliser endpoint rag-search côté serveur avec passages réels.' };
    },
  },
];

export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name);
}
