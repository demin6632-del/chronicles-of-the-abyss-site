const crypto=require('crypto');
function secret(){if(!process.env.DLC_TOKEN_SECRET||process.env.DLC_TOKEN_SECRET.length<32)throw new Error('DLC_TOKEN_SECRET is not configured');return process.env.DLC_TOKEN_SECRET}
function sign(payload){const body=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',secret()).update(body).digest('base64url');return `ABYSS-${body}.${sig}`}
function verify(token){if(typeof token!=='string'||!token.startsWith('ABYSS-'))return null;const raw=token.slice(6);const [body,sig]=raw.split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',secret()).update(body).digest('base64url');if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;try{return JSON.parse(Buffer.from(body,'base64url').toString('utf8'))}catch{return null}}
module.exports={sign,verify};
