import dotenv from "dotenv";
dotenv.config();

import cookie from "@fastify/cookie";
import rawBody from "fastify-raw-body";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

const fastify = Fastify({ logger: true });

//registering the jwt plugin
//which means we are adding the jwt functionality or capability to our fastify server instance
//we are are internally adding the sign and verify methods to the fastify instance which we can use to generate and verify the JWT tokens in our application
//the methods are going to be accessible through the req.server.jwt property
fastify.register(jwt, {
  secret: process.env.ACCESS_TOKEN_SECRET as string,
});

fastify.register(cors, {
  origin: process.env.FRONTEND_URL as string, // frontend
  credentials: true, // REQUIRED for cookies
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

fastify.register(rawBody, {
  field: "rawBody",
  global: false,
  encoding: "utf8",
  runFirst: true,
});

fastify.register(multipart);

// fastify.register(require("@fastify/multipart"));

fastify.register(cookie, {
  secret: process.env.COOKIE_SECRET as string,
  parseOptions: { httpOnly: true, secure: false, sameSite: "strict" },
});
// secure: false for development, true for production (requires HTTPS)

// Import my routes
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";
import transferRoutes from "./routes/transfer.routes";
import conversionRoutes from "./routes/conversion.routes";
import notificationRoutes from "./routes/notification.routes";
import notificationPrefRoutes from "./routes/notificationPref.routes";
import walletRoutes from "./routes/wallet.routes";
import stripeRoutes from "./routes/stripe.routes";
import aiRoutes from "./routes/ai.routes";
import currencyRateRoutes from "./routes/currencyRate.routes";

// these are the admin routes
import adminTransferRoutes from "./routes/admin/transfers.routes";
import adminTopUpsRoutes from "./routes/admin/stripe.routes";
import adminAnnouncementRoutes from "./routes/admin/announcment.routes";
import adminCredentialRoutes from "./routes/admin/credential.routes";
import adminUserManagementRoutes from "./routes/admin/user.managment.routes";
import adminExchangeRateRoutes from "./routes/admin/exchangeRate.routes";

//registering the routes
//for the users
fastify.register(userRoutes, { prefix: "/api/users" });

//for the authentication
fastify.register(authRoutes, { prefix: "/api/auth" });

//for the transfers
fastify.register(transferRoutes, { prefix: "/api/transfers" });

//for the currency conversion
fastify.register(conversionRoutes, { prefix: "/api/conversions" });

//for the notifications
fastify.register(notificationRoutes, { prefix: "/api/notifications" });

//for the notification preferences
fastify.register(notificationPrefRoutes, {
  prefix: "/api/notification-preferences",
});

//for the wallet
fastify.register(walletRoutes, { prefix: "/api/wallet" });

//for the stripe payment gateway
fastify.register(stripeRoutes, { prefix: "/api/stripe" });

//for the AI service
fastify.register(aiRoutes, { prefix: "/api/ai" });

//for the currency rates
fastify.register(currencyRateRoutes, { prefix: "/api/currency-rates" });

// registering the admin routes
fastify.register(adminTransferRoutes, { prefix: "/api/admin/transfers" });
fastify.register(adminTopUpsRoutes, { prefix: "/api/admin/top-ups" });
fastify.register(adminAnnouncementRoutes, {
  prefix: "/api/admin/announcements",
});
fastify.register(adminCredentialRoutes, {
  prefix: "/api/admin/credentials",
});
fastify.register(adminUserManagementRoutes, {
  prefix: "/api/admin/users",
});
fastify.register(adminExchangeRateRoutes, {
  prefix: "/api/admin/exchange-rates",
});

// start server
const start = async () => {
  try {
    await fastify.listen({ port: Number(process.env.PORT) || 5000 });
    console.log(`Server is running on port ${process.env.PORT || 5000}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start();
