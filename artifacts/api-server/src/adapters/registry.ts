import type { TicketInventoryAdapter } from "./types.js";
import { stubAdapter } from "./stub.js";

const adapters: TicketInventoryAdapter[] = [
  stubAdapter,
  // Add real adapters here: amadeus, airsial-direct, flydubai, etc.
];

export function getEnabledAdapters(): TicketInventoryAdapter[] {
  return adapters.filter((a) => a.isEnabled());
}
