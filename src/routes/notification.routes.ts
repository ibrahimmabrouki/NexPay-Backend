import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationsCount,
  getTotalNotificationsCount,
} from "../controllers/notification.controller";
import {
  getAuthenticatedNotificationsQueryParams,
  markNotificationAsReadPathParams,
} from "../types/notification";

import { user_role } from "../generated/prisma/enums";

import { FastifyInstance } from "fastify";
import { authenticateUser, authorizeRoles } from "../middlewares/auth";

async function notificationRoutes(fastify: FastifyInstance, options: any) {
  // route to get the notification of the authenticated user in paginated form
  fastify.get<{ Querystring: getAuthenticatedNotificationsQueryParams }>(
    "/",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.USER, user_role.COMPANY),
      ],
    },
    getNotifications,
  );

  //   route to mark a specific notification as read by its id
  fastify.post<{ Params: markNotificationAsReadPathParams }>(
    "/mark-as-read/:id",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.USER, user_role.COMPANY),
      ],
    },
    markNotificationAsRead,
  );

  // route to mark all the notifications of the user as read
  fastify.post(
    "/mark-all-as-read",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.USER, user_role.COMPANY),
      ],
    },
    markAllNotificationsAsRead,
  );

  //   route to get the count of the unread notifications for the user
  fastify.get(
    "/unread-count",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.USER, user_role.COMPANY),
      ],
    },
    getUnreadNotificationsCount,
  );

  //   route to get the total count of notifications for the user
  fastify.get(
    "/total-count",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.USER, user_role.COMPANY),
      ],
    },
    getTotalNotificationsCount,
  );
}

export default notificationRoutes;
