import { prisma } from "../config/prisma";
import { hashPassword, comparePassword } from "../utils/hash";
import { user_role } from "../generated/prisma/client";
import {
  CreateUserDTO,
  UserResponseDTO,
  RegisterUserDTO,
} from "../types/user.types";
import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import jwtUserPayload from "../types/jwt.types";
import jwt from "jsonwebtoken";

//few things to note about this file:
//we aleady registered the methods to sign and verify the JWT tokens in the app.ts where we assigned them to the fastify instance
//this instance is req.server we it is gonna be passed to the services that generate the access token and refresh token as a parameter so that we can use the sign method to generate the tokens in those services

// user login function
async function login(req: FastifyRequest, res: FastifyReply) {
  try {
    const { phone_number, password } = req.body as {
      phone_number: string;
      password: string;
    };

    const user = await prisma.users.findUnique({
      where: { phone_number },
    });

    if (!user) {
      return res.status(404).send({
        message: "User not found with phone number " + phone_number,
      });
    }

    const isMatch = await comparePassword(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).send({ message: "Invalid password" });
    }

    const payload: jwtUserPayload = {
      id: user.id,
      phone_number: user.phone_number,
      role: user.role,
    };

    const accessToken = generateAccessToken(req.server, payload);
    const refreshToken = generateRefreshToken(payload);

    // Set refresh token in cookie
    res.setCookie("refreshToken", refreshToken, {
      httpOnly: true, //cannot be accessed by JS
      secure: false, //true in production (HTTPS)
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days (seconds)
    });

    res.status(200).send({
      accessToken,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).send({
      message: error.message || "Login error",
    });
  }
}

// user registration function
async function Register(req: FastifyRequest, res: FastifyReply) {
  try {
    const { full_name, phone_number, password, confirmPassword } =
      req.body as RegisterUserDTO;

    //check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { phone_number },
    });

    if (existingUser) {
      return res.status(400).send({
        message: "User with this phone number already exists",
      });
    }

    if (password !== confirmPassword) {
      console.log(password, confirmPassword);
      return res.status(400).send({
        message: "Passwords do not match",
      });
    }

    //hash password
    const hashedPassword = await hashPassword(password);

    //create user
    const user = await prisma.users.create({
      data: {
        full_name,
        phone_number,
        password_hash: hashedPassword,
        role: user_role.USER, // default role
      },
    });

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
      },
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).send({
      message: error.message || "Registration error",
    });
  }
}

//user logout function
async function logout(req: FastifyRequest, res: FastifyReply) {
  try {
    const refreshToken = req.cookies.refreshToken;

    // if the refresh token is not found in the cookies it means that the user is not logged in or the cookie is not set properly so we will return an error
    if (!refreshToken) {
      return res.status(400).send({ message: "Refresh token required" });
    }

    //here we are going to clear the refresh token from the cookie by setting it an empty value
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).send({ message: "Logged out successfully" });
  } catch (error: any) {
    return res.status(500).send({
      message: error.message || "Logout error",
    });
  }
}

async function refreshAccessToken(req: FastifyRequest, res: FastifyReply) {
  try {
    const refreshToken = req.cookies.refreshToken;

    // if the refresh token is not found in the cookies it means that the user is not logged in or the cookie is not set properly so we will return an error
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
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
    });

    //  if the user is not found or the refresh token in the database of that user is not the same as the refresh token sent in the request it means that the refresh token is invalid and we will return an error
    if (!user) {
      return res.status(403).send({ message: "Invalid refresh token" });
    }

    const newAccessToken = generateAccessToken(req.server, {
      id: user.id,
      phone_number: user.phone_number,
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

async function getCurrentUser(req: FastifyRequest, res: FastifyReply) {
  try {
    // after the user is authenticated and the access token is verified successfully in the authenticateUser middleware we can access the payload of the token which contains the information about the user through the req.user property and then we can use that information to get the current user from the database and return it in the response
    const userId = (req.user as jwtUserPayload).id;
    const user = await prisma.users.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    res.status(200).send({
      id: user.id,
      full_name: user.full_name,
      phone_number: user.phone_number,
      role: user.role,
      address: user.address,
      profile_image: user.profile_image,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while retrieving the user.",
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

export { login, logout, refreshAccessToken, Register, getCurrentUser };
