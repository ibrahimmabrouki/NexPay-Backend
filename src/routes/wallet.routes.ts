import { FastifyInstance } from "fastify";
import { getWalletBalances } from "../controllers/wallet.controller";
import { user_role } from "../generated/prisma/enums";
import { authenticateUser, authorizeRoles } from "../middlewares/auth";

async function walletRoutes(fastify: FastifyInstance, options: any) {
  fastify.get(
    "/balances",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.USER, user_role.COMPANY),
      ],
    },
    getWalletBalances,
  );
}

export default walletRoutes;