const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { execSync } = require('child_process');

const OWNER_JID = '923039354643@s.whatsapp.net';

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ["Windows", "Chrome", "10.0"]
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
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

        // Security filters for non-owners
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

        // --- SPECIAL OWNER LOGIC (VIP Style & Direct Commands) ---
        if (isOwner) {
            let ownerReply = "";
            if (lowerText.startsWith('/song') || lowerText.startsWith('/gana')) {
                ownerReply = "🎵 *[VIP Owner Command]*\nYeh lijiye Boss aapke liye special beat:\n\n*Dil ye mera maane na, roke tujhe jaane na...*\n🎶 (Gumnam Agent hazir hai!)";
            } else if (lowerText.startsWith('/rules')) {
                ownerReply = "📜 *[Group Rules - Boss Mode]*\n1. Girls ki izzat aur respect sab se pehle hai.\n2. Koi abuse ya badtameezi nahi chalegi.\n3. Koi external links share nahi honge.";
            } else if (lowerText.startsWith('/help')) {
                ownerReply = "🛠️ *[Owner Commands]*\n- /song : Special beat\n- /rules : Group rules check karein\n- /status : Bot surveillance check";
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

        // --- NORMAL MEMBERS LOGIC (Requires '/' prefix or 'gumnam' mention) ---
        const isPrefixed = messageText.startsWith('/');
        const isMentioned = lowerText.includes('gumnam');

        if (!isPrefixed && !isMentioned) return;

        let replyText = "";
        if (lowerText.includes('/song') || lowerText.includes('/gana')) {
            replyText = `🎵 @${participant.split('@')[0]}, yeh lijiye aapke liye song:\n\n*Ranjhna ve, ashi teri yaad vich...*\n🎶 (Gumnam Agent entertainment mode!)`;
        } else if (lowerText.includes('/rules')) {
            replyText = `📜 *Group Rules & Regulations (@${participant.split('@')[0]}):*\n1️⃣ Girls ki respect aur decency sab se pehle hai!\n2️⃣ Koi abuse, gaali galoch ya badtameezi bilkul allowed nahi.\n3️⃣ Group mein koi links share nahi karega.`;
        } else if (lowerText.includes('/help')) {
            replyText = `🤖 *Gumnam Agent Commands (@${participant.split('@')[0]}):*\n- /song : Song sunne ke liye\n- /rules : Group ke rules dekhne ke liye\n- /help : Madad ke liye`;
        } else if (lowerText.includes('hello') || lowerText.includes('salam')) {
            replyText = `Waikum Assalam @${participant.split('@')[0]}! Main Gumnam Agent hoon, is platform ka security bot.`;
        } else if (isMentioned) {
            replyText = `Ji @${participant.split('@')[0]}, main Gumnam Agent hoon. Yahan discipline aur sab ki izzat sab se pehle hai!`;
        }

        if (replyText) {
            await sock.sendMessage(senderJid, { 
                text: replyText,
                mentions: [participant] 
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
