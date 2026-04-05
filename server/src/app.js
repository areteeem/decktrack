const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@as-integrations/express4");
const { typeDefs } = require("./schema");
const resolvers = require("./resolvers");
const jwt = require("jsonwebtoken");

const JWT_ALGORITHMS = ["HS256"];

const whitelist = [
  process.env.FRONTEND_URL,
  "http://localhost",
  "http://localhost:3000",
  "https://studio.apollographql.com",
].filter(Boolean);

const getUser = (token) => {
  try {
    const user = jwt.verify(token, process.env.TOKEN_SECRET, {
      algorithms: JWT_ALGORITHMS,
    });
    return user;
  } catch (err) {
    return null;
  }
};

const createApolloServer = () => new ApolloServer({
  resolvers,
  typeDefs,
  csrfPrevention: true,
  debug: process.env.NODE_ENV !== "production",
  introspection: process.env.NODE_ENV !== "production",
});

const createCorsOptions = () => ({
  origin(origin, callback) {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
});

const createApp = async () => {
  const app = express();
  const apolloServer = createApolloServer();

  app.disable("x-powered-by");
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use(cors(createCorsOptions()));

  await apolloServer.start();
  app.use(
    "/graphql",
    expressMiddleware(apolloServer, {
      context: async ({ req, res }) => {
        const token = req.cookies?.token;
        if (!token) {
          return { req, res };
        }

        const user = getUser(token);
        if (!user) {
          return { req, res };
        }

        return { req, res, userId: user.userId };
      },
    })
  );

  return app;
};

module.exports = createApp;
