import { getAIResponse } from "../controllers/ai.controller";
import { FastifyInstance } from "fastify";
import { user_role } from "../generated/prisma/enums";
import { authenticateUser, authorizeRoles } from "../middlewares/auth";

async function aiRoutes(fastify: FastifyInstance, options: any) {
  fastify.post(
    "/ai/chat",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.COMPANY, user_role.STAFF, user_role.USER),
      ],
    },
    getAIResponse,
  );
}

export default aiRoutes;