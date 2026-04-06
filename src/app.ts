import dotenv from "dotenv";
dotenv.config();

import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { connectDB } from "./config/db";

const fastify = Fastify({ logger: true });

//registering the jwt plugin
//which means we are adding the jwt functionality or capability to our fastify server instance
//we are are internally adding the sign and verify methods to the fastify instance which we can use to generate and verify the JWT tokens in our application
//the methods are going to be accessible through the req.server.jwt property
fastify.register(jwt, {
  secret: process.env.ACCESS_TOKEN_SECRET as string,
});

// Import my routes
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";

//registering the routes
//for the users 
fastify.register(userRoutes, { prefix: "/api/users" });

//for the authentication
fastify.register(authRoutes, { prefix: "/api/auth" });

// start server
const start = async () => {
  try {
    await connectDB();
    await fastify.listen({ port: Number(process.env.PORT) || 5000 });
    console.log(`Server is running on port ${process.env.PORT || 5000}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start();
