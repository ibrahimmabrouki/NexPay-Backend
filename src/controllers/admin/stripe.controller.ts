import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../config/prisma";
import jwtUserPayload from "../../types/jwt.types";
import { getTopUpsQueryParams } from "../../types/topups";
import { user_role } from "../../generated/prisma/enums";

// controller for the admin to get all the topups in a paginated way
const getAllTopUps = async (
  req: FastifyRequest<{ Querystring: getTopUpsQueryParams }>,
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

    const topUps = await prisma.stripe_topups.findMany({
      include: {
        users: {
          select: {
            full_name: true,
            phone_number: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
      skip: offset,
      take: limit,
    });

    const result = topUps.map((t) => ({
      id: t.id,
      user_id: t.user_id,
      full_name: t.users.full_name,
      phone_number: t.users.phone_number,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      created_at: t.created_at,
    }));

    res.status(200).send(result);
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while creating the transfer.",
    });
  }
};

export { getAllTopUps };
