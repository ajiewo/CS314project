import dotenv from "dotenv";
import express, {Router} from "express";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import { Server as SocketServer } from "socket.io";
import http from "http";

//set up constants and variables
dotenv.config();
const app = express();
const PORT = process.env.PORT;
const DATABASE_URL = process.env.DATABASE_URL;
const SECRET_KEY = 'mySuperSecreKey'
const SALT_ROUNDS = 10;
const userMap = {};
let server;
let io;
app.set('port', PORT);

//middleware
app.use(cors( {origin: process.env.ORIGIN, credentials: true} ));
app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
      //log basic info for incoming requests
      console.log('new request');
      console.log('\thost: ', req.hostname);
      console.log('\tpath: ', req.path);
      console.log('\tmethod: ', req.method);
      next();
});

// Middleware to verify JWT
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


//define user schema
const userSchema = new mongoose.Schema({
      email: {type: String, required: true, unique: true},
      password: {type: String, required: true},
      firstName: {type: String},
      lastName: {type: String},
      color: {type: String},
});
const User = mongoose.model("User", userSchema);

//define contact schema
const contactSchema = new mongoose.Schema({
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
const Contact = mongoose.model("Contact", contactSchema);
  
//define message schema
const messageSchema = new mongoose.Schema({
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      content: { type: String, required: true },
      messageType: { type: String },
      timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", messageSchema);

//connect to database, start listening on PORT
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
            server.listen(PORT, () => console.log(`Listening on port ${PORT}`));

            io.on("connection", (socket) => {
                  const userId = socket.handshake.query.userId;
                  console.log(`Client connected: socketID=${socket.id}, userId=${userId}`);

                  userMap[userId] = socket.id;

                  socket.on("disconnect", () => {
                        console.log(`Client disconnected: socketId=${socket.id}, userId=${userId}`);
                        delete userMap[userId];
                  });
            });
      
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
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            const newUser = new User({ email, password: hashedPassword });
            const token = jwt.sign({email, userId: newUser.id}, SECRET_KEY, {
                  expiresIn: '1h',
            });
            res.cookie('jwt', token, {
                  secure: true,
                  sameSite: 'None',
                  maxAge: 60 * 60 * 1000, //1 hour
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

// Protected route to get user info
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
            if (!color || !firstName || !lastName) {
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


//search contacts API endpoint
const search = async (req, res) => {
      try {
            const { query } = req.body;
            if (!query) {
                  return res.status(400).json({ message: "Search query is required" });
            }
            const contacts = await Contact.find({
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

//placeholder for unimplemented endpoints
const empty = (req, res) => {
      res.status(200).json({ message: "not implemented yet" })
};

//define /api/contacts router and endpoints
const contactRoutes = Router();
app.use("/api/contacts", contactRoutes);
contactRoutes.post("/search", verifyToken, search);
contactRoutes.get("/get-contacts-for-list", verifyToken, getContacts);
contactRoutes.get("/all-contacts", verifyToken, empty); //ts line

//define /api/channel router and endpoints
const channelRoutes = Router();
app.use("/api/channel", channelRoutes);
channelRoutes.get("/get-user-channels", verifyToken, empty); //ts line

//delete messages API endpoint
const deleteDm = async (req, res) => {
      try {
            const { dmId } = req.params;
            const deletedMessage = await Message.findByIdAndDelete(dmId);
            if (!deletedMessage) {
                  return res.status(400).json({ message: "Missing or invalid dmId" });
            }
            res.status(200).json({ message: "DM deleted successfully" });
      } 
      catch (error) {
            console.error("Error deleting message:", error);
            res.status(500).json({ message: "Server or database issue" });
      }
};

//get messages API endpoint
const getMessages = async (req, res) => {
      try {
            const { contactId } = req.body;
            if (!contactId) {
                  return res.status(400).json({ message: "Missing one or both user IDs" });
            }
            const messages = await Message.find({
                  $or: [
                        { sender: req.userId, receiver: contactId },
                        { sender: contactId, receiver: req.userId }
                  ]
            }).sort({ createdAt: 1 });
            res.status(200).json({ messages });
      } 
      catch (error) {
            console.error("Error fetching messages:", error);
            res.status(500).json({ message: "Server or database issue" });
      }
};


const chatHandler = (req, res) => {
      console.log('chat request body: ', req.body);
      const { sender, recipient, content, messageType } = req.body;
      if (!sender || !content) {
            console.log("Missing sender or text");
            return res.status(400).json({ error: "Missing sender or text" });
      }

      const newMessage = new Message ({ sender, recipient, content, messageType });
      if (userMap[sender]) {
            io.to(userMap[sender]).emit("newMessage", newMessage);
      }
      if (userMap[recipient]) {
            io.to(userMap[recipient]).emit("newMessage", newMessage);
      }
      console.log(`Emitted ${newMessage}`);
      newMessage.save();

      return res.status(201).json({ success: true, message: newMessage });
};

//define /api/messages router and endpoints
app.post("/api/messages", verifyToken, chatHandler);
app.delete("/api/messages/delete-dm/:dmId", verifyToken, deleteDm);
app.post("/api/messages/get-messages", verifyToken, getMessages);


//debugging fallback to list unmatched routes
app.use((req, res) => {
      console.log(`No matching route for ${req.method} ${req.path}`);
      res.status(404).send('Not Found');
  });
  


