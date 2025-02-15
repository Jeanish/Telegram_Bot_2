require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());

// ✅ Debugging: Check environment variables
console.log("MONGO_URI:", process.env.MONGO_URI ? "Loaded" : "❌ Not Found");
console.log("BOT1_TOKEN:", process.env.BOT1_TOKEN ? "Loaded" : "❌ Not Found");
console.log("PORT:", process.env.PORT || 5000);

// ✅ MongoDB Connection with Error Handling
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  });

// ✅ User Schema
const UserSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  depositAmount: { type: Number, default: 0 },
  referredBy: { type: String, default: 'Unknown' },
});

const User = mongoose.model('User', UserSchema);

// ✅ Telegram Bots
const bot1 = new TelegramBot(process.env.BOT1_TOKEN, { polling: true });
const bot2 = new TelegramBot(process.env.BOT2_TOKEN, { polling: true });
const bot3 = new TelegramBot(process.env.BOT3_TOKEN, { polling: true });

// ✅ Webhook for 1win Postbacks
app.post('/webhook', async (req, res) => {
  try {
    console.log('🔥 Incoming Webhook:', JSON.stringify(req.body, null, 2));

    const { gameId, depositAmount, eventType, referredBy } = req.body;

    if (!gameId || !eventType) {
      console.error('❌ Invalid Webhook Payload:', req.body);
      return res.status(400).send('Invalid Data');
    }

    if (eventType === 'registration') {
      const existingUser = await User.findOne({ gameId });

      if (existingUser) {
        console.log(`⚠️ User already registered: ${gameId}`);
        return res.status(200).send('User already exists');
      }

      const newUser = new User({ gameId, referredBy: referredBy || 'Unknown' });
      await newUser.save();
      console.log(`✅ New User Saved: ${gameId}`);

      try {
        await bot1.sendMessage(process.env.ADMIN_CHAT_ID, 
          `🎉 New User Registered: ${gameId} (Referred by: ${referredBy || 'Unknown'})`);
        console.log(`✅ Telegram Message Sent (Registration): ${gameId}`);
      } catch (error) {
        console.error('❌ Telegram Bot1 Error:', error);
      }

      return res.sendStatus(200);
    }

    if (eventType === 'first_deposit') {
      await User.findOneAndUpdate({ gameId }, { depositAmount }, { new: true });

      try {
        await bot2.sendMessage(process.env.ADMIN_CHAT_ID, 
          `💰 First Deposit: ${gameId} - $${depositAmount}`);
        console.log(`✅ Telegram Message Sent (First Deposit): ${gameId}`);
      } catch (error) {
        console.error('❌ Telegram Bot2 Error:', error);
      }
    }

    if (eventType === 'deposit') {
      try {
        await bot3.sendMessage(process.env.ADMIN_CHAT_ID, 
          `💵 New Deposit: ${gameId} - $${depositAmount}`);
        console.log(`✅ Telegram Message Sent (Deposit): ${gameId}`);
      } catch (error) {
        console.error('❌ Telegram Bot3 Error:', error);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Webhook Processing Error:', err);
    res.sendStatus(500);
  }
});

// ✅ Start Server with Error Handling
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
}).on("error", (err) => {
  console.error("❌ Server Error:", err);
});
