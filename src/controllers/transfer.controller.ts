import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../config/prisma";
import {
  currency_type,
  ledger_type,
  reference_type,
  transaction_status,
  notification_type,
} from "../generated/prisma/enums";
import jwtUserPayload from "../types/jwt.types";
import { getTransfersQueryParams } from "../types/tranfer";
import { upsertTransaction } from "../services/upsertTransaction";

// controller to make a transfer from one user to another, the transfer will be created with pending status then after the transfer is created and money is deducted from the sender wallet balance and added to the recipient wallet balance we will update the transfer status to completed
const createTransfer = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { amount, rceipient_phone_number, currency, description } =
      req.body as {
        amount: number;
        rceipient_phone_number: string;
        currency: currency_type;
        description?: string;
      };

    const sender_id = (req.user as jwtUserPayload).id;

    const sender = await prisma.users.findUnique({
      where: { id: sender_id },
    });

    if (!sender) {
      return res.status(404).send({ error: "Sender not found" });
    }

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
          description,
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
      return {
        final_transfer,
        sender_ledger_transaction,
        recipient_ledger_transaction,
      };
    });

    // adding the transaction to the vector database for the sender
    // sender + receiver enrichment for vector DB / AI ledger
    const transfer = result.final_transfer;
    const ledgerSenderID = result.sender_ledger_transaction?.id || "";
    const ledgerRecipientID = result.recipient_ledger_transaction?.id || "";

    // receiver upsert
    const recipientUser = await prisma.users.findUnique({
      where: {
        phone_number: rceipient_phone_number,
      },
      select: {
        id: true,
        full_name: true,
        phone_number: true,
      },
    });

    if (!recipientUser) {
      return res.status(404).send({ error: "Recipient not found" });
    }

    // sender upsert
    await upsertTransaction({
      id: ledgerSenderID,
      user_id: transfer.sender_id,
      user_name: sender.full_name,
      phone_number: sender.phone_number,
      type: "TRANSFER_OUT",
      reference_type: "TRANSFER",
      reference_id: transfer.id,
      amount: transfer.amount,
      currency: transfer.currency,
      receiver_name: recipientUser?.full_name || "Unknown",
      receiver_phone: recipientUser?.phone_number || "",
      created_at: new Date().toISOString(),
    });

    await upsertTransaction({
      id: ledgerRecipientID,
      user_id: transfer.receiver_id,
      user_name: recipientUser?.full_name || "Unknown",
      phone_number: recipientUser?.phone_number || "",
      type: "TRANSFER_IN",
      reference_type: "TRANSFER",
      reference_id: transfer.id,
      amount: transfer.amount,
      currency: transfer.currency,
      sender_name: sender.full_name,
      sender_phone: sender.phone_number,
      created_at: new Date().toISOString(),
    });

    // after everything is done we will send a notification to the recipient to notify them about the transfer
    // but before sending the notification we need to check if the recipient has enabled the recieve_enabled notification preference
    const recipient_notification_pref =
      await prisma.notification_preferences.findFirst({
        where: {
          user_id: result.final_transfer.receiver_id,
        },
      });

    if (recipient_notification_pref?.receive_enabled) {
      await prisma.notifications.create({
        data: {
          user_id: result.final_transfer.receiver_id,
          type: notification_type.RECEIVE,
          title: "You received a transfer",
          message: `You received a transfer of ${result.final_transfer.amount} ${result.final_transfer.currency} from ${sender?.full_name || "Unknown Sender"} \n Description: ${description || "No description provided"}`,
          is_read: false,
          is_success: true,
          reference_type: reference_type.TRANSFER,
          reference_id: result.final_transfer.id,
        },
      });
    }

    // send response
    res.status(201).send({ transfer: result.final_transfer });
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while creating the transfer.",
    });
  }
};

// controller to get all the transfers in a paginated way
// the page by defualt will be 1 and the limit will be 10
const getTransfers = async (
  req: FastifyRequest<{ Querystring: getTransfersQueryParams }>,
  res: FastifyReply,
) => {
  try {
    const user_id = (req.user as jwtUserPayload).id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const transfers = await prisma.transfers.findMany({
      where: {
        OR: [{ sender_id: user_id }, { receiver_id: user_id }],
      },
      include: {
        users_transfers_receiver_idTousers: {
          select: {
            full_name: true,
            phone_number: true,
          },
        },
        users_transfers_sender_idTousers: {
          select: {
            full_name: true,
            phone_number: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
      skip: offset,
      take: limit,
    });

    const result = transfers.map((t) => ({
      id: t.id,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      created_at: t.created_at,
      description: t.description,

      // unified user object
      sender: t.users_transfers_sender_idTousers,
      receiver: t.users_transfers_receiver_idTousers,
    }));

    //     {
    //   "id": "123",
    //   "amount": "100.00",
    //   "currency": "USD",
    //   "status": "COMPLETED",
    //   "created_at": "2026-05-05T10:00:00Z",
    //   "description": "Payment",
    //   "sender": {
    //     "full_name": "Alice",
    //     "phone_number": "11111111"
    //   },
    //   "receiver": {
    //     "full_name": "Bob",
    //     "phone_number": "22222222"
    //   }
    // }

    res.status(200).send({
      page: page,
      limit: limit,
      data: result,
    });
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while retrieving transfers.",
    });
  }
};

export { createTransfer, getTransfers };
