const { prisma } = require("./db");
const bcrypt = require("bcryptjs");
const { GraphQLError } = require("graphql");
const jwt = require("jsonwebtoken");

const createToken = (userId) => jwt.sign({ userId }, process.env.TOKEN_SECRET, {
  algorithm: "HS256",
  expiresIn: process.env.TOKEN_EXPIRY,
});

const ensureAuthenticated = (context) => {
  if (context.userId) {
    return;
  }

  throw new GraphQLError("Not authenticated", {
    extensions: {
      code: "UNAUTHENTICATED",
    },
  });
};

const resolvers = {
  Query: {
    logout: (parent, args, context) => {
      context.res.clearCookie("token");
      return true;
    },
    isAuthenticated: (parent, args, context) => {
      return !!context.userId;
    },
    user: (parent, args, context) => {
      ensureAuthenticated(context);
      return prisma.user.findFirst({
        where: {
          id: context.userId,
        },
        include: {
          decks: { include: { flashcards: true } },
          flashcards: true,
        },
      });
    },
    deck: (parent, args, context) => {
      ensureAuthenticated(context);
      return prisma.deck.findFirst({
        where: {
          id: args.id,
          // only return decks that belong to the user
          userId: context.userId,
        },
        include: {
          flashcards: {
            orderBy: {
              retention: "desc",
            },
          },
        },
      });
    },
    newFlashcards: (parent, args, context) => {
      ensureAuthenticated(context);
      return prisma.flashcard.findMany({
        where: {
          userId: context.userId,
          new: true,
        },
      });
    },
    dueFlashcards: (parent, args, context) => {
      ensureAuthenticated(context);
      return prisma.flashcard.findMany({
        where: {
          userId: context.userId,
          new: false,
          due: {
            lt: new Date(),
          },
        },
      });
    },
    newFromDeck: (parent, args, context) => {
      ensureAuthenticated(context);
      return prisma.flashcard.findMany({
        where: {
          deckId: args.deckId,
          userId: context.userId,
          new: true,
        },
      });
    },
    dueFromDeck: (parent, args, context) => {
      ensureAuthenticated(context);
      return prisma.flashcard.findMany({
        where: {
          deckId: args.deckId,
          userId: context.userId,
          new: false,
          due: {
            lt: new Date(),
          },
        },
      });
    },
  },
  Mutation: {
    createUser: async (parent, { email, password }, context, info) => {
      const { res } = context;
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email: email,
          password: hashedPassword,
        },
      });
      // Since id is added by prisma it is unavailable when creating a user.
      const userWithToken = {
        ...user,
        token: createToken(user.id),
      };
      res.cookie("token", userWithToken.token, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24,
      });
      return userWithToken.token;
    },
    loginUser: async (parent, { email, password }, context, info) => {
      const user = await prisma.user.findFirst({ where: { email } });
      if (!user) throw new Error("No User Found");

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) throw new Error("Wrong Password");

      const userWithToken = {
        ...user,
        token: createToken(user.id),
      };
      context.res.cookie("token", userWithToken.token, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24,
      });
      return userWithToken.token;
    },
    updateFlashcard: async (parent, { data }, context, info) => {
      ensureAuthenticated(context);
      const flashcard = await prisma.flashcard.update({
        where: { id: data.id },
        data: {
          ...data,
        },
      });
      return flashcard;
    },
    createFlashcard: async (parent, { data }, context, info) => {
      ensureAuthenticated(context);
      const flashcard = await prisma.flashcard.create({
        data: {
          ...data,
          userId: context.userId,
        },
      });
      return flashcard;
    },
    deleteFlashcard: async (parent, { id }, context, info) => {
      ensureAuthenticated(context);
      const flashcard = await prisma.flashcard.delete({
        where: { id },
      });
      return flashcard;
    },
    createDeck: async (parent, { name }, context, info) => {
      ensureAuthenticated(context);
      const deck = await prisma.deck.create({
        data: {
          name,
          userId: context.userId,
        },
      });
      return deck;
    },
    deleteDeck: async (parent, { id }, context, info) => {
      ensureAuthenticated(context);
      // delete all flashcards in the deck first
      await prisma.flashcard.deleteMany({
        where: {
          deckId: id,
        },
      });
      // delete the deck itself
      const deck = await prisma.deck.delete({
        where: { id },
      });
      return deck;
    },
  },
};

module.exports = resolvers;
