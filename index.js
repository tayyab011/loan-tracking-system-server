import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import crypto from "crypto";
/* import Stripe from "stripe"; */
import dotenv from "dotenv";
dotenv.config();
/* const stripe = new Stripe(process.env.stripe_secret); */
const app = express();

//loanmanagementsystem
//gZJS8S507UEflGQE

//middleware
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5050;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});





/* const firebaseMiddleware = async (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const token = req.headers.authorization.split(" ")[1];
   
    const decoded = await admin.auth().verifyIdToken(token);
    console.log(decoded);
   
    req.decoded_email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};
 */
async function run() {
  try {
    await client.connect();

    const db = client.db("loanManagement");
    const userCollection = db.collection("users");


    //users
    app.post("/users", async (req, res) => {
      const user = req.body;

      user.createdAt = new Date();
      const exist = await userCollection.findOne({ email: user.email });
      if (exist) {
        return res.send({ message: "user exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    /*    await client.close(); */
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("surver is running");
});
app.listen(PORT, () => {
  console.log(`app is running in ${PORT} port`);
});
