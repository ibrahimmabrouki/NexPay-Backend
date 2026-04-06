import User from "../models/user.model";
import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import jwtUserPayload from "../types/jwt.types";
import jwt from "jsonwebtoken";

//few things to note about this file:
//we aleady registered the methods to sign and verify the JWT tokens in the app.ts where we assigned them to the fastify instance
//this instance is req.server we it is gonna be passed to the services that generate the access token and refresh token as a parameter so that we can use the sign method to generate the tokens in those services

// user login function
async function login(req: FastifyRequest, res: FastifyReply) {
  try {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };
    const user = await User.findOne({ email: email });
    if (!user) {
      return res
        .status(404)
        .send({ message: "User not found with email " + email });
    }
    if (user.password !== password) {
      return res.status(401).send({ message: "Invalid password" });
    }
    const payload: jwtUserPayload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    // Generate JWT token
    const accessToken = generateAccessToken(req.server, payload);
    const refreshToken = generateRefreshToken(payload);

    // store the refresh token in the database.
    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).send({
      accessToken: accessToken,
      refreshToken: refreshToken,
    });
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while logging in the user.",
    });
  }
}

//user logout function
async function logout(req: FastifyRequest, res: FastifyReply) {
  try {
    const { refreshToken } = req.body as { refreshToken: string };

    if (!refreshToken) {
      return res.status(400).send({ message: "Refresh token required" });
    }

    const user = await User.findOne({ refreshToken });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    // remove refresh token
    user.refreshToken = null;
    await user.save();

    return res.status(200).send({ message: "Logged out successfully" });
  } catch (error: any) {
    return res.status(500).send({
      message: error.message || "Logout error",
    });
  }
}

async function refreshToken(req: FastifyRequest, res: FastifyReply) {
  try {
    // the frontend will send the refresh token in the body of the request after getting it from the cookie or local storage
    const { refreshToken } = req.body as { refreshToken: string };

    if (!refreshToken) {
      return res.status(400).send({ message: "Refresh token required" });
    }

    // here we are going to verify the refresh token and if it is valid it will return the payload which contains the
    // information about the user and then we will use that information to generate a new access token for the user
    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET as string,
    ) as jwtUserPayload;

    // using the id of the user in the payload accompained with the refresh token we are going to find the user
    const user = await User.findById(decoded.id);

    //  if the user is not found or the refresh token in the database of that user is not the same as the refresh token sent in the request it means that the refresh token is invalid and we will return an error
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).send({ message: "Invalid refresh token" });
    }

    const newAccessToken = generateAccessToken(req.server, {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return res.status(200).send({
      accessToken: newAccessToken,
    });
  } catch (error: any) {
    return res.status(403).send({
      message: "Invalid or expired refresh token",
    });
  }
}

// services to generate the token whether it is refresh token or access token
function generateAccessToken(
  fastify: FastifyInstance,
  payload: jwtUserPayload,
) {
  return fastify.jwt.sign(payload, {
    expiresIn: process.env.SECRET_TOKEN_EXPIRE as string,
  });
}

function generateRefreshToken(payload: jwtUserPayload) {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET as string, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRE as any,
  });
}

export { login, logout, refreshToken };
