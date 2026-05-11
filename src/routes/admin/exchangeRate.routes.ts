import { FastifyInstance } from "fastify";
import {
  getExchangeRates,
  updateExchangeRates,
} from "../../controllers/admin/exchageRate.controller";
import { user_role } from "../../generated/prisma/enums";
import { authenticateUser, authorizeRoles } from "../../middlewares/auth";

async function adminExchangeRateRoutes(fastify: FastifyInstance, options: any) {
  fastify.get(
    "/",
    {
      preHandler: [authenticateUser, authorizeRoles(user_role.STAFF)],
    },
    getExchangeRates,
  );
  fastify.post(
    "/update",
    {
      preHandler: [authenticateUser, authorizeRoles(user_role.STAFF)],
    },
    updateExchangeRates,
  );
}

export default adminExchangeRateRoutes;


