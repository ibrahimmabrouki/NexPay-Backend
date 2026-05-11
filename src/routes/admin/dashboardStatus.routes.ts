import { FastifyInstance } from "fastify";
import  getDashboardStatus  from "../../controllers/admin/dashboardStatus.controller";
import { user_role } from "../../generated/prisma/enums";
import { authenticateUser, authorizeRoles } from "../../middlewares/auth";

async function adminDashboardStatusRoutes(fastify: FastifyInstance, options: any) {
    fastify.get(
        "/",
        {
          preHandler: [authenticateUser, authorizeRoles(user_role.STAFF)],
        },
        getDashboardStatus,
      );
}

export default adminDashboardStatusRoutes;

