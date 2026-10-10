import 'dotenv/config';
import { z } from 'zod';

// Validate every environment variable once at startup (fail fast).
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('12h'),
  CLIENT_ORIGIN: z.string().min(1).transform((v) => v.split(',').map((s) => s.trim())),
  ENFORCE_STAGE_CAP: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  DEFECT_FLAG_PCT: z.coerce.number().default(10),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Print variable names and problems only, never the values (they may be secrets).
  const fields = parsed.error.flatten().fieldErrors;
  console.error('Invalid environment configuration:');
  for (const [name, problems] of Object.entries(fields)) {
    console.error(`  - ${name}: ${(problems ?? []).join(', ')}`);
  }
  process.exit(1);
}
export const env = parsed.data;
