import "@fastify/jwt";
import jwtUserPayload from "./jwt.types";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: jwtUserPayload; // used for signing
    user: jwtUserPayload; // used for request.user
  }
}
