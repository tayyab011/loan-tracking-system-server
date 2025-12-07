import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import crypto from "crypto";
import  admin from"firebase-admin";
const serviceAccount = "./loan.json";
/* import Stripe from "stripe"; */
import dotenv from "dotenv";
dotenv.config();
/* const stripe = new Stripe(process.env.stripe_secret); */
const app = express();


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

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});




 const firebaseMiddleware = async (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth) {
    return res.status(401).send({ message: "unauthorized access" });
  }
console.log(auth)
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
 
async function run() {
  try {
    await client.connect();

    const db = client.db("loanManagement");
    const userCollection = db.collection("users");
    const loanCollection = db.collection("loans");
    const loanApplicationCollection = db.collection("loanApplications");
    const paymentCollection = db.collection("payments");

    //1 users
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
    //2 user role get
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      res.send({ role: user?.role });
    });

    //3 loan add from manager
    app.post("/loans", async (req, res) => {
      const loans = req.body;
      const result = await loanCollection.insertOne(loans);
      res.send(result);
    });
    //4 manage loan from manager
    app.get("/loans", async (req, res) => {
      const result = await loanCollection.find().toArray();
      res.send(result);
    });

    //5 manage loan from manager update
    app.put("/loans/:id",firebaseMiddleware, async (req, res) => {
      const id = req.params.id;
      const updateLoan = req.body;
      const query = { _id: new ObjectId(id) };
      const result = await loanCollection.updateOne(query, {
        $set: updateLoan,
      });
      res.send(result);
    });
    //6 manage loan from manager delete
    app.delete("/loans/:id",firebaseMiddleware, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await loanCollection.deleteOne(query);
      res.send(result);
    });

    //7 all loan for user
    app.get("/all-loans", async (req, res) => {
      const result = await loanCollection.find().toArray();
      res.send(result);
    });

    //8 loan application form for user/borrower
    app.post("/loan-application-form",firebaseMiddleware, async (req, res) => {
      const loans = req.body;
  /*  console.log(req.decoded_email); */
      const result = await loanApplicationCollection.insertOne(loans);
      res.send(result);
    });
// 9 my loan application form
     app.get(
       "/loan-application-form",
       firebaseMiddleware,
       async (req, res) => {
        const email=req.query.email;
    
        const query={}
        if (email) {
          query.borrowerEmail=email
        }
       
        /*  console.log(req.decoded_email); */
         const result = await loanApplicationCollection.find(query).toArray();
         res.send(result);
       }
     );
// 10 / cancellation my lon from borrower
      app.put(
        "/loan-application-form/status-canceled/:id",
        firebaseMiddleware,
        async (req, res) => {
         const id=req.params.id;
         const query ={_id: new ObjectId(id)};
         const updateCanceled = {
           $set: {
             status:"canceled"
           },
         };
        
          const result = await loanApplicationCollection.updateOne(
            query,
            updateCanceled
          );
          res.send(result);
        }
      );

      //11 from manager see penidng loan
       app.get(
         "/loan-application-pendingform",
         
         async (req, res) => {
           const status = req.query.status;

           const query = {};
           if (status) {
             query.status = status;
           }

           /*  console.log(req.decoded_email); */
           const result = await loanApplicationCollection.find(query).toArray();
           res.send(result);
         }
       );

       //12 approved or rejected from manager
       app.put(
         "/loan-application-form-manager/:id",
         firebaseMiddleware,
         async (req, res) => {
           const { status } = req.body;
           console.log(status);
           const id = req.params.id;
           const query = { _id: new ObjectId(id) };
           const updateStatus = {
             $set: {
               status,
             },
           };

           const result = await loanApplicationCollection.updateOne(
             query,
             updateStatus
           );
           res.send(result);
         }
       );
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
