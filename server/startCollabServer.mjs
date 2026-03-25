import { loadServerEnv } from './loadEnvFile.mjs';

loadServerEnv();
await import('./collabServer.mjs');
