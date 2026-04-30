import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../config/prisma";
import {
  currency_type,
  ledger_type,
  reference_type,
  transaction_status,
} from "../generated/prisma/enums";
import jwtUserPayload from "../types/jwt.types";

const createTransfer = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { amount, rceipient_phone_number, currency } = req.body as {
      amount: number;
      rceipient_phone_number: string;
      currency: currency_type;
    };

    const sender_id = (req.user as jwtUserPayload).id;

    const sender_wallet = await prisma.wallets.findFirst({
      where: {
        user_id: sender_id,
      },
    });

    if (!sender_wallet) {
      return res.status(404).send({ error: "Sender wallet not found" });
    }

    // 1- chec if the user has enough balance in the wallet balance of the ipnut currency
    const sender_wallet_balance = await prisma.wallet_balances.findFirst({
      where: {
        wallet_id: sender_wallet.id,
        currency: currency,
      },
    });

    console.log("sender_wallet_balance", sender_wallet_balance);

    if (
      !sender_wallet_balance ||
      sender_wallet_balance.available_balance.lt(amount)
    ) {
      return res.status(400).send({ error: "Insufficient balance" });
    }

    // 2- check if the recipient exists and get the recipient wallet
    const recipient_wallet = await prisma.wallets.findFirst({
      where: {
        users: { phone_number: rceipient_phone_number },
      },
    });

    if (!recipient_wallet) {
      return res.status(404).send({ error: "Recipient not found" });
    }

    // 3- create the transfer and update the sender and recipient wallet balances in a transaction, in additon to creating the ledger_transaction entery for each of the sender and the reciver
    const result = await prisma.$transaction(async (tx) => {
      //find the recipient wallet balance for the input currency

      const recipient_wallet_balance = await tx.wallet_balances.findFirst({
        where: {
          wallet_id: recipient_wallet.id,
          currency: currency,
        },
      });

      if (!recipient_wallet_balance) {
        throw new Error(
          "Recipient wallet balance not found for the specified currency",
        );
      }
      // create transfer with pending status then after the transfer is created and money is deducted from the sender wallet balance and added to the recipient wallet balance we will update the transfer status to completed
      const transfer = await tx.transfers.create({
        data: {
          sender_id,
          receiver_id: recipient_wallet.user_id,
          sender_wallet_id: sender_wallet.id,
          receiver_wallet_id: recipient_wallet.id,
          amount,
          currency,
          status: "PENDING",
        },
      });

      //We need to create a ledger_transaction entery for each of the sender and the reciver to keep track of the transactions that happened
      const sender_ledger_transaction = await tx.ledger_transactions.create({
        data: {
          user_id: sender_id,
          wallet_id: sender_wallet_balance.wallet_id,
          type: ledger_type.TRANSFER_OUT,
          currency,
          amount,
          balance_before: sender_wallet_balance.available_balance,
          balance_after: sender_wallet_balance.available_balance.minus(amount),
          reference_type: reference_type.TRANSFER,
          reference_id: transfer.id,
          status: transaction_status.PENDING,
        },
      });

      const recipient_ledger_transaction = await tx.ledger_transactions.create({
        data: {
          user_id: recipient_wallet.user_id,
          wallet_id: recipient_wallet.id,
          type: ledger_type.TRANSFER_IN,
          currency,
          amount,
          balance_before: recipient_wallet_balance.available_balance,
          balance_after:
            recipient_wallet_balance.available_balance.plus(amount),
          reference_type: reference_type.TRANSFER,
          reference_id: transfer.id,
          status: transaction_status.PENDING,
        },
      });

      // deduct the amount from the sender wallet balance
      await tx.wallet_balances.update({
        where: { id: sender_wallet_balance.id },
        data: {
          available_balance: {
            decrement: amount,
          },
        },
      });

      // add the amount to the recipient wallet balance
      await tx.wallet_balances.update({
        where: { id: recipient_wallet_balance.id },
        data: {
          available_balance: {
            increment: amount,
          },
        },
      });

      // update the transfer status to completed
      const final_transfer = await tx.transfers.update({
        where: { id: transfer.id },
        data: { status: "COMPLETED" },
      });

      // update the ledger transactions status to completed
      await tx.ledger_transactions.updateMany({
        where: { id: sender_ledger_transaction.id },
        data: { status: transaction_status.COMPLETED },
      });

      await tx.ledger_transactions.updateMany({
        where: { id: recipient_ledger_transaction.id },
        data: { status: transaction_status.COMPLETED },
      });
      return { final_transfer };
    });

    // send response
    res.status(201).send({ transfer: result.final_transfer });
  } catch (error: any) {
    console.error(error);
  }
};

export { createTransfer };
