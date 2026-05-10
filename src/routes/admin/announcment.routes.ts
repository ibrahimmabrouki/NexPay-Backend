import { FastifyInstance } from "fastify";
import {
  getAllAnnouncements,
  postNewAnnouncment,
} from "../../controllers/admin/announcment.controller";
import { user_role } from "../../generated/prisma/enums";
import { getAnnouncementQueryParams } from "../../types/announcments";
import { authenticateUser, authorizeRoles } from "../../middlewares/auth";

async function adminAnnouncementRoutes(fastify: FastifyInstance, options: any) {
  fastify.get<{ Querystring: getAnnouncementQueryParams }>(
    "/",
    {
      preHandler: [authenticateUser, authorizeRoles(user_role.STAFF)],
    },
    getAllAnnouncements,
  );
  fastify.post(
    "/",
    {
      preHandler: [authenticateUser, authorizeRoles(user_role.STAFF)],
    },
    postNewAnnouncment,
  );
}

export default adminAnnouncementRoutes;
