const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const http = require('http');
const fs = require('fs');

// Owner ka JID format (Cleaned up)
const OWNER_JID = '923039354643@s.whatsapp.net';
const BOT_PHONE_NUMBER = '923144816962';

async function startGumnamBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        browser: Browsers.macOS('Desktop'),
    });

    let pairingRequested = false;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log('🎉 Gumnam Agent WhatsApp Security Bot kamyaabi se live ho gaya hai!');
        } else if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            console.log(`Connection close ho gaya! Status: ${statusCode}, Reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                pairingRequested = false;
                setTimeout(() => startGumnamBot(), 5000);
            }
        }

        // Jab socket initialize ho jaye aur unregistered ho toh pairing code mangwayein
        if (!sock.authState.creds.registered && !pairingRequested) {
            pairingRequested = true;
            setTimeout(async () => {
                try {
                    console.log('Pairing code mangwaya ja raha hai...');
                    const code = await sock.requestPairingCode(BOT_PHONE_NUMBER);
                    console.log(`\n========================================`);
                    console.log(`🚀 AAPKA PAIRING CODE YEH HAI: ${code}`);
                    console.log(`========================================\n`);
                } catch (err) {
                    console.log('Pairing code error:', err);
                    pairingRequested = false;
                }
            }, 5000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;

        const senderJid = m.key.remoteJid;
        const participant = m.key.participant || senderJid;
        const isGroup = senderJid.endsWith('@g.us');
        const isAnnouncement = senderJid.includes('@g.us') || senderJid.includes('newsletter');

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

        // Clean JID matching for Owner
        const cleanParticipant = participant.split('@')[0].replace(/[^0-9]/g, '');
        const cleanOwner = OWNER_JID.split('@')[0].replace(/[^0-9]/g, '');
        const isOwner = (m.key.fromMe || cleanParticipant === cleanOwner || senderJid.includes(cleanOwner));
        
        const lowerText = messageText.toLowerCase();

        // 1. SECURITY FILTER: Bad Words Detection (Non-owners only)
        const badWords = ["fuck", "shit", "bitch", "asshole", "bastard", "idiot", "haram", "choot", "lund", "gandu", "madarchod", "behenchod", "bhosdike"];
        const containsAbuse = badWords.some(word => lowerText.includes(word));

        if (containsAbuse && !isOwner) {
            try { await sock.sendMessage(senderJid, { delete: m.key }); } catch (e) {}
            await sock.sendMessage(senderJid, { 
                text: `⚠️ *Respect Warning!*\n@${cleanParticipant}, is platform par badtameezi ya abuse bilkul bardasht nahi ki jayegi. Girls ki respect aur decency sab se pehle hai!`,
                mentions: [participant]
            });
            return;
        }

        // 2. SECURITY FILTER: Link Blocking (Non-owners only)
        const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][-a-zA-Z0-9()@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/gi;
        if (linkRegex.test(messageText) && !isOwner) {
            try { await sock.sendMessage(senderJid, { delete: m.key }); } catch (e) {}
            await sock.sendMessage(senderJid, { 
                text: `⚠️ *Link Warning & Deleted!*\n@${cleanParticipant}, is group/community mein links share karna sakht mana hai.`,
                mentions: [participant]
            });
            return;
        }

        // --- 3. OWNER VIP COMMANDS LOGIC ---
        if (isOwner) {
            let ownerReply = "";
            if (lowerText.startsWith('/song') || lowerText.startsWith('/gana')) {
                ownerReply = "🎵 *[VIP Owner Command]*\nYeh lijiye Boss aapke liye special beat:\n\n*Dil ye mera maane na, roke tujhe jaane na...*\n🎶 (Gumnam Agent hazir hai!)";
            } else if (lowerText.startsWith('/rules')) {
                ownerReply = "📜 *[Group Rules - Boss Mode]*\n1. Girls ki izzat aur respect sab se pehle hai.\n2. Koi abuse ya badtameezi nahi chalegi.\n3. Koi external links share nahi honge.";
            } else if (lowerText.startsWith('/help')) {
                ownerReply = "🛠️ *[Owner Control Panel]*\n- /song : Special beat\n- /rules : Group rules check karein\n- /status : Bot surveillance check";
            } else if (lowerText.startsWith('/status')) {
                ownerReply = "🛡️ *Gumnam Agent Status:* All security filters active, groups under surveillance, Boss!";
            } else if (messageText.startsWith('/')) {
                ownerReply = `🫡 Ji Boss! Aapka hukam sar-ankhon par: "${messageText}"`;
            }

            if (ownerReply) {
                await sock.sendMessage(senderJid, { text: ownerReply }, { quoted: m });
            }
            return;
        }

        // --- 4. NORMAL MEMBERS COMMANDS LOGIC ---
        const isPrefixed = messageText.startsWith('/');
        const isMentioned = lowerText.includes('gumnam');

        if (!isPrefixed && !isMentioned) return;

        let replyText = "";
        if (lowerText.includes('/song') || lowerText.includes('/gana')) {
            replyText = `🎵 @${cleanParticipant}, yeh lijiye aapke liye song:\n\n*Ranjhna ve, ashi teri yaad vich...*\n🎶 (Gumnam Agent entertainment mode!)`;
        } else if (lowerText.includes('/rules')) {
            replyText = `📜 *Group Rules & Regulations (@${cleanParticipant}):*\n1️⃣ Girls ki respect aur decency sab se pehle hai!\n2️⃣ Koi abuse, gaali galoch ya badtameezi bilkul allowed nahi.\n3️⃣ Group mein koi links share nahi karega.`;
        } else if (lowerText.includes('/help')) {
            replyText = `🤖 *Gumnam Agent Commands (@${cleanParticipant}):*\n- /song : Song sunne ke liye\n- /rules : Group ke rules dekhne ke liye\n- /help : Madad ke liye`;
        } else if (lowerText.includes('hello') || lowerText.includes('salam')) {
            replyText = `Waikum Assalam @${cleanParticipant}! Main Gumnam Agent hoon, is platform ka security bot.`;
        } else if (isMentioned) {
            replyText = `Ji @${cleanParticipant}, main Gumnam Agent hoon. Yahan discipline aur sab ki izzat sab se pehle hai!`;
        }

        if (replyText) {
            await sock.sendMessage(senderJid, { 
                text: replyText,
                mentions: [participant] 
            }, { quoted: m });
        }
    });
}

startGumnamBot();

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Gumnam Agent WhatsApp Bot is active and running successfully!\n');
}).listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
});
