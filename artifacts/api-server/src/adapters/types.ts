export interface AdapterResult {
  seatsAvailable: number | null;
  fareAmount: number | null;
  fareCurrency: string;
  rawResponse?: unknown;
}

export interface TicketInventoryAdapter {
  id: string;
  name: string;
  isEnabled: () => boolean;
  fetchAvailability(flightNumber: string, date: string): Promise<AdapterResult>;
}
