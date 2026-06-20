declare module "amadeus" {
  class Amadeus {
    constructor(options: { clientId: string; clientSecret: string; hostname?: string });
    shopping: {
      flightOffersSearch: {
        get(params: Record<string, string | number>): Promise<{ data: unknown[] }>;
      };
    };
  }
  export = Amadeus;
}
