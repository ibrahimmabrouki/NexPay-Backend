import { getAIResponse, getChatHistory } from "../controllers/ai.controller";
import { FastifyInstance } from "fastify";
import { user_role } from "../generated/prisma/enums";
import { authenticateUser, authorizeRoles } from "../middlewares/auth";
import { getAIChatHistoryQueryParams } from "../types/aiChatHistory";

async function aiRoutes(fastify: FastifyInstance, options: any) {
  fastify.post(
    "/chat",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.COMPANY, user_role.STAFF, user_role.USER),
      ],
    },
    getAIResponse,
  );

  fastify.get<{ Querystring: getAIChatHistoryQueryParams }>(
    "/chat/history",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.COMPANY, user_role.STAFF, user_role.USER),
      ],
    },
    getChatHistory,
  );
}

export default aiRoutes;
