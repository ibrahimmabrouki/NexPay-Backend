import { getExchangeRateController } from "../controllers/currencyRate.controller";
import { FastifyInstance } from "fastify";
import { user_role } from "../generated/prisma/enums";
import { authenticateUser, authorizeRoles } from "../middlewares/auth";

async function currencyRateRoutes(fastify: FastifyInstance, options: any) {
  fastify.get(
    "/exchange-rate/:from_currency/:to_currency",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.COMPANY, user_role.STAFF, user_role.USER),
      ],
    },
    getExchangeRateController,
  );
}

export default currencyRateRoutes;