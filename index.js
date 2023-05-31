const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }

    /* bearer token */
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {

        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' });
        }

        req.decoded = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.guqonkt.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const userCollection = client.db('bistroDB').collection('users');
        const menuCollection = client.db('bistroDB').collection('menu');
        const reviewCollection = client.db('bistroDB').collection('reviews');
        const cartCollection = client.db('bistroDB').collection('carts');

        /* json web Token */
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token })
        })

        // ? warning :>  use verifyJWT before using verifyAdmin
        const verifyAdmin = async ( req, res, next ) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne( query );
            if( user?.role !== 'admin'){
                return res.status(403).send({error: true , message: 'forbidden message'});
            }
            next();
        }

        /**
         * 0. Do not show secure links to those who should not see the links
         * 1. use jwt token: verifyJWT
         * 2. use verify Admin middleware (mongodb connection use)
         * 
        */

        /* User related create Apis  */
        app.get('/user', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result)
        })
        /* new user create Apis  */
        app.post('/user', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existing = await userCollection.findOne(query);

            if (existing) {
                return res.send({ message: 'user already exists' })
            }

            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        /* check the admin for web site */
        /**
         * 1st: security verify layOut one verifyJWT
         * 2nd: security same Email match
         * 3rd: Check the admin  Client site
        */
        app.get('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            // 2nd match email
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })

        /* admin change the user Apis  */
        app.patch('/user/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        /* admin panel delete the admin Apis  */
        app.delete('/user/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        /* menu all data  apis */
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        })

        /* reviews all data apis */
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        })


        /* cart insert collation */
        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            console.log(decodedEmail);
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'provident access' })
            }

            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result)

        })
        app.post('/carts', async (req, res) => {
            const item = req.body;
            // console.log(cart);
            const result = await cartCollection.insertOne(item);
            res.send(result);
        })
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged Bistro Boss Server connection Successful MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Boss is Sitting  Done!!!')
})

app.listen(port, () => {
    console.log(`Bistro Boss is sitting on port ${port}`);
})


/**
 * --------------------------------
 *      NAMING CONVENTION
 * --------------------------------
 * users : userCollection
 * app.get('/users')
 * app.get('/users/:id')
 * app.post('/users')
 * app.patch('/users/:id')
 * app.put('/users/:id')
 * app.delete('/users/:id')
*/