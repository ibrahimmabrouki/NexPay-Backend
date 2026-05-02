import {
  Register,
  login,
  logout,
  refreshAccessToken,
  getCurrentUser,
} from "../controllers/auth.controllers";
import { FastifyInstance } from "fastify";
import { authenticateUser } from "../middlewares/auth";

async function authRoutes(fastify: FastifyInstance, options: any) {
  fastify.post("/login", login);
  fastify.post("/logout", logout);
  fastify.post("/register", Register);
  fastify.get("/refresh-token", refreshAccessToken);
  fastify.get("/me", { preHandler: [authenticateUser] }, getCurrentUser);
}

export default authRoutes;
