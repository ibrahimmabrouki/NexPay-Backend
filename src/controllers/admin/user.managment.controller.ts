import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../config/prisma";
import { user_role } from "../../generated/prisma/enums";
import jwtUserPayload from "../../types/jwt.types";

const getAllUsers = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const user_id = (req.user as jwtUserPayload).id;
    const userRole = (req.user as jwtUserPayload).role;
    if (userRole !== user_role.STAFF) {
      return res.status(403).send({ error: "Forbidden" });
    }
    const users = await prisma.users.findMany({
      select: {
        id: true,
        full_name: true,
        phone_number: true,
        role: true,
        created_at: true,
        address: true,
        is_active: true,
        updated_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });
    res.send({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send({ error: "An error occurred while fetching users" });
  }
};

async function updateUser(req: FastifyRequest, res: FastifyReply) {
  try {
    const user_id = (req.user as jwtUserPayload).id;
    const userRole = (req.user as jwtUserPayload).role;
    if (userRole !== user_role.STAFF) {
      return res.status(403).send({ error: "Forbidden" });
    }
    const { id } = req.params as { id: string };
    const existingUser = await prisma.users.findUnique({
      where: { id },
    });
    if (!existingUser) {
      return res.status(404).send({ error: "User not found" });
    }

    const { full_name, phone_number, address, is_active, country_code } = req.body as {
      full_name?: string;
      phone_number?: string;
      role?: user_role;
      address?: string;
      is_active?: boolean;
      country_code?: string;
    };

    const updatedData: {
      full_name?: string;
      phone_number?: string;
      address?: string;
      is_active?: boolean;
      country_code?: string;
    } = {};

    if (full_name) updatedData.full_name = full_name;
    if (phone_number) {
      const phoneExists = await prisma.users.findUnique({
        where: { phone_number },
      });
      if (phoneExists && phoneExists.id !== id) {
        return res.status(400).send({ error: "Phone number already exists" });
      }
      updatedData.phone_number = phone_number;
    }
    if (address) updatedData.address = address;
    if (is_active !== undefined) updatedData.is_active = is_active;
    if (country_code) updatedData.country_code = country_code;

    const updatedUser = await prisma.users.update({
      where: { id },
      data: updatedData,
      select: {
        id: true,
        full_name: true,
        country_code: true,
        phone_number: true,
        role: true,
        created_at: true,
        address: true,
        is_active: true,
        updated_at: true,
      },
    });
    res.send({ user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).send({ error: "An error occurred while updating user" });
  }
}

export { getAllUsers, updateUser };
