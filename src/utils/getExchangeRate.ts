import axios from "axios";
import { currency_type } from "../generated/prisma/enums";

export const getExchangeRate = async (
  from: currency_type,
  to: currency_type,
): Promise<number> => {
  try {
    if (from === to) {
      return 1; // No conversion needed
    }

    const response = await axios.get(`https://api.frankfurter.app/latest`, {
      params: {
        from,
        to,
      },
    });
    const rate = response.data.rates[to];

    if (!rate) {
      throw new Error(`Exchange rate not found for ${from} to ${to}`);
    }
    return rate;
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    throw new Error("Failed to fetch exchange rate");
  }
};
