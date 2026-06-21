import type { TicketInventoryAdapter } from "./types.js";

export const stubAdapter: TicketInventoryAdapter = {
  id: "stub",
  name: "Stub (template for real adapters)",
  isEnabled: () => false,
  async fetchAvailability(_flightNumber, _date) {
    return { seatsAvailable: null, fareAmount: null, fareCurrency: "PKR" };
  },
};
