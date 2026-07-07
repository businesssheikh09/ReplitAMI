const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function threeDigits(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
  return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + threeDigits(n % 100) : "");
}

/**
 * Converts a numeric amount to English words.
 * Examples:
 *   amountInWords(15000, "PKR")  → "Fifteen Thousand Rupees Only"
 *   amountInWords(1250.50, "SAR") → "One Thousand Two Hundred Fifty Riyals and Fifty Halalas Only"
 *   amountInWords(0, "USD")      → "Zero Dollars Only"
 */
export function amountToWords(amount: number, currency = "PKR"): string {
  if (isNaN(amount) || amount < 0) return "";

  const CURRENCY_MAP: Record<string, { major: string; minor: string; minorDivision: number }> = {
    PKR: { major: "Rupees",  minor: "Paisa",    minorDivision: 100 },
    SAR: { major: "Riyals",  minor: "Halalas",  minorDivision: 100 },
    USD: { major: "Dollars", minor: "Cents",    minorDivision: 100 },
    EUR: { major: "Euros",   minor: "Cents",    minorDivision: 100 },
    AED: { major: "Dirhams", minor: "Fils",     minorDivision: 100 },
    GBP: { major: "Pounds",  minor: "Pence",    minorDivision: 100 },
  };

  const c = CURRENCY_MAP[currency.toUpperCase()] ?? CURRENCY_MAP.PKR;
  const rounded = Math.round(amount * 100) / 100;
  const majorPart = Math.floor(rounded);
  const minorPart = Math.round((rounded - majorPart) * c.minorDivision);

  function convert(n: number): string {
    if (n === 0) return "Zero";
    const crore = Math.floor(n / 10_000_000);
    const lakh  = Math.floor((n % 10_000_000) / 100_000);
    const thou  = Math.floor((n % 100_000) / 1_000);
    const rest  = n % 1_000;
    const parts: string[] = [];
    if (crore) parts.push(threeDigits(crore) + " Crore");
    if (lakh)  parts.push(threeDigits(lakh) + " Lakh");
    if (thou)  parts.push(threeDigits(thou) + " Thousand");
    if (rest)  parts.push(threeDigits(rest));
    return parts.join(" ");
  }

  let result = convert(majorPart) + " " + c.major;
  if (minorPart > 0) {
    result += " and " + convert(minorPart) + " " + c.minor;
  }
  return result + " Only";
}
