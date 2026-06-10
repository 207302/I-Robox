/** Node-only shutdown hooks — never imported from Edge instrumentation. */

export function registerPrismaSignalHandlers(disconnect: () => Promise<void>): void {
  const onSignal = () => void disconnect();
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
}
