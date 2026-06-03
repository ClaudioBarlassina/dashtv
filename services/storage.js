const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const DATA_FILE = path.join(__dirname, '..', 'data', 'subscriptions.json');
const MONGODB_URI = process.env.MONGODB_URI;

// ─── JSON file backend ─────────────────────────────────────

function readJSON() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    const init = {
      admin: { password: 'admin123', token: null },
      codes: [],
      channels: [
        { id: 'telefe', name: 'Telefe', country: 'Argentina', logo: null, streamUrl: null, note: 'Disponible durante el Mundial' },
        { id: 'espn', name: 'ESPN', country: 'Argentina', logo: null, streamUrl: null, note: 'Disponible durante el Mundial' },
        { id: 'tycsports', name: 'TyC Sports', country: 'Argentina', logo: null, streamUrl: null, note: 'Disponible durante el Mundial' },
        { id: 'dsports', name: 'DSports', country: 'Argentina', logo: null, streamUrl: null, note: 'Disponible durante el Mundial' },
      ],
    };
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    writeJSON(init);
    return init;
  }
}

function writeJSON(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─── MongoDB backend ────────────────────────────────────────

let mongoClient = null;
let db = null;

async function connectMongo() {
  mongoClient = await MongoClient.connect(MONGODB_URI);
  db = mongoClient.db('DashTv');
  // seed
  const adminExists = await db.collection('admin').findOne({ _id: 'admin' });
  if (!adminExists) {
    await db.collection('admin').insertOne({ _id: 'admin', password: 'admin123', token: null });
    console.log('  → Seeded admin user (default password: admin123)');
  }
  const channelCount = await db.collection('channels').countDocuments();
  if (channelCount === 0) {
    await db.collection('channels').insertMany([
      { id: 'telefe', name: 'Telefe', country: 'Argentina', logo: null, streamUrl: null, note: 'Disponible durante el Mundial' },
      { id: 'espn', name: 'ESPN', country: 'Argentina', logo: null, streamUrl: null, note: 'Disponible durante el Mundial' },
      { id: 'tycsports', name: 'TyC Sports', country: 'Argentina', logo: null, streamUrl: null, note: 'Disponible durante el Mundial' },
      { id: 'dsports', name: 'DSports', country: 'Argentina', logo: null, streamUrl: null, note: 'Disponible durante el Mundial' },
    ]);
    console.log('  → Seeded default channels');
  }
  console.log('  → MongoDB connected');
}

// ─── Storage abstraction ────────────────────────────────────

let useMongo = false;
let ready = false;

async function init() {
  if (MONGODB_URI) {
    try {
      await connectMongo();
      useMongo = true;
    } catch (err) {
      console.error('  → MongoDB connection failed, using JSON file:', err.message);
      useMongo = false;
    }
  }
  ready = true;
}

// Admin

async function getAdmin() {
  if (useMongo) return db.collection('admin').findOne({ _id: 'admin' });
  return readJSON().admin;
}

async function setAdminToken(token) {
  if (useMongo) {
    await db.collection('admin').updateOne({ _id: 'admin' }, { $set: { token } });
    return;
  }
  const data = readJSON();
  data.admin.token = token;
  writeJSON(data);
}

async function updateAdminPassword(current, newPw) {
  if (useMongo) {
    const admin = await db.collection('admin').findOne({ _id: 'admin' });
    if (admin.password !== current) return false;
    await db.collection('admin').updateOne({ _id: 'admin' }, { $set: { password: newPw } });
    return true;
  }
  const data = readJSON();
  if (data.admin.password !== current) return false;
  data.admin.password = newPw;
  writeJSON(data);
  return true;
}

async function checkToken(token) {
  if (useMongo) {
    const admin = await db.collection('admin').findOne({ _id: 'admin' });
    return admin && admin.token === token;
  }
  return readJSON().admin.token === token;
}

// Codes

async function getCodes() {
  if (useMongo) {
    const codes = await db.collection('codes').find().toArray();
    return codes.map((c) => ({
      id: c.id, code: c.code, createdAt: c.createdAt, expiresAt: c.expiresAt,
      status: c.status, redeemedAt: c.redeemedAt, deviceId: c.deviceId, deviceName: c.deviceName,
    }));
  }
  return readJSON().codes;
}

async function createCode(days) {
  const now = new Date();
  const expires = new Date(now.getTime() + days * 86400000);
  const code = {
    id: crypto.randomUUID(),
    code: 'WC26-' + crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 4) + '-' + crypto.randomBytes(4).toString('hex').toUpperCase().slice(4, 8),
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    status: 'active',
    redeemedAt: null,
    deviceId: null,
    deviceName: null,
  };
  if (useMongo) {
    await db.collection('codes').insertOne(code);
  } else {
    const data = readJSON();
    data.codes.push(code);
    writeJSON(data);
  }
  return code;
}

async function deleteCode(id) {
  if (useMongo) {
    await db.collection('codes').deleteOne({ id });
    return;
  }
  const data = readJSON();
  data.codes = data.codes.filter((c) => c.id !== id);
  writeJSON(data);
}

async function findCodeByCode(codeStr) {
  if (useMongo) return db.collection('codes').findOne({ code: codeStr });
  return readJSON().codes.find((c) => c.code === codeStr) || null;
}

async function findActiveByDeviceId(deviceId) {
  if (useMongo) {
    return db.collection('codes').findOne({
      deviceId,
      status: 'redeemed',
      expiresAt: { $gt: new Date().toISOString() },
    });
  }
  return readJSON().codes.find(
    (c) => c.deviceId === deviceId && c.status === 'redeemed' && new Date(c.expiresAt) > new Date()
  ) || null;
}

async function updateCode(id, fields) {
  if (useMongo) {
    await db.collection('codes').updateOne({ id }, { $set: fields });
    return;
  }
  const data = readJSON();
  const c = data.codes.find((c) => c.id === id);
  if (c) Object.assign(c, fields);
  writeJSON(data);
}

// Channels

async function getChannels() {
  if (useMongo) {
    return db.collection('channels').find().toArray();
  }
  return readJSON().channels;
}

async function setChannels(channels) {
  if (useMongo) {
    await db.collection('channels').deleteMany({});
    await db.collection('channels').insertMany(channels);
    return;
  }
  const data = readJSON();
  data.channels = channels;
  writeJSON(data);
}

module.exports = {
  init, ready: () => ready,
  getAdmin, setAdminToken, updateAdminPassword, checkToken,
  getCodes, createCode, deleteCode, findCodeByCode, findActiveByDeviceId, updateCode,
  getChannels, setChannels,
};
