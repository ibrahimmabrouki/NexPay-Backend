import { login, logout, refreshToken } from "../controllers/auth.controllers";
import { FastifyInstance } from "fastify";

async function authRoutes(fastify: FastifyInstance, options: any) {
    fastify.post("/login", login);
    fastify.post("/logout", logout);
    fastify.post("/refresh-token", refreshToken);
}


export default authRoutes;