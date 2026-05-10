import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma";
import jwtUserPayload from "../../types/jwt.types";
import { user_role, notification_type } from "../../generated/prisma/enums";
import { getAnnouncementQueryParams } from "../../types/announcments";

// controller for the admin to get all the announcements in a paginated way
const getAllAnnouncements = async (
  req: FastifyRequest<{ Querystring: getAnnouncementQueryParams }>,
  res: FastifyReply,
) => {
  try {
    const user_id = req.user as jwtUserPayload;
    const user = await prisma.users.findUnique({
      where: { id: user_id.id },
    });

    // getting the user from the database to check if the user is the staff or not.
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    // eventhough we added a middle ware but this is just for double check.
    if (user.role !== user_role.STAFF) {
      return res.status(403).send({ message: "Forbidden" });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const announcements = await prisma.announcements.findMany({
      include: {
        users: {
          select: {
            full_name: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
      skip: offset,
      take: limit,
    });

    res.status(200).send({
      page: page,
      limit: limit,
      data: announcements,
    });
  } catch (error: any) {
    res.status(500).send({
      message: "An error occurred while fetching the announcements",
      error: error.message,
    });
  }
};

// controller for the admin to post new announcements and send it as notification to all registerd users
const postNewAnnouncment = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const user_id = req.user as jwtUserPayload;
    const user = await prisma.users.findUnique({
      where: { id: user_id.id },
    });

    // getting the user from the database to check if the user is the staff or not.
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    // eventhough we added a middle ware but this is just for double check.
    if (user.role !== user_role.STAFF) {
      return res.status(403).send({ message: "Forbidden" });
    }

    const { title, message } = req.body as {
      title: string;
      message: string;
    };

    const user_ids = await prisma.users.findMany({
      where: {
        is_active: true,
      },

      select: {
        id: true,
      },
    });

    const ids = user_ids.map((u) => u.id);
    const announcments = await prisma.notifications.createMany({
      data: ids.map((id) => ({
        user_id: id,
        title: title,
        message: message,
        type: notification_type.ANNOUNCEMENT,
      })),
    });

    const adminAnnouncement = await prisma.announcements.create({
      data: {
        admin_id: user_id.id,
        admin_name: user.full_name,
        title: title,
        message: message,
      },
    });

    return res.status(201).send({
      message: "Announcement posted successfully",
      count: announcments.count,
    });

    // prisma.
  } catch (error: any) {
    res.status(500).send({
      message: "An error occurred while posting the announcement",
      error: error.message,
    });
  }
};

export { getAllAnnouncements, postNewAnnouncment };
