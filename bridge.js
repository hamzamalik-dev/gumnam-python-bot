const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { execSync } = require('child_process');

const OWNER_JID = '923039354643@s.whatsapp.net';

// ⚠️ YAHAN APNE BOT KA WHATSAPP NUMBER LIKHEIN (Country code ke sath, bina + ke)
const BOT_NUMBER = "923144816962"; 

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // QR code band kar diya
        browser: ["Ubuntu", "Chrome", "20.0.04"] // Browser update for pairing code
    });

    // Pairing code generate karna
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(BOT_NUMBER);
                console.log(`\n======================================================`);
                console.log(`🚀 AAPKA PAIRING CODE YEH HAI: ${code}`);
                console.log(`======================================================\n`);
            } catch (err) {
                console.log('Pairing code generate karne mein error:', err);
            }
        }, 3000); // 3 seconds intezar taake server connect ho jaye
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            if (shouldReconnect) { startBot(); }
        } else if (connection === 'open') {
            console.log('Gumnam Agent WhatsApp Bridge live ho gaya hai!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const senderJid = m.key.remoteJid;
        const participant = m.key.participant || senderJid;
        const isGroup = senderJid.endsWith('@g.us');
        const isAnnouncement = senderJid.includes('@g.us') || senderJid.includes('newsletter');

        // Personal chats ko ignore karega
        if (!isGroup && !isAnnouncement) return;

        const messageType = Object.keys(m.message)[0];
        let messageText = '';

        if (messageType === 'conversation') {
            messageText = m.message.conversation;
        } else if (messageType === 'extendedTextMessage') {
            messageText = m.message.extendedTextMessage.text;
        } else if (messageType === 'imageMessage' && m.message.imageMessage.caption) {
            messageText = m.message.imageMessage.caption;
        }

        if (!messageText) return;

        const isOwner = (participant === OWNER_JID || senderJid === OWNER_JID);
        const lowerText = messageText.toLowerCase();

        // Security filters & responses
        const badWords = ["fuck", "shit", "bitch", "asshole", "bastard", "idiot", "haram", "choot", "lund", "gandu", "madarchod", "behenchod", "bhosdike"];
        const containsAbuse = badWords.some(word => lowerText.includes(word));

        if (containsAbuse && !isOwner) {
            try { await sock.sendMessage(senderJid, { delete: m.key }); } catch (e) {}
            await sock.sendMessage(senderJid, { 
                text: `⚠️ *Respect Warning!*\n@${participant.split('@')[0]}, is platform par badtameezi ya abuse bilkul bardasht nahi ki jayegi. Girls ki respect aur decency sab se pehle hai!`,
                mentions: [participant]
            });
            return;
        }

        const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/gi;
        if (linkRegex.test(messageText) && !isOwner) {
            try { await sock.sendMessage(senderJid, { delete: m.key }); } catch (e) {}
            await sock.sendMessage(senderJid, { 
                text: `⚠️ *Link Warning & Deleted!*\n@${participant.split('@')[0]}, is group/community mein links share karna sakht mana hai.`,
                mentions: [participant]
            });
            return;
        }

        // Mention check
        const isMentioned = lowerText.includes('gumnam');
        if (!isMentioned && !isOwner) return;

        let replyText = "";
        if (isOwner) {
            if (lowerText.includes('song') || lowerText.includes('gana')) {
                replyText = "🎵 Yeh lijiye Gumnam Owner ke liye special beat:\n\n*Dil ye mera maane na, roke tujhe jaane na...*\n🎶 (Gumnam Agent hazir hai!)";
            } else {
                replyText = `Ji Gumnam Owner! Aapka message mil gaya hai: "${messageText}"`;
            }
        } else {
            if (lowerText.includes('song') || lowerText.includes('gana')) {
                replyText = `🎵 @${participant.split('@')[0]}, yeh lijiye aapke liye song:\n\n*Ranjhna ve, ashi teri yaad vich...*\n🎶 (Gumnam Agent entertainment mode!)`;
            } else if (lowerText.includes('hello') || lowerText.includes('salam')) {
                replyText = `Waikum Assalam @${participant.split('@')[0]}! Main Gumnam Agent hoon, is platform ka security bot. Yahan girls ki respect aur discipline lazmi hai.`;
            } else {
                replyText = `Ji @${participant.split('@')[0]}, main Gumnam Agent hoon. Yahan discipline aur sab ki izzat sab se pehle hai!`;
            }
        }

        if (replyText) {
            await sock.sendMessage(senderJid, { 
                text: replyText,
                mentions: isOwner ? [] : [participant] 
            }, { quoted: m });
        }
    });
}

startBot();

const http = require('http');
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WhatsApp Bot is running successfully!\n');
}).listen(port, () => {
  console.log(`Dummy web server running on port ${port}`);
});
