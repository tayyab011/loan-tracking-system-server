import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import crypto from "crypto";
import admin from "firebase-admin";
/* const serviceAccount = "./loan.json"; */
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);
import Stripe from "stripe";
import dotenv from "dotenv";
dotenv.config();
const stripe = new Stripe(process.env.stripe_secret);
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
  /*   console.log(auth); */
  try {
    const token = req.headers.authorization.split(" ")[1];

    const decoded = await admin.auth().verifyIdToken(token);
    /*    console.log(decoded); */

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

    app.get("/user-suspend/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      res.send(user);
    });

    //3 loan add from manager
    app.post("/loans", firebaseMiddleware, async (req, res) => {
      const loans = req.body;

      const result = await loanCollection.insertOne(loans);
      res.send(result);
    });
    //4 manage loan from manager
    app.get("/loans", firebaseMiddleware, async (req, res) => {
      const result = await loanCollection.find().toArray();
      res.send(result);
    });
app.get("/loans/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const loan = await loanCollection.findOne({ _id: new ObjectId(id) });

    if (!loan) {
      return res.status(404).send({ message: "Loan not found" });
    }

    res.send(loan);
  } catch (error) {
    res.status(500).send({ message: "Invalid loan ID" });
  }
});
    //5 manage loan from manager update
    app.put("/loans/:id", firebaseMiddleware, async (req, res) => {
      const id = req.params.id;
      const updateLoan = req.body;
      const query = { _id: new ObjectId(id) };
      const result = await loanCollection.updateOne(query, {
        $set: updateLoan,
      });
      res.send(result);
    });
    //6 manage loan from manager delete
    app.delete("/loans/:id", firebaseMiddleware, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await loanCollection.deleteOne(query);
      res.send(result);
    });

    //7 all loan for user
    /* app.get("/all-loans", async (req, res) => {
      const result = await loanCollection.find().toArray();
      res.send(result);
    });
 */
app.get("/all-loans", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 6;
  const skip = (page - 1) * limit;

  const total = await loanCollection.countDocuments();
  const loans = await loanCollection
    .find()
    .sort({ date: -1 }) // descending by date
    .skip(skip)
    .limit(limit)
    .toArray();

  res.send({ loans, total });
});

    //8 loan application form for user/borrower
    app.post("/loan-application-form", firebaseMiddleware, async (req, res) => {
      const loans = req.body;
      loans.price = parseInt(10);
      /*  console.log(req.decoded_email); */
      const result = await loanApplicationCollection.insertOne(loans);
      res.send(result);
    });
    // 9 my loan application form for (browwower (with query) and admin(with out query))
    app.get("/loan-application-form", firebaseMiddleware, async (req, res) => {
      const email = req.query.email;

      const query = {};
      if (email) {
        query.borrowerEmail = email;
      }

      /*  console.log(req.decoded_email); */
      const result = await loanApplicationCollection.find(query).toArray();
      res.send(result);
    });
    // 10 / cancellation my lon from borrower
    app.put(
      "/loan-application-form/status-canceled/:id",
      firebaseMiddleware,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updateCanceled = {
          $set: {
            status: "canceled",
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
      firebaseMiddleware,
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

    //13 alluser manage
    app.get("/users", firebaseMiddleware, async (req, res) => {
      const user = await userCollection.find().toArray();
      res.send(user);
    });
    //14  update role and status from admin
    app.put("/users-manage/:id", firebaseMiddleware, async (req, res) => {
      const id = req.params.id;
      const { role, status } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateUser = {
        $set: {
          role,
          status,
        },
      };
      console.log(role, status);
      const result = await userCollection.updateOne(query, updateUser);
      res.send(result);
    });
    //15 update show on home toggle from admin
    app.put(
      "/loan-admin-showonhome/:id",
      firebaseMiddleware,
      async (req, res) => {
        const id = req.params.id;
        const { showOnHome } = req.body;
        console.log(showOnHome);
        const query = { _id: new ObjectId(id) };
        const updateUser = {
          $set: {
            showOnHome,
          },
        };

        const result = await loanCollection.updateOne(query, updateUser);
        res.send(result);
      }
    );
    //16 delete loan from admin
    app.delete("/loansDelete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await loanCollection.deleteOne(query);
      res.send(result);
    });
    //17
    app.get("/users/profile", firebaseMiddleware, async (req, res) => {
      const { email } = req.query;
      const query = {};
      if (email) {
        query.email = email;
      }
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    //18 home 6 card show
    app.get("/homes", async (req, res) => {
      let loans = await loanCollection
        .find({ showOnHome: true })
        .sort({ date: -1 })
        .toArray();

      res.send(loans);
    });

    //19  payment checkout by borrower
    app.post(
      "/create-checkout-session",
      firebaseMiddleware,
      async (req, res) => {
        const paymentInfo = req.body;
       const session = await stripe.checkout.sessions.create({
         //leftside
         line_items: [
           {
             price_data: {
               currency: "usd",
               product_data: {
                 name: paymentInfo.loanTitle,
               },
               unit_amount: paymentInfo.price * 100,
             },
             quantity: 1,
           },
         ],
         //right side
         customer_email: paymentInfo.borrowerEmail,
         mode: "payment",
         metadata: {
           loanApplicationsId: paymentInfo.loanApplicationsId,
           borrowerName: paymentInfo.borrowerName,
           borrowerEmail: paymentInfo.borrowerEmail,
           loanTitle: paymentInfo.loanTitle,
         },
         success_url: `${process.env.site_domain}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
         cancel_url: `${process.env.site_domain}/dashboard/payment-cancle`,
       });  
       res.send({url:session.url})
      }
    );


    app.post("/payment-success",async(req,res)=>{
      const {sessionId}=req.body
     /*  console.log(sessionId);  3 bar session id pathay frontend theeke useeffect ;0*/
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      /*  console.log(session); */
const loanApplication = await loanApplicationCollection.findOne({
  _id: new ObjectId(session.metadata.loanApplicationsId),
});
const paymentExist = await paymentCollection.findOne({
  transectionId: session.payment_intent,
});
if (paymentExist) {
  return res.send({ transectionId: paymentExist.transectionId });
}
       if (session.status === "complete") {
        const orderInfo = {
          loanApplicationFormId: session.metadata.loanApplicationsId,
          loanName: session.metadata.loanApplicationsId,
          transectionId: session.payment_intent,
          borrowerName: session.metadata.borrowerName,
          borrowerEmail: session.metadata.borrowerEmail,
          loanTitle: loanApplication.loanTitle,
          price: session.amount_total / 100,
        };
        const result =await paymentCollection.insertOne(orderInfo);
const updatePaidStatus = await loanApplicationCollection.updateOne(
  {
    _id: new ObjectId(session.metadata.loanApplicationsId),
  },
  { $set: { applicationFeeStatus :"paid"} }
);
return res.send(updatePaidStatus)
       }
       return res.send({message:"no"})
    })
    // Send a ping to confirm a successful connection
   /*  await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    ); */
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
