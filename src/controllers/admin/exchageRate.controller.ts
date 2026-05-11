import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma";
import jwtUserPayload from "../../types/jwt.types";
import { currency_type, user_role } from "../../generated/prisma/enums";
import { getRateWithCache } from "../../services/currency.service";
import { Prisma } from "../../generated/prisma/client";

const exchangePairs: {
  from: currency_type;
  to: currency_type;
  key: string;
}[] = [
  {
    from: currency_type.USD,
    to: currency_type.EUR,
    key: "usd_to_eur",
  },
  {
    from: currency_type.USD,
    to: currency_type.LBP,
    key: "usd_to_lbp",
  },
  {
    from: currency_type.EUR,
    to: currency_type.USD,
    key: "eur_to_usd",
  },
  {
    from: currency_type.EUR,
    to: currency_type.LBP,
    key: "eur_to_lbp",
  },
  {
    from: currency_type.LBP,
    to: currency_type.USD,
    key: "lbp_to_usd",
  },
  {
    from: currency_type.LBP,
    to: currency_type.EUR,
    key: "lbp_to_eur",
  },
];

// controller for the admin to get the current exchange rate of the supported currencies
const getExchangeRates = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const payload = req.user as jwtUserPayload;
    const user = await prisma.users.findUnique({
      where: { id: payload.id },
    });

    // getting the user from the database to check if the user is the staff or not.
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    // eventhough we added a middle ware but this is just for double check.
    if (user.role !== user_role.STAFF) {
      return res.status(403).send({ message: "Forbidden" });
    }

    const exchangeRates = await Promise.all(
      exchangePairs.map(async (pair) => {
        const rate = await getRateWithCache(pair.from, pair.to);
        return {
          from_currency: pair.from,
          to_currency: pair.to,
          exchange_rate: rate?.toString() ?? "N/A",
        };
      }),
    );

    res.status(200).send({
      data: exchangeRates,
    });
  } catch (error: any) {
    res.status(500).send({
      message: "An error occurred while fetching the exchange rates",
      error: error.message,
    });
  }
};

// controller for the admin to update the exchange rates of the supported currencies from the third party api and save it in the database every 24 hours using a cron job.
const updateExchangeRates = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const payload = req.user as jwtUserPayload;
    const user = await prisma.users.findUnique({
      where: { id: payload.id },
    });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    if (user.role !== user_role.STAFF) {
      return res.status(403).send({ message: "Forbidden" });
    }

    const { from, to, rate } = req.body as {
      from: currency_type;
      to: currency_type;
      rate: number;
    };
    if (!from || !to || !rate) {
      return res
        .status(400)
        .send({ message: "from, to and rate are required" });
    }

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
        expires_at: new Date(Date.now() + 60000), 
      },
      create: {
        base_currency: from,
        target_currency: to,
        rate: new Prisma.Decimal(rate),
        source: "open.er-api",
        fetched_at: new Date(),
        expires_at: new Date(Date.now() + 60000),
      },
    });
  } catch (error: any) {
    res.status(500).send({
      message: "An error occurred while updating the exchange rates",
      error: error.message,
    });
  }
};

export { getExchangeRates, updateExchangeRates };
