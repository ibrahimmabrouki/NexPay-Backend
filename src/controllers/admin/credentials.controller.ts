import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma";
import jwtUserPayload from "../../types/jwt.types";
import { hashPassword } from "../../utils/hash";
import { user_role } from "../../generated/prisma/enums";

// controller for the admin to change the credentials of the user whether it is the phone number or the password
const changeUserCredentials = async (
  req: FastifyRequest,
  res: FastifyReply,
) => {
  try {
    const staffUserId = req.user as jwtUserPayload;
    const staffUser = await prisma.users.findUnique({
      where: { id: staffUserId.id },
    });

    if (!staffUser) {
      return res.status(404).send({ message: "User not found" });
    }

    if (staffUser.role !== user_role.STAFF) {
      return res.status(403).send({ message: "Forbidden" });
    }

    const { user_id, new_phone_number, new_password } = req.body as {
      user_id: string;
      new_phone_number?: string;
      new_password?: string;
    };

    const existingUser = await prisma.users.findUnique({
      where: { phone_number: new_phone_number || "" },
    });

    if (existingUser && existingUser.id !== user_id) {
      return res.status(400).send({ message: "Phone number already in use" });
    }

    const targetUser = await prisma.users.findUnique({
      where: { id: user_id },
    });

    if (!targetUser) {
      return res.status(404).send({ message: "Target user not found" });
    }

    const updatedData: { phone_number?: string; password_hash?: string } = {};

    if (new_password) {
      const hashedPassword = await hashPassword(new_password);
      updatedData.password_hash = hashedPassword;
    }

    if (new_phone_number) {
      updatedData.phone_number = new_phone_number;
    }

    await prisma.users.update({
      where: { id: user_id },
      data: updatedData,
    });

    return res.status(200).send({
      message: "User credentials updated successfully",
    });
  } catch (error: any) {
    res.status(500).send({
      message: "An error occurred while changing the user's credentials",
      error: error.message,
    });
  }
};

export { changeUserCredentials };
