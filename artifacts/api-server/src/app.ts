import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Requests arrive via Replit's shared reverse proxy (sets X-Forwarded-For).
// Trust exactly one hop so express-rate-limit/req.ip see the real client IP.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const PRODUCTION_ALLOWED_ORIGINS = [
  "https://erp.almusafirinternational.com",
  "https://portal.almusafirinternational.com",
  "https://almusafirinternational.com",
  "https://www.almusafirinternational.com",
];

app.use(
  cors(
    process.env.NODE_ENV === "production"
      ? {
          origin(origin, callback) {
            // Allow non-browser requests (no Origin header, e.g. curl/healthchecks)
            if (!origin || PRODUCTION_ALLOWED_ORIGINS.includes(origin)) {
              callback(null, true);
            } else {
              callback(new Error("Not allowed by CORS"));
            }
          },
        }
      : {
          origin: /^https?:\/\/localhost(:\d+)?$/,
        },
  ),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
