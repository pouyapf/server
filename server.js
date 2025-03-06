const {Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
require("dotenv").config();
const { MongoClient } = require("mongodb");
const express = require("express");
const { sendSms } = require("./lib/sendsms");
const app = express();
const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const mongoUri = process.env.MONGODB_URI;
const uploadFile = require("./lib/upload");
const fs = require("fs");

// Add express middleware
app.use(express.json());
let smsCodePromise; // Will store the promise for SMS code resolution

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5,
  timeout: 600000,

});

// SMS Code endpoint
app.get("/sms-code", (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }
  
  // Resolve the promise with the received code
  if (smsCodePromise) {
    smsCodePromise.resolve(code);
    res.json({ success: true, message: "Code received" });
  } else {
    res.status(408).json({ error: "Code request timeout" });
  }
});
function cleanChannelName(name) {
  return name
    .toLowerCase() // Convert to lowercase
    .replace(/[^\w\s]/g, '') // Remove all non-alphanumeric characters (icons, emojis)
    .trim(); // Remove extra spaces
}
(async () => {
  // Start Express server
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`SMS code receiver running on port ${PORT}`);
  });

  // MongoDB connection
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const db = mongoClient.db("telegram");
  const db2 = mongoClient.db("test");
  const messagesCollection = db.collection("messages");
  const usersCollection = db2.collection("users");
  console.log("Connected to MongoDB");

  try {
    // Telegram login with SMS code waiting
    await client.start({
      phoneNumber: () => process.env.PHONE_NUMBER,
      password: () => process.env.PASSWORD,
      phoneCode: async () => {
        console.log(`Awaiting SMS code at http://localhost:${PORT}/sms-code?code=XXXXXX`);
        
        // Create a promise that resolves when we get the code via HTTP
        return new Promise((resolve, reject) => {
          smsCodePromise = { resolve, reject };
          
          // Add 5-minute timeout
          setTimeout(() => {
            reject(new Error("SMS code timeout (5 minutes)"));
          }, 300000);
        });
      },
      onError: (err) => console.error("Login Error:", err),
    });

    console.log("Successfully logged in to Telegram!");
    
    const channelsToMonitor = [
      'Binance 360 vip 🔻🔻🔻',
      'Binance 360 vip🔻🔻🔻',
      'Binance 360🔻🔻🔻',
      'Binance360vip🔻🔻🔻',
      'Crypto Musk 🔻🔻🔻',
      'Crypto Musk🔻🔻🔻',
      'CryptoMusk🔻🔻🔻',
      'Alex Friedman 🔻🔻🔻',
      'Alex Friedman🔻🔻🔻',
      'AlexFriedman🔻🔻🔻',
      'Bi killer 30x 🔻🔻🔻',
      'Bi killer 30x🔻🔻🔻',
      'Bikiller30x🔻🔻🔻',
      'Devil Crypto 🔻🔻🔻',
      'Binance Pro 🔻🔻🔻',
      'Binance Pro🔻🔻🔻',
      'BinancePro🔻🔻🔻',
      'Devil Crypto🔻🔻🔻',
      'DevilCrypto🔻🔻🔻',
      'Cry hj 🔻🔻🔻',
      'Crypto Musk',
      'chates',
      'Cryhj🔻🔻🔻',
    ].map(cleanChannelName); // Clean each channel name
  
    client.addEventHandler(async (update) => {
      try {
        if (update.message && update.message.peerId) {
          const peerId = update.message.peerId;
    
          // Check if the peer is a channel
          if (!peerId.channelId) {
            console.log("Received a message from a non-channel entity. Ignoring.");
            return;
          }
    
          const channelId = peerId.channelId;
    
          // Fetch channel information
          const channel = await client.getEntity(channelId);
          if (!channel || !channel.title) {
            console.log("Failed to resolve channel entity for channelId:", channelId);
            return;
          }
    
          const channelName = cleanChannelName(channel.title); // Clean channel name
          console.log("Received message from channel:", channelName);
    
          // Check if this channel is in the monitored list
          const isMonitored = channelsToMonitor.includes(channelName);
    
          if (isMonitored) {
            let messageText = update.message.message || "";
            let messagepic = update.message.media || null;
            console.log(update.message)
            console.log(messagepic)
            
    
 

            if (update.message.replyTo) {
              const repliedMessageId = update.message.replyTo.replyToMsgId;
              console.log(`Message: "${messageText}" is a reply to message ID: ${repliedMessageId}`);
            
              try {
                // Fetch the replied message
                const repliedMessageResult = await client.invoke(
                  new Api.channels.GetMessages({
                    channel: channelId,
                    id: [repliedMessageId],
                  })
                );
            
                if (repliedMessageResult.messages.length > 0) {
                  const repliedMessage = repliedMessageResult.messages[0];
            
                  let replyData = {
                    text: messageText || "", // Extract text if available
                    replyMessageId: repliedMessage.id,
                    createdAt: new Date(repliedMessage.date * 1000).toISOString(),
                  };
            
                  // **Check if the reply contains an image**
                  if (messagepic && messagepic.photo) {
                    console.log("Reply contains an image, downloading...");
            

                    const buffer = await client.downloadMedia(messagepic, {
                      workers: 1,
                  });
                  console.log("result is", buffer);
               
                    
                    const tempFilePath = `./temp/reply_${repliedMessageId}.jpg`;
                
                    // Save the image temporarily
                    fs.writeFileSync(tempFilePath, buffer);
                
                    // Upload image to Liara
                    const imageUrl = await uploadFile(
                      { filepath: tempFilePath, originalFilename: `reply_${repliedMessageId}.jpg` },
                      channelName
                    );
                
                    // Remove temp file after upload
                    fs.unlinkSync(tempFilePath);
                
                    console.log("Uploaded Image URL:", imageUrl);
         
            
                    replyData.imageUrl = imageUrl; 
                  }
            
                  // **Update the original message in the database**
                  await messagesCollection.updateOne(
                    { channel_Id: channelId, messageid: repliedMessageId },
                    { $push: { replies: replyData } }
                  );
            
                  console.log("Reply (with image if present) added successfully.");
                } else {
                  console.log("Original message not found.");
                }
              } catch (error) {
                console.error("Error fetching or updating replied message:", error);
              }
            }
            




            const examplePattern = /#?(\w+)\/USDT/i;
            const entryPattern = /\bentry\b/i; // Case-insensitive "entry"
            
            let stopPattern; 
            
            if (channelName !== 'binance pro') {
              stopPattern = /\b(stop|sl|stoploss)\b/i;
            } else {
              stopPattern = /\btake-profit\b/i;
            }
            
            const exampleMatch = messageText.match(examplePattern);
            const hasEntry = entryPattern.test(messageText);
            const hasStopOrSL = stopPattern.test(messageText);
            
    
            if (exampleMatch && hasEntry && hasStopOrSL) {
              const example = exampleMatch[1]; // Extract example without #
    
              // Remove emojis or special characters at the end of the message
              messageText = messageText.replace(/\s*[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}\u{2B50}\u{1F900}-\u{1F9FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}]+$/gu, '').replace(/#_Musk/g, "").replace(/crypto_musk1/g, "").replace(/#Free_signal/g, "").replace(/Free_signal/g, "").replace(/Free signal/g, "").replace(/Free Signal/g, "").replace(/(Free Signal)/g, "").replace(/#_BinancePro/g, "");
   
              console.log(
                `Valid message from ${channelName}: "${messageText}" | Extracted type: ${example}`
              );
    
          
              const timestamp = update.message.date; 
              const date = new Date(timestamp * 1000); 
              const isoDateString = date.toISOString(); 
              
              await messagesCollection.insertOne({
                channel: channelName,
                channel_Id: channelId,
                text: messageText,
                messageid: update.message.id,
                type: example,
                replies: [],
                createdAt: isoDateString,
              });
              console.log("Message saved successfully.");
  
  
  
              // Find users who meet the conditions
              const currentDate = new Date();
         
              const activeUsers = await usersCollection.aggregate([
                {
                  $match: {
                    watchlist: {
                      $regex: new RegExp(`^${example}$`, "i") // Case-insensitive match for the example in watchlist
                    }
                  }
                },
                {
                  $unwind: "$orders" // Unwind the orders array to process each order individually
                },
                {
                  $match: {
                    "orders.createdAt": { $exists: true },
                    "orders.duration": { $exists: true },
                    $expr: {
                      $gt: [
                        { $add: [{ $toDate: "$orders.createdAt" }, { $multiply: ["$orders.duration", 86400000] }] },
                        currentDate
                      ]
                    }
                  }
                },
                {
                  $group: {
                    _id: "$_id", // Group back by user ID
                    mobileNumber: { $first: "$mobileNumber" },
                    watchlist: { $first: "$watchlist" },
                    orders: { $push: "$orders" } // Rebuild the orders array
                  }
                }
              ]).toArray();
              
              console.log(`Found ${activeUsers.length} active users with matching watchlist:`);
              console.log(activeUsers);
              for (const user of activeUsers) {
                try {
                  const smsResponse = await sendSms(user.mobileNumber, example);
                  if (smsResponse.success) {
                    console.log(`SMS sent successfully to ${user.mobileNumber}`);
                  } else {
                    console.error(`Failed to send SMS to ${user.mobileNumber}:`, smsResponse.error);
                  }
                } catch (error) {
                  console.error(`Error sending SMS to ${user.mobileNumber}:`, error);
                }
              }
              
  
  
  
            } else {
              console.log(`Message from ${channelName} does not meet all required conditions.`);
            }
          } else {
            console.log(`Message from unmonitored channel: ${channelName}`);
          }
        }
      } catch (error) {
        console.error("Error processing update:", error);
      }
    });







    

    console.log("Listening for messages...");

  } catch (error) {
    console.error("Fatal error:", error);
    server.close();
    process.exit(1);
  }
})();