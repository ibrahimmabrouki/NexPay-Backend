import {
  getNotifications,
  updateNotificationPreferences,
} from "../controllers/notificationPref.controller";
import { FastifyInstance } from "fastify";
import { authenticateUser, authorizeRoles } from "../middlewares/auth";
import { user_role } from "../generated/prisma/enums";

async function notificationRoutes(fastify: FastifyInstance, options: any) {
  // route to get the notification preferences of the authenticated user
  fastify.get(
    "/",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.USER, user_role.COMPANY),
      ],
    },
    getNotifications,
  );
  // route to update the notification preferences of the authenticated user
  fastify.patch(
    "/",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.USER, user_role.COMPANY),
      ],
    },
    updateNotificationPreferences,
  );
}


export default notificationRoutes;