const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT;
const DATABASE_URL = process.env.DATABASE_URL;

//middleware
app.use(cors( {origin: process.env.ORIGIN, credentials: true} ));
app.use(express.json());


//connect to database
mongoose.connect(DATABASE_URL,
      { useNewUrlParser: true, useUnifiedTopology: true })
      .then((result) => console.log('successfully connected to database'))
      .catch((err) => console.error("error connecting to database:", err));
      //put app.listen in the .then here?

app.listen(PORT, () => console.log(`Listening on port ${PORT}`))

const User = mongoose.model("User", userSchema);

//user signup API endpoint
app.post("/api/auth/signup", async (req, res) => {
      try {
            console.log("Received signup request:", req.body);

            const {email, password} = req.body;

            if (!email || !password) {
                  return res.status(400).json({message: "Email and password are required"});
            }
            
            const existingUser = await User.findOne({email});
            if (existingUser) {
                  return res.status(400).json({message: "Email already registered"});
            }

            const newUser = new User({email, password});
            const savedUser = await newUser.save();

            console.log("User saved successfully:", savedUser);
            res.status(201).json({message: "User registered successfully"});
      }
      catch (error) {
            console.error("Signup error:", error);
            res.status(500).json({message: "Internal Server Error"});
      }
});

app.use((req, res, next) => {
      console.log('new request')
      console.log('host: ', req.hostname)
      console.log('path: ', req.path)
      console.log('method: ', req.method)
      next()
})


app.get('/api/data', (req, res) => {
   // Fetch data from MongoDB
   res.json({ message: 'Data fetched successfully' })
})
