const https = require('https');

/**
 * Sends an SMS using the Melipayamak API.
 * @param {string} mobileNumber - The recipient's mobile number.
 * @param {string} example - The example value to include in the SMS.
 * @returns {Promise<{ success: boolean, message?: string, error?: string, details?: any }>}
 */
async function sendSms(mobileNumber, example) {
  // Prepare the data for the SMS request
  const data = JSON.stringify({
    username: process.env.MELIPAYAMAK_USER, // Your Melipayamak username
    password: process.env.MELIPAYAMAK_PASS, // Your Melipayamak password
    bodyId: 299751, // Replace with your approved bodyId
    to: mobileNumber,
    args: [example] // Pass the example value in args
  });

  const options = {
    hostname: 'console.melipayamak.com',
    port: 443,
    path: '/api/send/shared/8c2b4032f4944ded849dbb5d5f12fa7f', // Adjust to the correct path if needed
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  return new Promise((resolve, reject) => {
    console.log("Starting SMS request with payload:", data);

    const req = https.request(options, (res) => {
      console.log(`Status Code: ${res.statusCode}`);

      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));

      res.on('end', () => {
        console.log("Response received:", responseData);
        try {
          const parsedResponse = JSON.parse(responseData);

          // Check if the status indicates success
          if (parsedResponse.status === 'ارسال موفق بود') {
            resolve({ success: true, message: 'کد تایید با موفقیت ارسال شد' });
          } else {
            console.error("SMS sending failed:", parsedResponse);
            resolve({ success: false, error: 'ارسال پیامک با شکست مواجه شد', details: parsedResponse.status || 'Unknown error' });
          }
        } catch (error) {
          console.error("Failed to parse response:", error);
          reject(new Error('Failed to parse response'));
        }
      });
    });

    req.on('error', (error) => {
      console.error("Request error:", error);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

module.exports = { sendSms }; // Export the function