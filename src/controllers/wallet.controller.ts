import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../config/prisma";
import jwtUserPayload from "../types/jwt.types";

// controller to get the wallet balances of the autheticated user
const getWalletBalances = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const user_id = (req.user as jwtUserPayload).id;
    const wallet = await prisma.wallets.findFirst({});
    if (!wallet) {
      return res.status(404).send({ error: "Wallet not found" });
    }

    const wallet_balances = await prisma.wallet_balances.findMany({
      where: { wallet_id: wallet.id },
      select: {
        currency: true,
        available_balance: true,
        pending_balance: true,
      },
    });

    const response = {
      wallet_id: wallet.id,
      balances: wallet_balances,
    };
    res.send(response);
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message ||
        "Some error occurred while retrieving wallet balances.",
    });
  }
};

export { getWalletBalances };
