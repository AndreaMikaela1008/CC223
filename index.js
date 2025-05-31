const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const axios = require('axios');
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = admin.firestore();

// API Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    // Validate input
    if (!message || !userId) {
      return res.status(400).json({ error: "Missing message or userId" });
    }

    const chatRef = db.collection("chats").doc(userId);
    const chatDoc = await chatRef.get();
    
    // Initialize conversation if it doesn't exist
    let conversation = chatDoc.exists ? chatDoc.data().messages : [];
    conversation.push({ role: "user", content: message });

    // Call HuggingFace API
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta',
      { inputs: message }, // Simplified input
      {
        headers: {
          'Authorization': `Bearer ${process.env.HF_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Handle different response formats
    let aiResponse;
    if (Array.isArray(response.data)) {
      aiResponse = response.data[0]?.generated_text || "No response from model.";
    } else {
      aiResponse = response.data?.generated_text || "No response from model.";
    }

    conversation.push({ role: "assistant", content: aiResponse });
    await chatRef.set({ messages: conversation });
    
    res.json({ response: aiResponse });

  } catch (error) {
    console.error('Chat error:', {
      message: error.message,
      response: error.response?.data
    });
    res.status(500).json({ 
      error: 'Chat processing failed',
      details: error.response?.data || error.message 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

