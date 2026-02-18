import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config/index.js';

// Bun native password hashing
async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}

const secretKey = new TextEncoder().encode(config.auth.jwtSecret);

export interface User {
  username: string;
}

// Simple in-memory user store (for single user mode)
// In production, use a proper database
let userStore: { username: string; passwordHash: string } | null = null;

export async function initializeDefaultUser(): Promise<void> {
  const passwordHash = await hashPassword(config.defaultPassword);
  userStore = {
    username: config.defaultUser,
    passwordHash,
  };
}

export async function createUser(username: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  userStore = { username, passwordHash };
}

export async function validateUser(username: string, password: string): Promise<User | null> {
  if (!userStore || userStore.username !== username) {
    return null;
  }

  const valid = await verifyPassword(password, userStore.passwordHash);
  if (!valid) {
    return null;
  }

  return { username };
}

export async function generateToken(user: User): Promise<string> {
  return new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.auth.tokenExpiry)
    .sign(secretKey);
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return { username: payload.username as string };
  } catch {
    return null;
  }
}

export function validateApiKey(apiKey: string): boolean {
  return apiKey === config.auth.apiKey;
}
