// Exact opt-in only; absent or malformed settings fail closed.
export const generationEnabled = env => env.QUICK_READ_GENERATION_ENABLED === 'true';
export function requireGenerationEnabled(env) {
  if (!generationEnabled(env)) throw new Error('generation_disabled');
}
