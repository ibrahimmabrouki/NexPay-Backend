import { FastifyInstance } from "fastify";
import { user_role } from "../../generated/prisma/enums";
import { getTopUpsQueryParams } from "../../types/topups";
import { authenticateUser, authorizeRoles } from "../../middlewares/auth";
import { getAllTopUps } from "../../controllers/admin/stripe.controller";

async function adminTopUpsRoutes(fastify: FastifyInstance, options: any) {
  fastify.get<{ Querystring: getTopUpsQueryParams }>(
    "/",
    {
      preHandler: [authenticateUser, authorizeRoles(user_role.STAFF)],
    },
    getAllTopUps,
  );
}

export default adminTopUpsRoutes;
