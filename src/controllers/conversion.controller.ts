import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../config/prisma";
import jwtUserPayload from "../types/jwt.types";
import { getConversionQueryParams } from "../types/conversion";
import {
  currency_type,
  transaction_status,
  ledger_type,
  reference_type,
} from "../generated/prisma/enums";
import { getRateWithCache } from "../services/currency.service";
import { Prisma } from "../generated/prisma/client";

async function convertCurrency(req: FastifyRequest, res: FastifyReply) {
  try {
    const { from_currency, to_currency, amount } = req.body as {
      from_currency: currency_type;
      to_currency: currency_type;
      amount: number;
    };

    // get the user id from the access token
    const user_id = (req.user as jwtUserPayload).id;

    // check if the user has a wallet
    const wallet = await prisma.wallets.findFirst({
      where: {
        user_id: user_id,
      },
    });

    if (!wallet) {
      return res.status(404).send({ message: "Wallet not found for the user" });
    }

    // check if the user has enough balance in the wallet balance of the input currency
    const wallet_balance = await prisma.wallet_balances.findFirst({
      where: {
        wallet_id: wallet.id,
        currency: from_currency,
      },
    });

    if (!wallet_balance) {
      return res
        .status(404)
        .send({ message: "Insufficient balance in the source currency" });
    }

    if (wallet_balance.available_balance.lt(amount)) {
      return res.status(400).send({ message: "Insufficient balance" });
    }

    // get the exchange rate between the two currencies
    const exchange_rate = await getRateWithCache(from_currency, to_currency);

    // calculate the converted amount
    const converted_amount = new Prisma.Decimal(amount).mul(exchange_rate);

    const result = await prisma.$transaction(async (tx) => {
      //the first step is to create the conversion in the conversions table
      const conversion = await tx.currency_conversions.create({
        data: {
          user_id: user_id,
          wallet_id: wallet.id,
          from_currency,
          to_currency,
          amount_from: new Prisma.Decimal(amount),
          amount_to: new Prisma.Decimal(converted_amount),
          rate_used: new Prisma.Decimal(exchange_rate),
          status: transaction_status.PENDING,
        },
      });

      const ledger_transaction_debit = await tx.ledger_transactions.create({
        data: {
          user_id: user_id,
          wallet_id: wallet.id,
          type: ledger_type.CONVERSION_DEBIT,
          currency: from_currency,
          amount: new Prisma.Decimal(amount),
          balance_before: wallet_balance.available_balance,
          balance_after: wallet_balance.available_balance.minus(
            new Prisma.Decimal(amount),
          ),
          reference_type: reference_type.CONVERSION,
          reference_id: conversion.id,
          status: transaction_status.PENDING,
        },
      });

      const target_balance = await tx.wallet_balances.findFirst({
        where: {
          wallet_id: wallet.id,
          currency: to_currency,
        },
      });

      if (!target_balance) {
        throw new Error(
          "Target wallet balance not found for the specified currency",
        );
      }

      const ledger_transaction_credit = await tx.ledger_transactions.create({
        data: {
          user_id: user_id,
          wallet_id: wallet.id,
          type: ledger_type.CONVERSION_CREDIT,
          currency: to_currency,
          amount: converted_amount,
          balance_before: target_balance!.available_balance,
          balance_after:
            target_balance!.available_balance.plus(converted_amount),
          reference_type: reference_type.CONVERSION,
          reference_id: conversion.id,
          status: transaction_status.PENDING,
        },
      });

      // update the wallet balances accordingly
      await tx.wallet_balances.update({
        where: { id: wallet_balance.id },
        data: {
          available_balance: wallet_balance.available_balance.minus(amount),
        },
      });

      // update the target wallet balance by adding the converted amount
      await tx.wallet_balances.update({
        where: { id: target_balance.id },
        data: {
          available_balance:
            target_balance.available_balance.plus(converted_amount),
        },
      });

      // after all the operations are done we will update the conversion status to completed
      const final_conversion = await tx.currency_conversions.update({
        where: { id: conversion.id },
        data: { status: transaction_status.COMPLETED },
      });

      // update the ledger transactions status to completed
      await tx.ledger_transactions.updateMany({
        where: { id: ledger_transaction_debit.id },
        data: { status: transaction_status.COMPLETED },
      });

      // update the ledger transactions status to completed
      await tx.ledger_transactions.updateMany({
        where: { id: ledger_transaction_credit.id },
        data: { status: transaction_status.COMPLETED },
      });

      return { final_conversion };
    });

    res.status(200).send({
      message: "Currency conversion successful",
      data: result.final_conversion,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).send({
      message: error.message || "An error occurred during currency conversion.",
    });
  }
}

// controller to get all the conversions in a paginated way
// the page by defualt will be 1 and the limit will be 10
const getConversions = async (
  req: FastifyRequest<{ Querystring: getConversionQueryParams }>,
  res: FastifyReply,
) => {
  try {
    const user_id = (req.user as jwtUserPayload).id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const conversions = await prisma.currency_conversions.findMany({
      where: {
        user_id: user_id,
      },
      orderBy: {
        created_at: "desc",
      },
      skip: offset,
      take: limit,
    });

    res.status(200).send({
      page: page,
      limit: limit,
      data: conversions,
    });
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while retrieving conversions.",
    });
  }
};

export { convertCurrency, getConversions };
