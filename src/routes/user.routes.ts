import { FastifyInstance } from "fastify";
import {
    getAllUsers,
    getUserById,
    createUser,
    updateUserById,
    deleteUserById
} from "../controllers/user.controllers";


async function userRoutes(fastify: FastifyInstance, options: any) {
    fastify.get("/", getAllUsers);
    fastify.get("/:id", getUserById);
    fastify.post("/", createUser);
    fastify.patch("/:id", updateUserById);
    fastify.delete("/:id", deleteUserById);
}

export default userRoutes;