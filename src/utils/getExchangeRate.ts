import axios from "axios";
import { currency_type } from "../generated/prisma/enums";

export const getExchangeRate = async (
  from: currency_type,
  to: currency_type,
): Promise<number> => {
  try {
    if (from === to) {
      return 1;
    }

    const response = await axios.get(
      `https://open.er-api.com/v6/latest/${from}`,
    );

    const rate = response.data.rates[to];

    if (!rate) {
      throw new Error(`Exchange rate not found for ${from} to ${to}`);
    }

    return Number(rate);
  } catch (error: any) {
    console.error(
      "Error fetching exchange rate:",
      error.response?.data || error.message,
    );

    throw new Error("Failed to fetch exchange rate");
  }
};