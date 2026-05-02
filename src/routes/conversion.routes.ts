import { FastifyInstance } from "fastify";
import { convertCurrency, getConversions } from "../controllers/conversion.controller";
import { user_role } from "../generated/prisma/enums";

import { authenticateUser, authorizeRoles } from "../middlewares/auth";
import { getConversionQueryParams } from "../types/conversion";

async function conversionRoutes(fastify: FastifyInstance, options: any) {
  fastify.post(
    "/",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.USER, user_role.COMPANY),
      ],
    },
    convertCurrency,
  );
  fastify.get<{ Querystring: getConversionQueryParams}>(
    "/",
    {
      preHandler: [
        authenticateUser,
        authorizeRoles(user_role.USER, user_role.COMPANY),
      ],
    },
    getConversions
  );
}

export default conversionRoutes;
