import dotenv from "dotenv";
import express, {Router} from "express";
import cors from "cors";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser";



//set up constants and variables
dotenv.config();
const app = express();
const PORT = process.env.PORT;
const DATABASE_URL = process.env.DATABASE_URL;
app.set('port', PORT);

//middleware
app.use(cors( {origin: process.env.ORIGIN, credentials: true} ));
app.use(express.json());
app.use((req, res, next) => {
      //log basic info for incoming requests
      console.log('new request');
      console.log('\thost: ', req.hostname);
      console.log('\tpath: ', req.path);
      console.log('\tmethod: ', req.method);
      next();
});
app.use(cookieParser());
app.use(session({
      secret: 'your-secret-key', // Replace with a strong secret in production
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: DATABASE_URL, collectionName: "sessions",
            mongoOptions: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            }, 
      }),
      cookie: { 
          httpOnly: true,
          secure: true, // Set to true if using HTTPS
          sameSite: 'none',
          maxAge: 1000 * 60 * 60 * 24 // 1 day
      }
  }));


//define user schema
const userSchema = new mongoose.Schema({
      email: {type: String, required: true, unique: true},
      password: {type: String, required: true},
      firstName: {type: String},
      lastName: {type: String}
});
const User = mongoose.model("User", userSchema);


//connect to database, start listening on PORT
mongoose.connect(DATABASE_URL)
      .then((result) => {
            console.log(`successfully connected to database ${DATABASE_URL}`);
            app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
      })
      .catch((err) => console.error("error connecting to database:", err));

//user signup API endpoint
const signup = async (req, res) => {
      try {
            console.log("Received signup request:", req.body);

            const {email, password} = req.body;

            if (!email || !password) {
                  console.error("Email and password are required, sending 400 Bad Request")
                  return res.status(400).json({message: "Email and password are required"});
            }
            
            const existingUser = await User.findOne({email});
            if (existingUser) {
                  console.error("The email is already in use, sending 409 Conflict");
                  return res.status(409).json({message: "The email is already in use"});
            }

            const newUser = new User({email, password});
            const savedUser = await newUser.save();

            console.log("User saved successfully:", savedUser);
            res.status(201).json({message: "User registered successfully"});
      }
      catch (error) {
            console.error("Signup error:", error);
            res.status(500).json({message: "Server or database issue"});
      }
};


//user login API endpoint
const login = async (req, res) => {
      try {
            const { email, password } = req.body;
            if (!email || !password) {
                  console.error("Missing email or password, sending 400 Bad Request");
                  return res.status(400).json({ message: "Missing email or password" });
            }

            const user = await User.findOne({ email });
            console.log("User lookup result:", user);
            if (!user) {
                  console.error("No user found with the given email, sending 404 Not Found");
                  return res.status(404).json({ message: "No user found with the given email" });
            }

            if (user.password !== password) {
                  console.error("Invalid password, sending 400 Bad Request");
                  return res.status(400).json({ message: "Invalid password" });
            }

            req.session.userId = user._id;
            req.session.save((err) => {
                  if (err) {
                      console.error("Error saving session:", err);
                      return res.status(500).json({ message: "Error saving session" });
                  }
                  console.log("Session saved successfully:", req.session);
                  res.status(200).json({ message: "Login successful." });
              });
            console.log("Session created:", req.session);
    
            console.log(`Login successful for ${email}`);

            /*
            res.cookie('sessionID', req.sessionID, {
                  httpOnly: true,
                  secure: true,
                  sameSite: 'none',
            });
            */

            res.status(200).json({ message: "Login successful." });
      }
      catch (error) {
            console.error("Login error:", error);
            console.error("Login error stack:", error.stack); // Log the stack trace!
            res.status(500).json({ message: "Server or database issue" });
      }
};


//user logout API endpoint
const logout = (req, res) => {
      /*
      try {
            res.status(200).json({ message: "Logout successful" });
      }
            */
      try {
            req.session.destroy((err) => {
                if (err) {
                    console.error("Error destroying session:", err);
                    return res.status(500).json({ message: "Internal Server Error" });
                }
                res.clearCookie('connect.sid'); // Clear the session cookie
                res.status(200).json({ message: "Logout successful" });
            });
      }
      catch (error) {
            console.error("Logout error:", error);
            res.status(500).json({ message: "Internal Server Error" });
      }
};

//get user info API endpoint
const userinfo = async (req, res) => {
      try {
            console.log("Session data:", req.session);
            if (!req.session.userId) {
                console.error("No user ID in session");
                return res.status(404).json({ message: "No user ID in session" });
            }

            const { email } = req.query;

            console.log("Received email from header:", email);
    
            console.log("Request query:", req.query); // Check the entire query object
            console.log("Request body:", req.body); // Check the entire query object
            console.log("Request headers:", req.headers); // Check the entire query object
            //const user = await User.findOne({ email });
            const user = await User.findByID(req.session.userID);
            if (!email || !user) {
                console.error("User ID not in token or user doesn't exist in the database, sending 404 Not Found");
                return res.status(404).json({ message: "User ID not in token or user doesn't exist in the database" });
            }
    
            res.status(200).json({ email: user.email, firstName: user.firstName, lastName: user.lastName });
      }
      catch (error) {
            console.error("User info error:", error);
            res.status(500).json({ message: "Unexpected Server Error" });
      }
};

//update user profile API endpoint
//needs request body with firstname, lastname
const updateprofile = async (req, res) => {
      try {
            const { email, firstName, lastName, color } = req.body;
            if (!email || !firstName || !lastName) {
                return res.status(400).json({ message: "Missing required fields" });
            }
            const user = await User.findOneAndUpdate(
                { email },
                { firstName, lastName, color },
                { new: true }
            );
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            res.status(200).json({ message: "Profile successfully updated" });
      } catch (error) {
            res.status(500).json({ message: "Server or database issue" });
      }
};

//search contacts API endpoint
app.post("/api/contacts/search", async (req, res) => {
      try {
      }
      catch {
      }
});

//get contacts API endpoint
app.get("/api/contacts/get-contacts-for-list", async (req, res) => {
      try {
      }
      catch {
      }
});

//delete messages API endpoint
app.delete("/api/contacts/delete-dm/:dmId", async (req, res) => {
      try {
      }
      catch {
      }
});

//get messages API endpoint
app.post("/api/messages/get-messages", async (req, res) => {
      try {
      }
      catch {
      }
});

//define router and endpoints
const authRoutes = Router();
app.use('/api/auth', authRoutes);


//POST /api/auth/signup
authRoutes.post("/signup", signup);
authRoutes.post("/login", login);
authRoutes.post("/logout", logout);
authRoutes.get("/userinfo", userinfo);
authRoutes.post("/update-profile", updateprofile);


//debugging fallback to list unmatched routes
app.use((req, res) => {
      console.log(`No matching route for ${req.method} ${req.path}`);
      res.status(404).send('Not Found');
  });
  


