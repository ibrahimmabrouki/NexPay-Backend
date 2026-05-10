import { FastifyInstance } from "fastify";
import { user_role } from "../../generated/prisma/enums";
import { authenticateUser, authorizeRoles } from "../../middlewares/auth";
import { changeUserCredentials } from "../../controllers/admin/credentials.controller";

async function adminCredentialRoutes(fastify: FastifyInstance, options: any) {
  fastify.put(
    "/",
    {
      preHandler: [authenticateUser, authorizeRoles(user_role.STAFF)],
    },
    changeUserCredentials,
  );
}

export default adminCredentialRoutes;