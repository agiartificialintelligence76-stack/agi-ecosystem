// "Sign in with your wallet" (Phase 3). The wallet signs a plain-text message (the standard Sign-In with Ethereum
// format). A signature is free: it is NOT a transaction, costs no gas and gives no access to anyone's tokens.
// It only proves that whoever asked really controls the address.
//   start:  the server writes the exact message (with a one-time code) + a "ticket" that proves it wrote it
//   finish: the browser sends back message + ticket + signature; the server checks all three
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { recoverMessageAddress, getAddress, isAddress } from 'viem';
import { createSiweMessage, parseSiweMessage } from 'viem/siwe';
import { CHAIN_ID } from './chain.js';

export const STATEMENT = 'Sign in to chat with AGI-1. This free signature only proves you own this wallet: '
  + 'it is not a transaction, costs no gas and gives no access to your tokens.';
const TICKET_MS = 5 * 60 * 1000;                      // the message must be signed within 5 minutes
const CLOCK_SLACK_MS = 60 * 1000;                     // "Issued At" 1 minute early: wallets whose clock runs a little
                                                      // behind would otherwise warn that it's "in the future" (Phantom does)

// The network the wallet is on right now (EIP-155 chain ID), as the page read it with eth_chainId. Wallets like Phantom
// refuse or warn when a sign-in names a network they aren't using. A signature from a normal wallet proves the same thing on
// any network, and the $AGI balance is always read on Robinhood Chain, so this only changes the "Chain ID" line.
// Anything odd falls back to Robinhood Chain.
export const signInChain = (chainId) => (Number.isSafeInteger(chainId) && chainId > 0 ? chainId : CHAIN_ID);

const b64url = (data) => Buffer.from(data).toString('base64url');
const hmac = (secret, text) => createHmac('sha256', secret).update(text).digest();
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const sameText = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

// origin = the site's own address, e.g. https://agi1.app (wallets warn if it doesn't match)
export function startSignIn(secret, { address, origin, visitor, chainId }, now = Date.now()) {
  if (typeof address !== 'string' || !isAddress(address)) throw new Error('bad_address');
  const url = new URL(origin);
  const message = createSiweMessage({
    domain: url.host,
    address: getAddress(address),
    statement: STATEMENT,
    uri: url.origin,
    version: '1',
    chainId: signInChain(chainId),
    nonce: randomBytes(12).toString('hex'),
    issuedAt: new Date(now - CLOCK_SLACK_MS),
    expirationTime: new Date(now + TICKET_MS),
  });
  // The ticket ties this exact message to this visitor for 5 minutes, so it can't be reused elsewhere.
  const payload = b64url(JSON.stringify({ h: sha256(message), i: visitor, e: now + TICKET_MS }));
  return { message, ticket: `${payload}.${b64url(hmac(secret, `signin:${payload}`))}` };
}

// → the wallet address (lowercase) that signed, or throws with a short reason
export async function finishSignIn(secret, { message, ticket, signature, origin, visitor }, now = Date.now()) {
  if (typeof message !== 'string' || message.length > 2000 || typeof ticket !== 'string' || ticket.length > 400) throw new Error('bad_request');
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new Error('bad_signature');
  const [payload, sig, extra] = ticket.split('.');
  if (!payload || !sig || extra !== undefined || !sameText(sig, b64url(hmac(secret, `signin:${payload}`)))) throw new Error('bad_ticket');
  let t;
  try { t = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw new Error('bad_ticket'); }
  if (t.e <= now) throw new Error('expired');
  if (t.i !== visitor || t.h !== sha256(message)) throw new Error('bad_ticket');

  const fields = parseSiweMessage(message);
  const url = new URL(origin);
  // (the ticket already proves the server wrote this exact text; these checks are a second lock)
  if (fields.domain !== url.host || fields.uri !== url.origin || signInChain(fields.chainId) !== fields.chainId || !fields.address) throw new Error('bad_message');
  const signer = await recoverMessageAddress({ message, signature });
  if (signer.toLowerCase() !== fields.address.toLowerCase()) throw new Error('wrong_signer');
  return signer.toLowerCase();
}
