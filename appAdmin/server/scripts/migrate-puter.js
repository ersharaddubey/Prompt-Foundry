import 'dotenv/config';
import mongoose from 'mongoose';
import '../models/User.js';
import '../models/PuterAuthCode.js';

if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
await mongoose.connect(process.env.MONGO_URI);
await mongoose.connection.collection('users').createIndex({ puterId: 1 }, { unique: true, sparse: true, name: 'puterId_unique_sparse' });
await mongoose.connection.collection('puterauthcodes').createIndex({ codeHash: 1 }, { unique: true, name: 'puter_auth_code_hash_unique' });
await mongoose.connection.collection('puterauthcodes').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'puter_auth_code_ttl' });
console.log('Puter identity and one-time-code indexes are ready.');
await mongoose.disconnect();
