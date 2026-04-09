import { NextRequest, NextResponse } from 'next/server';
import { secretsManager } from '@/lib/secrets-manager';
import { logger } from '@/lib/logger';
import { withErrorHandler, ValidationError } from '@/lib/error-handler';
import { secretsRequestSchema, validateBody } from '@/lib/api-schemas';

/**
 * POST /api/secrets - Save an API key at runtime
 */
export const POST = withErrorHandler(async function(request: NextRequest) {
  const rawBody = await request.json();
  const validated = validateBody(secretsRequestSchema, rawBody);
  if (!validated.success) {
    throw new ValidationError(validated.error);
  }

  const { key, value } = validated.data;

  // Initialize secrets manager if needed
  try {
    await secretsManager.initialize();
  } catch {
    // May fail if required secrets are missing, but we can still set optional ones
  }

  // Set the secret
  secretsManager.set(key, value);

  logger.info(`API key ${key} updated via UI`, 'SECRETS_API');

  return NextResponse.json({
    success: true,
    message: `API key ${key} saved successfully`
  });
});

/**
 * GET /api/secrets - Check which API keys are configured
 */
export const GET = withErrorHandler(async function() {
  // Initialize secrets manager if needed
  try {
    await secretsManager.initialize();
  } catch {
    // May fail if required secrets are missing
  }

  const keys = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
    'DEEPSEEK_API_KEY',
    'MISTRAL_API_KEY',
    'OPENROUTER_API_KEY',
  ];

  const status = keys.map(key => ({
    key,
    configured: secretsManager.isAvailable(key)
  }));

  return NextResponse.json({ keys: status });
});

