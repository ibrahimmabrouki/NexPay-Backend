import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../config/prisma";
import jwtUserPayload from "../types/jwt.types";
import { notificationPreference } from "../types/notificationPreference";

// controller to get the notification-prefrences of the authenticated user
async function getNotifications(req: FastifyRequest, res: FastifyReply) {
  try {
    const user_id = (req.user as jwtUserPayload).id;
    // now we want to get the notifications prefrences (setting of the user)
    const notificationPreferences =
      await prisma.notification_preferences.findFirst({
        where: {
          user_id: user_id,
        },
      });
    res.status(200).send({ data: notificationPreferences });
  } catch (error: any) {
    console.error(error);
    res.status(500).send({
      message:
        error.message ||
        "An error occurred during notification preference retrieval.",
    });
  }
}

// controller to update the notification preferences of the user
async function updateNotificationPreferences(
  req: FastifyRequest,
  res: FastifyReply,
) {
  try {
    const user_id = (req.user as jwtUserPayload).id;

    const { receive_enabled, send_enabled, deposit_enabled } =
      req.body as notificationPreference;

    const newNotificationPreference: any = {};

    if (receive_enabled !== undefined) {
      newNotificationPreference.receive_enabled = receive_enabled;
    }

    if (send_enabled !== undefined) {
      newNotificationPreference.send_enabled = send_enabled;
    }

    if (deposit_enabled !== undefined) {
      newNotificationPreference.deposit_enabled = deposit_enabled;
    }

    // we will update the notification preferences of the user by updating the record in the notification_preferences table which has the user_id of the authenticated user
    const updatedNotificationPreference =
      await prisma.notification_preferences.update({
        where: { user_id: user_id },
        data: newNotificationPreference,
      });
    res.status(200).send({ data: updatedNotificationPreference });
  } catch (error: any) {
    console.error(error);
    res.status(500).send({
      message:
        error.message ||
        "An error occurred during notification preference update.",
    });
  }
}


export { getNotifications, updateNotificationPreferences };