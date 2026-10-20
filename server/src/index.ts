import { app } from "./app.js";
import { getPrisma } from "./prisma.js";

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  console.log(`TokTickIT API listening on http://localhost:${PORT}`);
});

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}. Starting graceful shutdown (8s timeout)...`);

  const forceExitTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out after 8s. Forcing exit.");
    process.exit(1);
  }, 8000);
  forceExitTimer.unref();

  server.close(async (err) => {
    if (err) {
      console.error("Error closing HTTP server:", err);
    }
    try {
      await getPrisma().$disconnect();
      console.log("HTTP server closed and Prisma disconnected cleanly.");
      process.exit(0);
    } catch (disconnectErr) {
      console.error("Error disconnecting Prisma:", disconnectErr);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
