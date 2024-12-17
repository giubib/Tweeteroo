import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";

import dotenv from "dotenv";
import joi from "joi";

dotenv.config();

const app = express();
app.use(cors());
app.use(json());

const mongoURL = process.env.DATABASE_URL;
const mongoClient = new MongoClient(mongoURL);
let db;

mongoClient
  .connect()
  .then(() => {
    db = mongoClient.db();
    console.log("Banco de dados conectado com sucesso");
  })
  .catch((err) => {
    console.error("Erro ao conectar ao banco de dados:", err.message);
  });

app.post("/sign-up", (req, res) => {
  const user = req.body;

  const signUpSchema = joi.object({
    username: joi.string().required(),
    avatar: joi.string().required().uri(),
  });

  const validation = signUpSchema.validate(user, { abortEarly: false });

  if (validation.error) {
    return res.status(422).send("Formato invalido");
  }

  db.collection("users")
    .insertOne(user)
    .then(() => res.status(201).send("Cadastrado"))
    .catch((err) => res.status(500).send(err.message));
});

app.post("/tweets", async (req, res) => {
  const tweet = req.body;

  const tweetSchema = joi.object({
    username: joi.string().required(),
    tweet: joi.string().required().max(280),
  });

  const validation = tweetSchema.validate(tweet, { abortEarly: false });

  if (validation.error) {
    return res.status(422).json({
      error: "Formato inválido",
      details: validation.error.details.map((detail) => detail.message),
    });
  }

  try {
    const existingUser = await db.collection("users").findOne({ username: tweet.username });

    if (!existingUser) {
      return res.status(401).json({ message: "Usuário não autorizado" });
    }

    await db.collection("tweets").insertOne(tweet);
    return res.status(201).json({ message: "Tweet enviado com sucesso" });
  } catch (err) {
    return res.status(500).json({ error: "Erro no servidor", message: err.message });
  }
});

app.get("/tweets", async (req, res) => {
  try {
    const tweets = await db.collection("tweets").find().sort({ _id: -1 }).toArray();
    const users = await db.collection("users").find().toArray();
    const userMap = users.reduce((acc, user) => {
      acc[user.username] = user.avatar;
      return acc;
    }, {});

    const formattedTweets = tweets.map((tweet) => ({
      _id: tweet._id,
      username: tweet.username,
      avatar: userMap[tweet.username] || null,
      tweet: tweet.tweet,
    }));

    return res.status(200).json(formattedTweets);
  } catch (err) {
    return res.status(500).json({ error: "Erro no servidor", message: err.message });
  }
});

app.put("/tweets/:id", async (req, res) => {
  const { id } = req.params;
  const { tweet, username } = req.body;

  const tweetSchema = joi.object({
    username: joi.string().required(),
    tweet: joi.string().required().max(280),
  });

  const validation = tweetSchema.validate({ username, tweet }, { abortEarly: false });

  if (validation.error) {
    return res.status(422).json({
      error: "Formato inválido",
      details: validation.error.details.map((detail) => detail.message),
    });
  }

  try {
    const existingTweet = await db.collection("tweets").findOne({ _id: new ObjectId(id) });

    if (!existingTweet) {
      return res.status(404).json({ message: "Tweet não encontrado" });
    }

    await db.collection("tweets").updateOne({ _id: new ObjectId(id) }, { $set: { tweet, username } });

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "Erro no servidor", message: err.message });
  }
});

app.delete("/tweets/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const existingTweet = await db.collection("tweets").findOne({ _id: new ObjectId(id) });

    if (!existingTweet) {
      return res.status(404).json({ message: "Tweet não encontrado" });
    }

    await db.collection("tweets").deleteOne({ _id: new ObjectId(id) });

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "Erro no servidor", message: err.message });
  }
});

const porta = process.env.PORTA;
app.listen(porta, () => {
  console.log("Servidor rodando");
});
