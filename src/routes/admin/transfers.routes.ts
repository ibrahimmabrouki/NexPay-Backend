import { FastifyInstance } from "fastify";
import { getAllTransfers } from "../../controllers/admin/transfers.controller";
import { user_role } from "../../generated/prisma/enums";
import { getTransfersQueryParams } from "../../types/tranfer";

import { authenticateUser, authorizeRoles } from "../../middlewares/auth";

async function adminTransferRoutes(fastify: FastifyInstance, options: any) {
  fastify.get<{ Querystring: getTransfersQueryParams }>(
    "/",
    {
      preHandler: [authenticateUser, authorizeRoles(user_role.STAFF)],
    },
    getAllTransfers,
  );
}

export default adminTransferRoutes;
