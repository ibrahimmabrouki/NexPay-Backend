import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma";
import jwtUserPayload from "../../types/jwt.types";
import { user_role } from "../../generated/prisma/enums";

// controller for the admin to get the dashboard status which will include the total number of users, total number of transactions and total number of deposits.

const getDashboardStatus = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const payload = req.user as jwtUserPayload;
    const user = await prisma.users.findUnique({
      where: { id: payload.id },
    });

    // getting the user from the database to check if the user is the staff or not.
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    const role = user?.role;

    // eventhough we added a middle ware but this is just for double check.
    if (role !== user_role.STAFF) {
      return res.status(403).send({ message: "Forbidden" });
    }

    const totalUsers = await prisma.users.count();
    const totalTransfers = await prisma.transfers.count();
    const totalDeposits = await prisma.stripe_topups.count();

    res.status(200).send({
      total_users: totalUsers,
      total_transfers: totalTransfers,
      total_deposits: totalDeposits,
    });
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message ||
        "Some error occurred while retrieving dashboard status.",
    });
  }
};


export default getDashboardStatus;