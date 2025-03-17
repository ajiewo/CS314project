//AUTHOR: Daniel Schuster

/*************************IMPORTS**************************/

import dotenv from "dotenv";
import express, {Router} from "express";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import cookie from "cookie";
import { Server as SocketServer } from "socket.io";
import http from "http";

/*****************CONSTANTS AND VARIABLES******************/

dotenv.config();
const app = express();
const { PORT, DATABASE_URL, SECRET_KEY, ORIGIN } = process.env;
const userMap = {};
let server;
let io;

/*************************MIDDLEWARE***********************/

app.use(cors( {origin: ORIGIN, credentials: true} ));
app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
      //log basic info for incoming requests
      console.log(`New request: ${req.method} ${req.path} from ${req.hostname}`);
      next();
});

//function to verify JWT token
const verifyToken = (req, res, next) => {
      const token = req.cookies.jwt;

      if (!token) {
            return res.status(401).json({ message: 'Not authenticated' });
      }
  
      jwt.verify(token, SECRET_KEY, (err, payload) => {
            if (err) {
                  console.error('Invalid token:', err);
                  return res.status(403).json({ message: 'Invalid or expired token.' });
            }
            req.userId = payload.userId;
            next();
      });
};


/*******************DATABASE SCHEMAS***************/

//define user schema
const userSchema = new mongoose.Schema({
      email: {type: String, required: true, unique: true},
      password: {type: String, required: true},
      firstName: {type: String},
      lastName: {type: String},
      color: {type: String},
      profileSetup: {type: Boolean, default: false},
});
const User = mongoose.model("User", userSchema);

/*
//define contact schema
const contactSchema = new mongoose.Schema({
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      color: { type: String },
});
const Contact = mongoose.model("Contact", contactSchema);
*/
  
//define message schema
const messageSchema = new mongoose.Schema({
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      content: { type: String, required: true },
      messageType: { type: String },
      timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", messageSchema);


/*******************DATABASE CONNECTION****************/

//connect to database and setup sockets
mongoose.connect(DATABASE_URL)
      .then((result) => {
            console.log(`successfully connected to database ${DATABASE_URL}`);
            server = http.createServer(app);
            io = new SocketServer(server, {
                  cors: {
                        origin: process.env.ORIGIN,
                        credentials: true,
                  },
                  path: '/socket.io/'
            });

            io.use((socket, next) => {
                  const cookies = socket.handshake.headers.cookie || "";
                  const parsedCookie = cookie.parse(cookies);
                  const token = parsedCookie.jwt;
                  if (!token) return next(new Error("Authentication error, no token"));

                  jwt.verify(token, SECRET_KEY, (err, payload) => {
                        if (err) return next(new Error("Authentication error, couldn't verify token"));
                        socket.userId = payload.userId;
                        next();
                  });
            });

            //map user to a socket when they connect
            io.on("connection", (socket) => {
                  const userId = socket.userId;
                  console.log(`Client connected: socketID=${socket.id}, userId=${userId}`);
                  userMap[userId] = socket.id;
                  socket.on("disconnect", (reason) => {
                        console.log(`Client disconnected: socketId=${socket.id}, userId=${userId}, reason=${reason}`);
                        delete userMap[userId];
                  });

                  // Listen for messages from the frontend
                  socket.on("sendMessage", async (messageData) => {
                        console.log("Received WebSocket message:", messageData);
                        const { sender, recipient, content, messageType } = messageData;

                        if (!sender || !recipient || !content) {
                        console.log("Missing message fields");
                        return;
                        }
                        const senderObject = await User.findById(sender);
                        const recipientObject = await User.findById(recipient);
                        
                        //save the message in database 
                        const newMessage = new Message({ sender: senderObject, recipient: recipientObject, content, messageType });

                        try {
                              await newMessage.save();

                              //emit the message to the recipient
                              if (userMap[recipient]) {
                                    io.to(userMap[recipient]).emit("receiveMessage", newMessage);
                              }
                              if (userMap[sender]) {
                                    io.to(userMap[sender]).emit("receiveMessage", newMessage);
                              }
                        } 
                        catch (error) {
                              console.error("Error saving message:", error);
                        }
                  });
            });

            server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
      })
      .catch((err) => console.error("error connecting to database:", err));



/***********************AUTH API ENDPOINTS***************************/

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
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = new User({ email, password: hashedPassword });
            const token = jwt.sign({email, userId: newUser.id}, SECRET_KEY, {
                  expiresIn: '1h',
            });
            res.cookie('jwt', token, {
                  secure: true,
                  sameSite: 'None',
                  maxAge: 60 * 60 * 1000, //1 hour
                  partitioned: true,
            });

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

            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                  console.error("Invalid password, sending 400 Bad Request");
                  return res.status(400).json({ message: "Invalid password" });
            }

            //valid login, create token
            const token = jwt.sign({email, userId: user.id}, SECRET_KEY, {
                  expiresIn: '1h',
            });

            res.cookie('jwt', token, {
                  secure: true,
                  sameSite: 'None',
                  maxAge: 60 * 60 * 1000,
            });

            console.log(`Login successful for ${email}`);

            res.status(200).json({ message: 'Login successful', token });
      }
      catch (error) {
            console.error("Login error:", error);
            console.error("Login error stack:", error.stack); // Log the stack trace!
            res.status(500).json({ message: "Server or database issue" });
      }
};


//user logout API endpoint
const logout = (req, res) => {
      try {
            res.clearCookie('jwt', { secure: true, sameSite: 'None' });
            res.status(200).json({ message: "Logout successful" });
      }
      catch (error) {
            console.error("Logout error:", error);
            res.status(500).json({ message: "Internal Server Error" });
      }
};

//get user info API endpoint
const userinfo = async (req, res) => {
      try {
            const currentUser = await User.findById(req.userId);
            if (!currentUser) {
                  return res.status(404).json({ message: 'User not found' });
            }
            res.status(200).json({
                  id: currentUser.id,
                  email: currentUser.email,
                  password: currentUser.password,
                  color: currentUser.color,
                  firstName: currentUser.firstName,
                  lastName: currentUser.lastName,
                  profileSetup: true,
            });
      } catch (error) {
            console.error('Error fetching user info:', error);
            res.status(500).json({ message: 'Server error' });
      }
};


//update user profile API endpoint
const updateprofile = async (req, res) => {
      try {
            const { color, firstName, lastName } = req.body;
            const currentUser = await User.findById(req.userId);
            const email = currentUser.email;
            if (!firstName || !lastName) {
                  return res.status(400).json({ message: "Missing required fields" });
            }
            const user = await User.findOneAndUpdate(
                  { email },
                  { firstName, lastName, color },
                  //{ new: true }
            );
            if (!user) {
                  return res.status(404).json({ message: "User not found" });
            }
            console.log("Successfully updated profile for: ", user);
            res.status(200).json({ message: "Profile successfully updated" });
      } 
      catch (error) {
            console.error("Error updating profile: ", error);
            res.status(500).json({ message: "Server or database issue" });
      }
};


//define /api/auth router and endpoints
const authRoutes = Router();
app.use('/api/auth', authRoutes);
authRoutes.post("/signup", signup);
authRoutes.post("/login", login);
authRoutes.post("/logout", logout);
authRoutes.get("/userinfo", verifyToken, userinfo);
authRoutes.post("/update-profile", verifyToken, updateprofile);


/********************CONTACTS API ENDPOINTS**********************/

//search contacts API endpoint
const search = async (req, res) => {
      try {
            const query = req.body.searchTerm;
            if (!query) {
                  return res.status(400).json({ message: "Search query is required" });
            }
            const contacts = await User.find({
                  $or: [
                        { firstName: { $regex: query, $options: "i" } },
                        { lastName: { $regex: query, $options: "i" } },
                        { email: { $regex: query, $options: "i" } }
                  ]
            });
            res.status(200).json({ contacts });
      }
      catch (error) {
            console.error("Error searching contacts:", error);
            res.status(500).json({ message: "Server or database issue" });
      }
};

//get contacts API endpoint
const getContacts = async (req, res) => {
      try {
            const contacts = await Contact.find({}, "firstName lastName email");
            res.status(200).json({ contacts });
      }
      catch (error) {
            console.error("Error fetching contacts:", error);
            res.status(500).json({ message: "Server or database issue" });
      }
};

const allContacts = async (req, res) => {
      try {
            const currentUserId = req.userId;
            //create array of all users besides current user
            const users = await User.find({ _id: { $ne: currentUserId } }, "firstName lastName email color");
            console.log("users besides self: ", users);
            res.status(200).json({ contacts: users });
      }
      catch (error) {
            console.error("Error getting all contacts:", error);
            res.status(500).json({ message: "Server or database issue" });
      }
};

//delete messages API endpoint
const deleteDm = async (req, res) => {
      try {
            const { dmId } = req.params;
            if (!dmId) {
                  return res.status(400).json({ message: "Missing or invalid dmId" });
            }

            const deletedMessages = await Message.deleteMany({
                  $or: [
                        { sender: req.userId, recipient: dmId },
                        { sender: dmId, recipient: req.userId }
                  ]
            });
            console.log(`deleted ${deletedMessages.deletedCount} messages`);

            res.status(200).json({ message: "DM deleted successfully" });
      } 
      catch (error) {
            console.error("Error deleting message:", error);
            res.status(500).json({ message: "Server or database issue" });
      }
};


//define /api/contacts router and endpoints
const contactRoutes = Router();
app.use("/api/contacts", contactRoutes);
contactRoutes.post("/search", verifyToken, search);
//need to change this to have proper getContacts function
contactRoutes.get("/get-contacts-for-list", verifyToken, allContacts);
contactRoutes.get("/all-contacts", verifyToken, allContacts);
contactRoutes.delete("/delete-dm/:dmId", verifyToken, deleteDm);


/************************MESSAGES API ENDPOINTS**********************/

//get messages API endpoint
const getMessages = async (req, res) => {
      try {
            console.log("get messages req body: ", req.body);
            const contactId = req.body.id;
            if (!contactId) {
                  return res.status(400).json({ message: "Missing one or both user IDs" });
            }
            const messages = await Message.find({
                  $or: [
                        { sender: req.userId, recipient: contactId },
                        { sender: contactId, recipient: req.userId }
                  ]
            }).sort({ timestamp: 1 });
            res.status(200).json({ messages });
      } 
      catch (error) {
            console.error("Error fetching messages:", error);
            res.status(500).json({ message: "Server or database issue" });
      }
};

//define /api/messages endpoint
app.post("/api/messages/get-messages", verifyToken, getMessages);


/********************CHANNEL API ENDPOINTS*******************/

//placeholder for unimplemented endpoints
const empty = (req, res) => {
      res.status(200).json({ message: "not implemented yet" })
};

//define /api/channel router and endpoints
const channelRoutes = Router();
app.use("/api/channel", channelRoutes);
channelRoutes.get("/get-user-channels", verifyToken, empty); //ts line

/************************CATCH ALL ROUTE***********************/

//debugging fallback to list unmatched routes
app.use((req, res) => {
      console.log(`No matching route for ${req.method} ${req.path}`);
      res.status(404).send('Not Found');
});
  