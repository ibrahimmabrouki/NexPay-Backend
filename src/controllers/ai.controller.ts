import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../config/prisma";
import jwtUserPayload from "../types/jwt.types";

const getAIResponse = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const user_id = (req.user as jwtUserPayload).id;

    if (!user_id) {
      return res.status(401).send({ error: "Unauthorized" });
    }

    const { question } = req.body as { question: string };

    const response = await fetch(process.env.AI_SERVICE_URL + "/api/chat-AI", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-INTERNAL-API-KEY": process.env.INTERNAL_API_KEY!,
      },
      body: JSON.stringify({ user_id, question }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res
        .status(response.status)
        .send({ error: data.error || "AI service error" });
    }
    res.send({ answer: data.answer });
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while retrieving AI response.",
    });
  }
};


export { getAIResponse };