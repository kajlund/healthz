import express, { type ErrorRequestHandler } from "express";

export const app = express();

app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use((_request, response) => {
  response.status(404).json({ error: "Not Found" });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : 500;
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "Request failed";

  response.status(status).json({
    error: status === 500 ? "Internal Server Error" : message,
  });
};

app.use(errorHandler);
