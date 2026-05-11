import { FastifyInstance } from "fastify";
import { user_role } from "../../generated/prisma/enums";
import { authenticateUser, authorizeRoles } from "../../middlewares/auth";
import {
  getAllUsers,
  updateUser,
  getUserById,
} from "../../controllers/admin/user.managment.controller";

async function adminUserManagementRoutes(
  fastify: FastifyInstance,
  options: any,
) {
  fastify.get(
    "/",
    {
      preHandler: [authenticateUser, authorizeRoles(user_role.STAFF)],
    },
    getAllUsers,
  );
  fastify.patch(
    "/:id",
    {
      preHandler: [authenticateUser, authorizeRoles(user_role.STAFF)],
    },
    updateUser,
  );

  fastify.get(
    "/:id",
    {
      preHandler: [authenticateUser, authorizeRoles(user_role.STAFF)],
    },
    getUserById,
  );
}

export default adminUserManagementRoutes;
