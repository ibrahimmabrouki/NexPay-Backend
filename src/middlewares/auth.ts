import { FastifyRequest, FastifyReply } from "fastify";

async function authenticateUser(req: FastifyRequest, res: FastifyReply) {
  try {
    // now it is goig to automatically verify the access token that is sent in the authorization header of the request and if it is valid it will return the payload which contains the information about the user and then we can use that information to authorize the user to access the protected routes
    await req.jwtVerify();
  } catch (error: any) {
    return res.status(401).send({
      message: error.message || "Unauthorized",
    });
  }
}

export default authenticateUser;
