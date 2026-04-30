import { FastifyInstance } from "fastify";
import { createTransfer } from "../controllers/transfer.controller";
import { user_role } from "../generated/prisma/enums";

import { authenticateUser, authorizeRoles } from "../middlewares/auth";

async function transferRoutes(fastify: FastifyInstance, options: any) {
  fastify.post(
    "/",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.USER, user_role.COMPANY),
      ],
    },
    createTransfer,
  );
}

export default transferRoutes;
