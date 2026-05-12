import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../config/prisma";
import jwtUserPayload from "../types/jwt.types";
import { getTopUpsQueryParams } from "../types/topups";
import {
  currency_type,
  transaction_status,
  ledger_type,
  reference_type,
  notification_type,
} from "../generated/prisma/enums";
import Stripe from "stripe";

// controller to call the stripe api to create a create the session, create the stripe_topups row in the database with pending state to be later updated to completed in the webhook
// handler after deducting the amount from the user card to be added into their wallet balance

async function createStripeSession(req: FastifyRequest, res: FastifyReply) {
  try {
    // get the user id from the access token to make sure that the user is authenticated
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

    // we need to get the amount and the currency for the ongoing topup transaction from the request body
    // the default currency will be USD if the user did not provide any currency in the request body
    const { amount, currency } = req.body as {
      amount: number;
      currency?: string;
    };

    if (!amount || amount <= 0) {
      return res.status(400).send({ message: "Invalid amount" });
    }

    const currencyType = (currency as currency_type) || "USD";

    //now we need to get the wallet balance of the user for the input currency to be used ledger transaction
    const walletBalance = await prisma.wallet_balances.findFirst({
      where: {
        wallet_id: wallet.id,
        currency: currencyType,
      },
    });

    //check if there is a wallet balance for the input currenct
    if (!walletBalance) {
      return res.status(404).send({
        message: "Wallet balance not found for the specified currency",
      });
    }

    // create the stripe session that will be used to return the url to the frontend to redirect the user to strip to checkout page
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

    // Create a new stripe_topups row in the database with pending state to be later updated to completed in the webhook handler after deducting the amount from the user card to be added into their wallet balance
    const stripeTopup = await prisma.stripe_topups.create({
      data: {
        user_id: user_id,
        wallet_id: wallet.id,
        amount: amount,
        currency: currencyType,
        // this field will be updated later in after creating the session
        stripe_session_id: "",
        // this feild will be upated later in the webhook
        stripe_payment_intent: "",
        status: transaction_status.PENDING,
      },
    });

    const stripeTopupId = stripeTopup.id;

    //now we need to create the Line items for the stripe session
    const LineItems = [
      {
        price_data: {
          currency: currencyType.toLowerCase(),
          product_data: {
            name: "NexPay Wallet Topup",
          },
          unit_amount: Math.round(amount * 100), // Stripe expects the amount in cents
        },
        quantity: 1,
      },
    ];

    // create the actual stripe session
    const session = await stripe.checkout.sessions.create(
      {
        //specifying that the payment method will be done using the card
        payment_method_types: ["card"],
        mode: "payment",
        line_items: LineItems,

        //specifying the success and the canel urls, these urls will be returend to the user in the frontend to redirect the user to the success page if the payment is successful or to the cancel page if the user canceled the payment or if there was an error during the payment process
        success_url: `${process.env.FRONTEND_URL}/transactions?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/deposit?&cancel=true&topup_id={stripeTopupId}`,

        metadata: {
          userId: user_id,
          walletId: wallet.id,
          topupId: stripeTopupId,
          amount: amount.toString(),
          currency: currencyType,
        },
      },
      {
        idempotencyKey: stripeTopupId, // Use the stripe_topups id as the idempotency key to prevent creating multiple sessions for the same topup in case of multiple requests being sent from the frontend
      },
    );

    const result = await prisma.$transaction(async (tx) => {
      // update the stripe-topups row in the database to be linked to the created stripe session
      const updatedStripeTopup = await tx.stripe_topups.update({
        where: {
          id: stripeTopup.id,
        },
        data: {
          stripe_session_id: session.id,
        },
      });

      //now we need to create a ledger transaction with pending status to be updated later in the webook handler after the payment is successful. in case the user canceled the payment
      //of if there was an error during the payment process we will update the ledger transaction, stripe_topups, status to failed in the webhook handler
      const ledgerTransaction = await tx.ledger_transactions.create({
        data: {
          user_id: user_id,
          wallet_id: wallet.id,
          type: ledger_type.TOPUP,
          currency: currencyType,
          amount: amount,
          balance_before: walletBalance.available_balance,
          balance_after: walletBalance.available_balance.plus(amount),
          reference_type: reference_type.STRIPE,
          reference_id: updatedStripeTopup.id,
          status: transaction_status.PENDING,
        },
      });
    });

    return res.status(200).send({
      message: "Stripe session created successfully",
      url: session.url,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).send({
      message:
        error.message || "An error occurred during stripe session creation.",
    });
  }
}

//controller to for the webhook handler to handle the stripe webhook event to update the stripe_topups row in the database and the ledger_transcation row in the database based on the event type (payment success, payment failed, payment canceled)
//this API will be accessed from outside source so we can not use the normal authenticaion and authorization middlewares that we use for our other APIs, instead we will verify the stripe signature to make sure that the request is coming from stripe
async function handleStripeWebhook(req: FastifyRequest, res: FastifyReply) {
  try {
    const signature = req.headers["stripe-signature"] as string;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

    let event: Stripe.Event;

    //MUST use rawBody
    try {
      //here we are using the constructEvent method from the stripe library to varify the signature and construct the event object from the request body
      //if the signature is invalid the constructEvent method will throw an error
      //otherwise we will get the event object that we can use to get the event type and the metadata that we added when we created the session
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET as string,
      );
    } catch (err) {
      console.error("Invalid Stripe signature:", err);
      return res.status(400).send({ message: "Invalid signature" });
    }

    //Idempotency check
    const existingEvent = await prisma.stripe_webhook_events.findUnique({
      where: { stripe_event_id: event.id },
    });

    if (existingEvent) {
      return res.send({ message: "Event already processed" });
    }

    // store event
    try {
      await prisma.stripe_webhook_events.create({
        data: {
          stripe_event_id: event.id,
          event_type: event.type,
          processed: false,
        },
      });
    } catch (e) {
      // already exists → Stripe retried → ignore safely
      return res.send({ message: "Event already processed" });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const { topupId, walletId, userId, amount, currency } =
        session.metadata || {};

      if (!topupId || !walletId || !userId || !amount || !currency) {
        return res.status(400).send({ message: "Missing metadata" });
      }

      const passedCurrency = currency.toUpperCase();

      await prisma.$transaction(async (tx) => {
        // 1. update topup
        const topup = await tx.stripe_topups.update({
          where: { id: topupId },
          data: {
            status: transaction_status.COMPLETED,
            stripe_payment_intent: session.payment_intent as string,
          },
        });

        // 2. get wallet balance (LOCK row)
        const balance = await tx.wallet_balances.findFirst({
          where: {
            wallet_id: walletId,
            currency: passedCurrency as currency_type,
          },
        });

        if (!balance) {
          throw new Error("Wallet balance not found");
        }

        const newBalance = balance.available_balance.plus(amount);

        // 3. update balance
        await tx.wallet_balances.update({
          where: { id: balance.id },
          data: {
            available_balance: newBalance,
          },
        });

        // 4. update ledger (PENDING → COMPLETED)
        await tx.ledger_transactions.updateMany({
          where: {
            reference_id: topupId,
            reference_type: reference_type.STRIPE,
          },
          data: {
            status: transaction_status.COMPLETED,
          },
        });

        // 5. mark event processed
        await tx.stripe_webhook_events.updateMany({
          where: { stripe_event_id: event.id },
          data: { processed: true },
        });

        await tx.notifications.create({
          data: {
            user_id: userId,
            type: notification_type.DEPOSIT,
            title: "Wallet Topup Successful",
            message: `Your wallet has been topped up with ${amount} ${passedCurrency}`,
            is_read: false,
            is_success: true,
            reference_type: reference_type.STRIPE,
            reference_id: topupId,
          },
        });
      });

      console.log(" Topup completed:", topupId);
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;

      const { topupId } = session.metadata || {};

      if (!topupId) {
        return res.status(400).send({ message: "Missing metadata" });
      }

      await prisma.$transaction(async (tx) => {
        // 1. update topup
        await tx.stripe_topups.update({
          where: { id: topupId },
          data: { status: transaction_status.FAILED },
        });

        // 2. update ledger
        await tx.ledger_transactions.updateMany({
          where: {
            reference_id: topupId,
            reference_type: reference_type.STRIPE,
          },
          data: {
            status: transaction_status.FAILED,
          },
        });

        // 3. mark event processed
        await tx.stripe_webhook_events.update({
          where: { stripe_event_id: event.id },
          data: { processed: true },
        });
      });

      console.log("Topup failed:", topupId);
    }

    return res.send({ received: true });
  } catch (error: any) {
    console.error(error);
    return res.status(500).send({
      message: error.message || "Webhook error",
    });
  }
}

// controller to get all the topups of the user in a paginated format
// there will be to main query parameters, first one which is the page number by default 1 and the second one is the limit and by default it will be 10
async function getOwnTopups(
  req: FastifyRequest<{ Querystring: getTopUpsQueryParams }>,
  res: FastifyReply,
) {
  try {
    const user_id = (req.user as jwtUserPayload).id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const offset = (page - 1) * limit;
    const topups = await prisma.stripe_topups.findMany({
      where: {
        user_id: user_id,
      },
      orderBy: {
        created_at: "desc",
      },
      skip: offset,
      take: limit,
    });

    return res.status(200).send({
      page: page,
      limit: limit,
      data: topups,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).send({
      message: error.message || "An error occurred while fetching user topups",
    });
  }
}

const cancelStripTopup = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const payload = req.user as jwtUserPayload;

    const user = await prisma.users.findUnique({
      where: {
        id: payload.id,
      },
    });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    const { topup_id } = req.body as { topup_id: string };

    const topup = await prisma.stripe_topups.update({
      where: {
        id: topup_id,
        user_id: payload.id,
      },
      data: {
        status: transaction_status.CANCELED,
      },
    });

    return res
      .status(200)
      .send({ message: "Topup cancelled successfully", topup });
  } catch (error: any) {
    console.error(error);
    return res.status(500).send({
      message: error.message || "An error occurred while cancelling the topup",
    });
  }
};

export {
  createStripeSession,
  handleStripeWebhook,
  getOwnTopups,
  cancelStripTopup,
};
