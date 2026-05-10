import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../config/prisma";
import { user_role } from "../../generated/prisma/enums";
import jwtUserPayload from "../../types/jwt.types";
import { getTransfersQueryParams } from "../../types/tranfer";

// controller for the admin to get all the transfers in a paginated way
const getAllTransfers = async (
  req: FastifyRequest<{ Querystring: getTransfersQueryParams }>,
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

    const transfers = await prisma.transfers.findMany({
      include: {
        users_transfers_receiver_idTousers: {
          select: {
            full_name: true,
            phone_number: true,
          },
        },
        users_transfers_sender_idTousers: {
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

    const result = transfers.map((t) => ({
      id: t.id,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      created_at: t.created_at,
      description: t.description,

      // unified user object
      sender: t.users_transfers_sender_idTousers,
      receiver: t.users_transfers_receiver_idTousers,
    }));
    res.send({
      page: page,
      limit: limit,
      data: result,
    });
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while creating the transfer.",
    });
  }
};

export { getAllTransfers };
