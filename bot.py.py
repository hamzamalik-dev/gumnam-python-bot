import sys
import re

# Owner JID configuration
OWNER_JID = "923039354643@s.whatsapp.net"
user_warnings = {}

# Bad words aur abusive language ki local list (Zero online dependency)
BAD_WORDS = [
    "fuck", "shit", "bitch", "asshole", "bastard", "idiot", 
    "haram", "choot", "lund", "gandu", "madarchod", "behenchod", "bhosdike"
]

def process_message(sender_jid, participant, is_group, is_announcement, message_text):
    """
    Gumnam Agent Local Core Logic Engine
    """
    global user_warnings
    
    # Personal inbox messages ko mukammal ignore karega
    if not is_group and not is_announcement:
        return None

    lower_text = message_text.lower()
    is_owner = (participant == OWNER_JID or sender_jid == OWNER_JID)

    # -------------------------------------------------------------
    # 1. STRICT ABUSE & BAD WORD FILTER (Background Enforcement)
    # -------------------------------------------------------------
    contains_abuse = any(word in lower_text for word in BAD_WORDS)
    if contains_abuse and not is_owner:
        warning_msg = (
            f"⚠️ *Respect Warning!*\n"
            f"@{participant.split('@')[0]}, is platform par badtameezi ya abuse bilkul "
            f"bardasht nahi ki jayegi. Girls ki respect aur decency sab se pehle hai!"
        )
        return {"action": "delete_and_warn", "text": warning_msg, "target": participant}

    # -------------------------------------------------------------
    # 2. PROFESSIONAL LINK MODERATION & SECURITY SYSTEM
    # -------------------------------------------------------------
    link_pattern = r"(https?://[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))"
    has_link = bool(re.search(link_pattern, message_text))

    if has_link and not is_owner:
        if participant not in user_warnings:
            user_warnings[participant] = 0
        user_warnings[participant] += 1
        warnings_count = user_warnings[participant]

        if warnings_count == 1:
            return {
                "action": "warn",
                "text": f"⚠️ *Link Warning (1/3)*\n@{participant.split('@')[0]}, is group/community mein links share karna sakht mana hai.",
                "target": participant
            }
        elif warnings_count == 2:
            return {
                "action": "delete_and_warn",
                "text": f"🚨 *Link Warning (2/3 & Deleted)*\n@{participant.split('@')[0]}, dobara link bhejne par message delete kar diya gaya hai.",
                "target": participant
            }
        else:
            return {
                "action": "kick",
                "text": f"❌ *Security Action Taken*\n@{participant.split('@')[0]} ko rules bar bar todne ki wajah se remove kiya ja raha hai.",
                "target": participant
            }

    # -------------------------------------------------------------
    # 3. MENTION-ONLY & OWNER PRIORITY AUTO-REPLY SYSTEM
    # -------------------------------------------------------------
    is_mentioned = "gumnam" in lower_text
    
    # Agar group mein mention nahi kiya gaya aur na hi owner hai, toh bot chup rahega
    if not is_mentioned and not is_owner:
        return None

    reply_text = ""

    if is_owner:
        if any(kw in lower_text for kw in ["suno", "kya hal", "gumnam"]):
            reply_text = "Ji Gumnam Owner! Main Gumnam Agent hoon. Sab systems bilkul control mein hain. Hukam karein?"
        elif any(kw in lower_text for kw in ["song", "gana", "gaana"]):
            reply_text = "🎵 Yeh lijiye Gumnam Owner ke liye special beat:\n\n*Dil ye mera maane na, roke tujhe jaane na...*\n🎶 (Gumnam Agent hazir hai!)"
        else:
            reply_text = f"Ji Gumnam Owner! Aapka message mil gaya hai: \"{message_text}\""
    else:
        if any(kw in lower_text for kw in ["song", "gana", "gaana"]):
            reply_text = f"🎵 @{participant.split('@')[0]}, yeh lijiye aapke liye song:\n\n*Ranjhna ve, asnhi teri yaad vich...*\n🎶 (Gumnam Agent entertainment mode!)"
        elif any(kw in lower_text for kw in ["hello", "salam"]):
            reply_text = f"Waikum Assalam @{participant.split('@')[0]}! Main Gumnam Agent hoon, is platform ka security bot. Yahan girls ki respect aur discipline lazmi hai."
        elif any(kw in lower_text for kw in ["help", "rules"]):
            reply_text = f"🤖 *Gumnam Agent Guidelines:*\n1. Girls ki respect aur izzat sab se pehle hai.\n2. Koi abuse ya links share karna sakht mana hai."
        else:
            reply_text = f"Ji @{participant.split('@')[0]}, main Gumnam Agent hoon. Yahan discipline aur sab ki izzat sab se pehle hai!"

    return {"action": "reply", "text": reply_text, "target": participant}

if __name__ == "__main__":
    print("Gumnam Agent Python Core Engine initialized successfully (Zero Traffic Mode Active).")