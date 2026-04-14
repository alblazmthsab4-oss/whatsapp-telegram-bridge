const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const PORT = process.env.PORT || 3000;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const log = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
};

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    log.success('Webhook verified');
    res.status(200).send(challenge);
  } else {
    log.error('Webhook verification failed');
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  
  if (body.object !== 'whatsapp_business_account') {
    return res.sendStatus(404);
  }

  if (body.entry && Array.isArray(body.entry)) {
    for (const entry of body.entry) {
      try {
        const changes = entry.changes[0];
        const value = changes.value;
        
        if (!value.messages || !value.messages[0]) continue;

        const message = value.messages[0];
        const contact = value.contacts[0];
        
        const senderPhone = message.from;
        const senderName = contact?.profile?.name || 'Unknown';
        const messageType = message.type;
        let messageContent = '';

        if (messageType === 'text') {
          messageContent = message.text?.body;
        } else if (messageType === 'image') {
          messageContent = message.image?.caption || 'Image message';
        } else if (messageType === 'video') {
          messageContent = message.video?.caption || 'Video message';
        } else if (messageType === 'audio') {
          messageContent = 'Audio message';
        } else if (messageType === 'document') {
          messageContent = message.document?.filename || 'Document';
        } else {
          messageContent = `${messageType} message`;
        }

        const telegramMessage = `📩 New WhatsApp Message\n👤 Name: ${senderName}\n📱 Number: ${senderPhone}\n💬 Message: ${messageContent}`;

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: TELEGRAM_CHAT_ID,
          text: telegramMessage,
        });

        log.success(`Message from ${senderName} forwarded to Telegram`);
      } catch (error) {
        log.error(`Error: ${error.message}`);
      }
    }
  }

  res.sendStatus(200);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      whatsapp_token: WHATSAPP_VERIFY_TOKEN ? '✅' : '❌',
      telegram_token: TELEGRAM_BOT_TOKEN ? '✅' : '❌',
      telegram_chat_id: TELEGRAM_CHAT_ID ? '✅' : '❌',
    }
  });
});

const server = app.listen(PORT, () => {
  log.success(`Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  log.info('Shutting down...');
  server.close();
});
