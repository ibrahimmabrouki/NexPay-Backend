import { FastifyRequest, FastifyReply } from "fastify";
import jwtUserPayload from "../types/jwt.types";
import { getRateWithCache } from "../services/currency.service";
import { currency_type } from "../generated/prisma/enums";

// controller to get the exchage rate between two currencies

const getExchangeRateController = async (
  req: FastifyRequest,
  res: FastifyReply,
) => {
  try {
    const user_id = (req.user as jwtUserPayload).id;

    if (!user_id) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    const { from_currency, to_currency } = req.params as {
      from_currency: currency_type;
      to_currency: currency_type;
    };

    if (!from_currency || !to_currency) {
      return res
        .status(400)
        .send({ message: "from_currency and to_currency are required" });
    }

    const exchange_rate = await getRateWithCache(from_currency, to_currency);

    if (exchange_rate == null) {
      return res
        .status(404)
        .send({ message: "Exchange rate not found for the given currencies" });
    }

    res.status(200).send({
      from_currency,
      to_currency,
      exchange_rate: exchange_rate.toString(),
    });
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while retrieving exchange rate.",
    });
  }
};

export { getExchangeRateController };
