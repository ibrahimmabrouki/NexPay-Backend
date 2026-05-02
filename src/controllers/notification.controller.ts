import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../config/prisma";
import jwtUserPayload from "../types/jwt.types";
import {
  getAuthenticatedNotificationsQueryParams,
  markNotificationAsReadPathParams,
} from "../types/notification";

// controller to get the notifications from the database in paginated form
// this controller will be dynamic where the user can specify the page number and the number of notificaions per page
// by default the page number will be 1 and the number of notification per page will be 10
// the returned notifications will be sorted by the created_at field in descending order which means the latest notification will be returned first
async function getNotifications(
  req: FastifyRequest<{
    Querystring: getAuthenticatedNotificationsQueryParams;
  }>,
  res: FastifyReply,
) {
  try {
    const user_id = (req.user as jwtUserPayload).id;
    // here we are parsing the page number from the query parameter which is string to number and if the page number is not provided the default value will be 1

    // getting the page number if sent
    const page = Number(req.query.page ?? 1);
    // getting the limit if sent
    const limit = Number(req.query.limit ?? 10);
    // calculating the offset which is the number of notifications to skip based on the page number and the limit
    const offset = (page - 1) * limit;

    const notifications = await prisma.notifications.findMany({
      where: {
        user_id: user_id,
      },
      orderBy: {
        created_at: "desc",
      },
      skip: offset,
      take: limit,
    });

    // here am seding the page which is the current page number.
    // so if the page is 2 and the limit is 10 then the we should have skipped the first 10 notifications
    res.status(200).send({
      page: page,
      limit: limit,
      data: notifications,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).send({
      message:
        error.message || "An error occurred during notification retrieval.",
    });
  }
}

// controller to markt the notifcation which was unread to be read
async function markNotificationAsRead(
  req: FastifyRequest<{ Params: markNotificationAsReadPathParams }>,
  res: FastifyReply,
) {
  try {
    const user_id = (req.user as jwtUserPayload).id;
    const notification_id = req.params.id;

    // first we will check if the notification exists and belongs to the user
    const notification = await prisma.notifications.findFirst({
      where: {
        id: notification_id,
        user_id: user_id,
      },
    });

    if (!notification) {
      return res.status(404).send({ message: "Notification not found" });
    }

    // if the notification is already read we will return a message to the user
    if (notification.is_read) {
      return res
        .status(400)
        .send({ message: "Notification is already marked as read" });
    }

    // if the notification exists and belongs to the user we will update the is_read field to true
    await prisma.notifications.update({
      where: {
        id: notification_id,
      },
      data: {
        is_read: true,
      },
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).send({
      message:
        error.message ||
        "An error occurred during notification marking as read.",
    });
  }
}

// controller to mark all the notifications of the user as read
async function markAllNotificationsAsRead(
  req: FastifyRequest,
  res: FastifyReply,
) {
  try {
    const user_id = (req.user as jwtUserPayload).id;
    // we will update all the notifications of the user to be read by setting the is_read field to true
    await prisma.notifications.updateMany({
      where: {
        user_id: user_id,
        is_read: false, // we will only update the notifications which are unread to be read
      },
      data: { is_read: true },
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).send({
      message:
        error.message ||
        "An error occurred during notification marking as read.",
    });
  }
}

// controller to get the count of the unread notifications for the user
async function getUnreadNotificationsCount(
  req: FastifyRequest,
  res: FastifyReply,
) {
  try {
    const user_id = (req.user as jwtUserPayload).id;
    // we will count the number of notifications which are unread for the user by counting the number of notifications which have the is_read field set to false
    const count = await prisma.notifications.count({
      where: {
        user_id: user_id,
        is_read: false,
      },
    });
    res.status(200).send({ count });
  } catch (error: any) {
    console.error(error);
    res.status(500).send({
      message:
        error.message ||
        "An error occurred during getting the count of unread notifications.",
    });
  }
}

export {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationsCount,
};
