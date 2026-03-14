// VAPID Web Push implementation using Web Crypto API

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64Url(array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function importVapidPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  const keyBytes = urlBase64ToUint8Array(privateKeyBase64);
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits']
  );
}

async function buildVapidJwt(
  subject: string,
  audience: string,
  privateKeyBase64: string,
  publicKeyBase64: string
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const headerB64 = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const payloadB64 = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signingInput = `${headerB64}.${payloadB64}`;

  const privateKeyBytes = urlBase64ToUint8Array(privateKeyBase64);
  const key = await crypto.subtle.importKey(
    'raw',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = uint8ArrayToBase64Url(new Uint8Array(signature));
  return `${signingInput}.${sigB64}`;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  eventId?: string;
  channelName?: string;
}

export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const jwt = await buildVapidJwt(vapidSubject, audience, vapidPrivateKey, vapidPublicKey);
    const authHeader = `vapid t=${jwt},k=${vapidPublicKey}`;

    // Encrypt the payload using Web Push encryption (RFC 8291)
    const encryptedPayload = await encryptWebPushPayload(
      subscription.p256dh,
      subscription.auth,
      JSON.stringify(payload)
    );

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        TTL: '86400',
        Urgency: 'normal',
      },
      body: encryptedPayload,
    });

    return response.status === 201 || response.status === 200;
  } catch (err) {
    console.error('Push send error:', err);
    return false;
  }
}

// RFC 8291 — Message Encryption for Web Push (aes128gcm)
async function encryptWebPushPayload(
  clientPublicKeyBase64: string,
  authSecretBase64: string,
  plaintext: string
): Promise<Uint8Array> {
  const clientPublicKeyBytes = urlBase64ToUint8Array(clientPublicKeyBase64);
  const authSecret = urlBase64ToUint8Array(authSecretBase64);
  const plaintextBytes = new TextEncoder().encode(plaintext);

  // Generate server ephemeral key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const serverPublicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  );

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    serverKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF extract + expand (PRK)
  const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, [
    'deriveBits',
  ]);

  // IKM = HKDF-Extract(auth_secret, shared_secret) with context
  const prkInfo = buildInfo('WebPush: info\x00', clientPublicKeyBytes, serverPublicKeyBytes);
  const ikmBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: prkInfo },
    hkdfKey,
    256
  );
  const ikm = new Uint8Array(ikmBits);

  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);

  // CEK
  const cekInfo = buildInfo2('Content-Encoding: aes128gcm\x00');
  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    ikmKey,
    128
  );

  // Nonce
  const nonceInfo = buildInfo2('Content-Encoding: nonce\x00');
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    ikmKey,
    96
  );
  const nonce = new Uint8Array(nonceBits);

  const aesKey = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt']);

  // Pad plaintext with a \x02 delimiter (record end)
  const paddedPlaintext = new Uint8Array(plaintextBytes.length + 1);
  paddedPlaintext.set(plaintextBytes);
  paddedPlaintext[plaintextBytes.length] = 2;

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedPlaintext)
  );

  // Build header: salt (16) + rs (4) + keyidlen (1) + keyid (65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const keyidlen = new Uint8Array([serverPublicKeyBytes.length]);

  const header = concat(salt, rs, keyidlen, serverPublicKeyBytes);
  return concat(header, ciphertext);
}

function buildInfo(label: string, clientKey: Uint8Array, serverKey: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const labelBytes = enc.encode(label);
  const lenBytes = new Uint8Array(2);
  new DataView(lenBytes.buffer).setUint16(0, clientKey.length, false);
  const lenBytes2 = new Uint8Array(2);
  new DataView(lenBytes2.buffer).setUint16(0, serverKey.length, false);
  return concat(labelBytes, lenBytes, clientKey, lenBytes2, serverKey);
}

function buildInfo2(label: string): Uint8Array {
  return new TextEncoder().encode(label);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
