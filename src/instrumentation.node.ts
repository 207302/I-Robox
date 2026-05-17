/** Node-only shutdown hooks — never imported from Edge instrumentation. */

export function registerPrismaSignalHandlers(disconnect: () => Promise<void>): void {
  process.once("SIGINT", () => void disconnect());
  process.once("SIGTERM", () => void disconnect());
}
