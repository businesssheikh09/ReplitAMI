const TIER_1H_THRESHOLD = 24;   // hours until flight → 1h deadline
const TIER_3H_THRESHOLD = 48;   // hours until flight → 3h deadline
const TIER_12H_THRESHOLD = 240; // 10 days → 12h deadline
// > 10 days → 24h deadline

export type DeadlineTier = "1h" | "3h" | "12h" | "24h";

export function calculatePaymentDeadline(
  flightDate: Date,
  bookedAt: Date,
): { deadline: Date; tier: DeadlineTier; hoursUntilFlight: number } {
  const hoursUntilFlight = (flightDate.getTime() - bookedAt.getTime()) / (1000 * 60 * 60);

  let addHours: number;
  let tier: DeadlineTier;

  if (hoursUntilFlight <= TIER_1H_THRESHOLD) {
    addHours = 1;
    tier = "1h";
  } else if (hoursUntilFlight <= TIER_3H_THRESHOLD) {
    addHours = 3;
    tier = "3h";
  } else if (hoursUntilFlight <= TIER_12H_THRESHOLD) {
    addHours = 12;
    tier = "12h";
  } else {
    addHours = 24;
    tier = "24h";
  }

  const deadline = new Date(bookedAt.getTime() + addHours * 60 * 60 * 1000);
  return { deadline, tier, hoursUntilFlight: Math.round(hoursUntilFlight) };
}
