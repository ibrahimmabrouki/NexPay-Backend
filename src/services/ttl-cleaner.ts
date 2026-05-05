import { prisma } from "../config/prisma";

async function cleanOldMessages() {
  await prisma.chat_messages.deleteMany({
    where: {
      created_at: {
        lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      },
    },
  });

  console.log("TTL cleanup done");
}

cleanOldMessages();


// this script will run every day at midnight and it will delete all the chat messages that are older than 14 days from the database
// we are going to use corn job to schedule this script so the system will run this automatically every day at midnight

// use the following command to schedule this script to run every day at midnight