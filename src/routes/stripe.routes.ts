import {
  createStripeSession,
  handleStripeWebhook,
  getOwnTopups,
} from "../controllers/stripe.controller";
import { getTopUpsQueryParams } from "../types/topups";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { user_role } from "../generated/prisma/enums";
import { authenticateUser, authorizeRoles } from "../middlewares/auth";

async function stripeRoutes(fastify: FastifyInstance, options: any) {
  fastify.post(
    "/create-session",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.USER, user_role.COMPANY),
      ],
    },
    createStripeSession,
  );
  fastify.post("/webhook", { config: { rawBody: true } }, handleStripeWebhook);

  fastify.get<{ Querystring: getTopUpsQueryParams }>(
    "/",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.USER, user_role.COMPANY),
      ],
    },
    getOwnTopups,
  );
}

export default stripeRoutes;
