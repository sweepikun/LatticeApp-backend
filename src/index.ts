import { buildApp } from './app.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    logger.info(`Server running on http://${HOST}:${PORT}`);
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
