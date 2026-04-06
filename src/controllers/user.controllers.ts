import User from "../models/user.model";

import { FastifyRequest, FastifyReply } from "fastify";

async function getAllUsers(req: FastifyRequest, res: FastifyReply) {
  try {
    const users = await User.find();
    res.status(200).send(users);
  } catch (error: any) {
    res.status(500).send({
      message: error.message || "Some error occurred while retrieving users.",
    });
  }
}

async function getUserById(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).send({ message: "User not found with id " + id });
    }
    res.status(200).send(user);
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while retrieving the user.",
    });
  }
}

async function createUser(req: FastifyRequest, res: FastifyReply) {
  try {
    const { name, email, password } = req.body as {
      name: string;
      email: string;
      password: string;
    };
    const newUser = { name: name, email: email, password: password };
    const savedUser = await User.create(newUser);
    res.status(201).send(savedUser);
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while retrieving the user.",
    });
  }
}

async function updateUserById(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const { name, email, password, imageUrl } = req.body as {
      name: string;
      email: string;
      password: string;
      imageUrl: string;
    };
    const updatedData = {} as any;

    if (name) updatedData.name = name;
    if (email) updatedData.email = email;
    if (password) updatedData.password = password;
    if (imageUrl) updatedData.imageUrl = imageUrl;

    const updatedUser = await User.findByIdAndUpdate({ _id: id }, updatedData, {
      new: true,
    });
    if (!updatedUser) {
      return res.status(404).send({ message: "User not found with id " + id });
    }
    res.status(200).send(updatedUser);
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
    const deletedUser = await User.findByIdAndDelete(id);
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
