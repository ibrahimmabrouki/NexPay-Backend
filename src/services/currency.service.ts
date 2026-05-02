import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { getExchangeRate } from "../utils/getExchangeRate";
import { currency_type } from "../generated/prisma/enums";

export const getRateWithCache = async (
  from: currency_type,
  to: currency_type,
) => {
  try {
    // Check if the exchange rate is already cached in the database
    const existing = await prisma.currency_rates.findFirst({
      where: {
        base_currency: from,
        target_currency: to,
        expires_at: {
          gt: new Date(), // Ensure the cached rate is still valid
        },
      },
    });
    if (existing) {
      return Number(existing.rate); // Return the cached exchange rate
    }
    // If not cached, fetch the exchange rate from the external API
    const rate = await getExchangeRate(from, to);

    await prisma.currency_rates.upsert({
      where: {
        base_currency_target_currency: {
          base_currency: from,
          target_currency: to,
        },
      },
      update: {
        rate: new Prisma.Decimal(rate),
        fetched_at: new Date(),
        expires_at: new Date(Date.now() + 3600000), // Set expiration to 1 hour from now
      },
      create: {
        base_currency: from,
        target_currency: to,
        rate: new Prisma.Decimal(rate),
        source: "frankfurter",
        fetched_at: new Date(),
        expires_at: new Date(Date.now() + 3600000),
      },
    });
    return Number(rate);
  } catch (error) {
    console.error("Error fetching cached exchange rate:", error);
    throw new Error("Failed to fetch cached exchange rate");
  }
};
