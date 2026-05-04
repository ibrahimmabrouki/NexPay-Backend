import { prisma } from "../config/prisma";
import { user_role } from "../generated/prisma/client";
import { hashPassword } from "../utils/hash";
import { CreateUserDTO, UserResponseDTO } from "../types/user.types";
import { uploadToImgBB } from "../utils/uploadToImgBB";

import { FastifyRequest, FastifyReply } from "fastify";

// this controller is used to get all the users from the backend
async function getAllUsers(req: FastifyRequest, res: FastifyReply) {
  try {
    const users = await prisma.users.findMany();
    const response: UserResponseDTO[] = users.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      country_code: user.country_code,
      phone_number: user.phone_number,
      role: user.role,
      address: user.address,
      profile_image: user.profile_image,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    res.status(200).send(response);
  } catch (error: any) {
    console.error("FULL ERROR:", error);
    res.status(500).send({
      message: error.message || "Some error occurred while retrieving users.",
    });
  }
}

// this controller is used to get a specific user by id from the backend
async function getUserById(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const user = await prisma.users.findUnique({
      where: {
        id: id,
      },
    });
    if (!user) {
      return res.status(404).send({ message: "User not found with id " + id });
    }
    const response: UserResponseDTO = {
      id: user.id,
      full_name: user.full_name,
      country_code: user.country_code,
      phone_number: user.phone_number,
      role: user.role,
      address: user.address,
      profile_image: user.profile_image,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    res.status(200).send(response);
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while retrieving the user.",
    });
  }
}

// this controller is used to create a new user in the backend
async function createUser(req: FastifyRequest, res: FastifyReply) {
  try {
    const { full_name, country_code, phone_number, password, confirmPassword } =
      req.body as CreateUserDTO;

    if (password !== confirmPassword) {
      console.log(password, confirmPassword);
      return res.status(400).send({
        message: "Passwords do not match",
      });
    }

    //hash password
    const hashedPassword = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      //create user

      const user = await tx.users.create({
        data: {
          full_name,
          country_code,
          phone_number,
          password_hash: hashedPassword,
          role: user_role.USER,
        },
      });

      // after creatinig the user we need to create a wallet fot the user and then create three different wallet_balances and attach them to the wallet
      // this action is just like initializing the wallet for the user
      const wallet = await tx.wallets.create({
        data: {
          user_id: user.id,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // then after creating the wallet we need to create three different wallet_balances for the three different currencies (USD, LBP, and EUR) and attach them to the wallet that we just created
      await tx.wallet_balances.createMany({
        data: [
          {
            wallet_id: wallet.id,
            currency: "USD",
            available_balance: 0,
            pending_balance: 0,
          },
          {
            wallet_id: wallet.id,
            currency: "LBP",
            available_balance: 0,
            pending_balance: 0,
          },
          {
            wallet_id: wallet.id,
            currency: "EUR",
            available_balance: 0,
            pending_balance: 0,
          },
        ],
      });

      await tx.notification_preferences.create({
        data: {
          user_id: user.id,
        },
      });

      return { user };
    });

    const user = result.user;

    // clean response (no password)
    res.status(201).send({
      message: "User created successfully",
      user: {
        id: user.id,
        full_name: user.full_name,
        phone_number: user.phone_number,
        role: user.role,
        address: user.address,
        profile_image: user.profile_image,
        created_at: user.created_at,
        updated_at: user.updated_at,
        country_code: user.country_code,
      },
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).send({
      message: error.message || "Creating User error",
    });
  }
}

// this controller is used to update a specific user by id in the backend
async function updateUserById(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const mpReq = req as any;

    let full_name: string | undefined;
    let address: string | undefined;
    let phone_number: string | undefined;
    let profile_image: string | undefined;

    if (mpReq.isMultipart()) {
      for await (const part of mpReq.parts()) {
        // update the prfile image if it is sent in the request
        if (part.type === "file" && part.fieldname === "profile_image") {
          profile_image = await uploadToImgBB(part.file);
        }

        if (part.type === "field") {
          if (part.fieldname === "full_name") {
            full_name = part.value;
          } else if (part.fieldname === "address") {
            address = part.value;
          } else if (part.fieldname === "phone_number") {
            phone_number = part.value;
          }
        }
      }
    } else {
      const body = req.body as any;
      full_name = body.full_name;
      address = body.address;
      phone_number = body.phone_number;
    }

    const updatedData: any = {};

    if (full_name) updatedData.full_name = full_name;
    if (address) updatedData.address = address;
    if (phone_number) updatedData.phone_number = phone_number;
    if (profile_image) updatedData.profile_image = profile_image;

    const updatedUser = await prisma.users.update({
      where: {
        id: id,
      },
      data: updatedData,
    });
    if (!updatedUser) {
      return res.status(404).send({ message: "User not found with id " + id });
    }
    const response: UserResponseDTO = {
      id: updatedUser.id,
      full_name: updatedUser.full_name,
      phone_number: updatedUser.phone_number,
      role: updatedUser.role,
      address: updatedUser.address,
      profile_image: updatedUser.profile_image,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at,
      country_code: updatedUser.country_code,
    };
    res.status(200).send(response);
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while retrieving the user.",
    });
  }
}

async function deleteUserById(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const deletedUser = await prisma.users.delete({
      where: {
        id: id,
      },
    });
    if (!deletedUser) {
      return res.status(404).send({ message: "User not found with id " + id });
    }
    res.status(200).send({ message: "User deleted successfully" });
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while retrieving the user.",
    });
  }
}

export { getAllUsers, getUserById, createUser, updateUserById, deleteUserById };
