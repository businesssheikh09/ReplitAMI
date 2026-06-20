export interface ParsedTicket {
  airlineCode: string;
  flightNumber: string;
  flightDate: string;
  origin: string;
  destination: string;
  seats: number;
  departureTime: string | null;
  arrivalTime: string | null;
  fareAmount: number | null;
  fareCurrency: string;
}

const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

function parseDateCode(code: string): string {
  const m = code.match(/^(\d{1,2})([A-Z]{3})$/i);
  if (!m) return new Date().toISOString().slice(0, 10);
  const day = parseInt(m[1], 10);
  const monthIdx = MONTH_MAP[m[2].toUpperCase()];
  if (monthIdx === undefined) return new Date().toISOString().slice(0, 10);
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, monthIdx, day);
  if (candidate < now) year += 1;
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatTime(t: string): string | null {
  if (!t || t.length < 3) return null;
  const padded = t.padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

export function parseGroupTicketMessage(rawText: string): ParsedTicket[] {
  const text = rawText.replace(/\*/g, "").replace(/\r\n/g, "\n");
  const results: ParsedTicket[] = [];

  const sectorMatch = text.match(/=\s*([A-Z]{3})\s+([A-Z]{3})\s*=/i);
  const defaultOrigin = sectorMatch ? sectorMatch[1].toUpperCase() : "";
  const defaultDest   = sectorMatch ? sectorMatch[2].toUpperCase() : "";

  const fareMatch = text.match(/=FARE\s+([\d,]+)\s*\/-([A-Z]{3})\s*=/i);
  const fareAmount   = fareMatch ? parseFloat(fareMatch[1].replace(/,/g, "")) : null;
  const fareCurrency = fareMatch ? fareMatch[2].toUpperCase() : "PKR";

  const flightLineRe =
    /([A-Z]{2,3})(\d{1,4})\s+(\d{1,2}[A-Z]{3})\s+([A-Z]{3})([A-Z]{3})\s+HK(\d+)\s+(\d{3,4})\s+(\d{3,4})/gi;

  let match: RegExpExecArray | null;
  while ((match = flightLineRe.exec(text)) !== null) {
    const [, airlineCode, flightNum, dateCode, originRaw, destRaw, seatsStr, depRaw, arrRaw] = match;
    results.push({
      airlineCode: airlineCode.toUpperCase(),
      flightNumber: `${airlineCode.toUpperCase()}${flightNum}`,
      flightDate: parseDateCode(dateCode),
      origin: originRaw.toUpperCase() || defaultOrigin,
      destination: destRaw.toUpperCase() || defaultDest,
      seats: parseInt(seatsStr, 10),
      departureTime: formatTime(depRaw),
      arrivalTime: formatTime(arrRaw),
      fareAmount,
      fareCurrency,
    });
  }

  return results;
}
