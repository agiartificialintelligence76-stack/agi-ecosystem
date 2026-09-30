// Messages paid for by burning $AGI (2026-09-30): what the page and the server share (the server: server/burn.js).
// The burn address is the usual "dead" address: nobody has its key, so $AGI sent there is gone for good, and anyone can
// see it there on the block explorer. The coin's own burn() (to 0x0) counts too, but wallets only offer "Send".
export const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
export const BURN_EXPLORER = `https://robinhoodchain.blockscout.com/address/${BURN_ADDRESS}`;

// The amounts the page suggests: 100, 500 and 1,000 messages at the price (whole $AGI a message)
export const packsFor = (price) => [100, 500, 1000].map((messages) => ({ messages, agi: messages * price }));

// "1,000" style numbers
export const fmt = (n) => Number(n).toLocaleString('en-US');
