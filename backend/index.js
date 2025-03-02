//const express = require('express');
//const mongoose = require('mongoose');
//const cors = require('cors');
//const dotenv = require('dotenv');
import dotenv from "dotenv";
import express, {Router} from "express"
import cors from "cors"
import mongoose from "mongoose"

dotenv.config();

const app = express();
const PORT = process.env.PORT;
const DATABASE_URL = process.env.DATABASE_URL;
console.log(DATABASE_URL)

//middleware
app.use(cors( {origin: process.env.ORIGIN, credentials: true} ));
app.use(express.json());

//connect to database, listen on port
mongoose.connect(DATABASE_URL)
      .then((result) => {
            console.log('successfully connected to database');
            app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
      })
      .catch((err) => console.error("error connecting to database:", err));

//moved this line into the .then of connect
//app.listen(PORT, () => console.log(`Listening on port ${PORT}`))

//define user schema
const userSchema = new mongoose.Schema({
      email: {type: String, required: true, unique: true},
      password: {type: String, required: true}
});

const User = mongoose.model("User", userSchema);

//user signup API endpoint
const signup = async (req, res) => {
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
};

//change these to const login = (req, res) => like the signup one
//user login API endpoint
app.post("/api/auth/login", async (req, res) => {
      try {
      }
      catch {
      }
});

//user logout API endpoint
app.post("/api/auth/logout", async (req, res) => {
      try {
      }
      catch {
      }
});

//get user info API endpoint
app.get("/api/auth/userinfo", async (req, res) => {
      try {
      }
      catch {
      }
});

//update user profile API endpoint
//needs request body with firstname, lastname
app.post("/api/auth/update-profile", async (req, res) => {
      try {
      }
      catch {
      }
});

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
//app.use("/api/auth", authRoutes);
app.use('/api/auth', authRoutes);


//POST /api/auth/signup
authRoutes.post("/signup", signup);


//log data (can get rid of this or use 3rd party middleware to log)
app.use((req, res, next) => {
      console.log('new request')
      console.log('host: ', req.hostname)
      console.log('path: ', req.path)
      console.log('method: ', req.method)
      next()
})

//debugging fallback to list unmatched routes
app.use((req, res) => {
      console.log(`No matching route for ${req.method} ${req.path}`);
      res.status(404).send('Not Found');
  });
  


