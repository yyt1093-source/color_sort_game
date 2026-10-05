const crypto = require('crypto');

// Load Telegram Bot Token from environment or fallback
const BOT_TOKEN = process.env.BOT_TOKEN || '8837816458:AAGeBFs-ZOF56yro_QhZ7b-Wr6v8RaR6x0c';

// Authorized administrators (Telegram IDs)
// Alligator (Owner/Admin)
const ADMIN_TELEGRAM_IDS = ['5761685341'];

/**
 * Validate Telegram Mini App initData signature using HMAC-SHA256 according to Telegram specifications.
 * Returns validated user payload or null if verification fails.
 */
function validateTelegramInitData(initData, botToken = BOT_TOKEN) {
  if (!initData || typeof initData !== 'string') return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    // Sort all query parameters alphabetically
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys.map(k => `${k}=${params.get(k)}`).join('\n');

    // secret_key = HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    // calculated_hash = HMAC_SHA256(secretKey, dataCheckString)
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      return null;
    }

    // Replay attack safeguard: auth_date tolerance (up to 48 hours to accommodate mobile apps in background)
    const authDate = Number(params.get('auth_date') || 0);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!authDate || Math.abs(nowSec - authDate) > 86400 * 2) {
      return null;
    }

    const userRaw = params.get('user');
    let user = null;
    if (userRaw) {
      try {
        user = JSON.parse(userRaw);
      } catch (e) {
        return null;
      }
    }

    if (!user || !user.id) {
      return null;
    }

    return {
      isValid: true,
      telegramId: String(user.id),
      user,
      authDate
    };
  } catch (err) {
    return null;
  }
}

/**
 * Express Middleware for Authenticating and Authorizing User-State Requests
 * Prevents identity spoofing: users can ONLY access and modify their own state!
 */
function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'] ||
                   req.headers['authorization']?.replace(/^Bearer\s+|^tma\s+/i, '') ||
                   req.body?.initData ||
                   req.query?.initData;

  const isLocalDev = process.env.NODE_ENV !== 'production' && (
    req.hostname === 'localhost' ||
    req.ip === '127.0.0.1' ||
    req.ip === '::1'
  );

  let validated = null;
  if (initData) {
    validated = validateTelegramInitData(initData, BOT_TOKEN);
  }

  const requestedTargetId = String(req.body?.telegramId || req.query?.telegramId || '').trim();
  const requestedRecipientId = String(req.body?.recipientId || req.query?.recipientId || '').trim();

  // 1. Authenticated Telegram User
  if (validated && validated.telegramId) {
    const authId = validated.telegramId;
    req.user = validated.user;
    req.telegramId = authId;
    req.isAuthenticated = true;

    // AUTHORIZATION ENFORCEMENT:
    // If the caller requested an explicit telegramId, it MUST match the authenticated user!
    if (requestedTargetId && requestedTargetId !== authId) {
      console.warn(`[AUTH] 403 Forbidden: User ${authId} attempted to modify account of ${requestedTargetId}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access or modify another player\'s account'
      });
    }

    // If claiming gifts, recipientId MUST match the authenticated user!
    if ((req.path === '/claim' || req.path.endsWith('/claim')) && requestedRecipientId && requestedRecipientId !== authId) {
      console.warn(`[AUTH] 403 Forbidden: User ${authId} attempted to claim gifts for ${requestedRecipientId}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot claim gifts intended for another player'
      });
    }

    // Force downstream parameters to use the verified authenticated ID
    if (req.body && typeof req.body === 'object') {
      if (req.body.telegramId !== undefined) req.body.telegramId = authId;
      if (req.path === '/claim' || req.path.endsWith('/claim')) {
        if (req.body.recipientId !== undefined) req.body.recipientId = authId;
      }
      if (req.body.senderId !== undefined && !ADMIN_TELEGRAM_IDS.includes(authId)) {
        req.body.senderId = authId;
      }
    }
    if (req.query && typeof req.query === 'object') {
      if (req.query.telegramId !== undefined) req.query.telegramId = authId;
      if (req.path === '/claim' || req.path.endsWith('/claim')) {
        if (req.query.recipientId !== undefined) req.query.recipientId = authId;
      }
    }

    return next();
  }

  // 2. Allow guest / dev testing identifiers when running outside Telegram (e.g. browser dev mode)
  if (requestedTargetId.startsWith('guest_') || requestedTargetId.startsWith('dev_') || requestedTargetId.startsWith('tg_user_')) {
    req.telegramId = requestedTargetId;
    req.isGuest = true;
    return next();
  }

  // 3. Local dev bypass for developer tests
  if (isLocalDev && req.headers['x-dev-test-mode'] === 'true') {
    req.telegramId = requestedTargetId || 'guest_dev_123';
    req.isGuest = true;
    return next();
  }

  // 4. Any request targeting a numeric Telegram ID without valid initData is strictly REJECTED
  console.warn(`[AUTH] 401 Unauthorized: Target ${requestedTargetId || '(none)'} requested without valid initData from ${req.ip}`);
  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Valid Telegram authentication (initData) required'
  });
}

/**
 * Express Middleware for Admin-Only Routes
 * Requires cryptographically verified Telegram ID belonging to ADMIN_TELEGRAM_IDS
 */
function adminAuthMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    // Local dev testing flag
    const isLocalDev = process.env.NODE_ENV !== 'production' && (
      req.hostname === 'localhost' ||
      req.ip === '127.0.0.1' ||
      req.ip === '::1'
    );
    if (isLocalDev && req.body?.isLocalAdmin) {
      return next();
    }

    if (!req.isAuthenticated) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Telegram authentication required'
      });
    }

    if (!ADMIN_TELEGRAM_IDS.includes(req.telegramId)) {
      console.warn(`[AUTH] 403 Forbidden: Non-admin user ${req.telegramId} attempted to access admin route ${req.path}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Administrator privileges required'
      });
    }

    next();
  });
}

/**
 * Check if the request is from an authenticated admin
 */
function checkIsAdmin(arg) {
  if (!arg) return false;

  // If passed an Express request object that passed middleware
  if (arg.isAuthenticated && arg.telegramId && ADMIN_TELEGRAM_IDS.includes(arg.telegramId)) {
    return true;
  }

  // Find initData wherever it may be located in arg (req, req.body, or req.query)
  const initData = arg.headers?.['x-telegram-init-data'] ||
                   arg.headers?.['authorization']?.replace(/^Bearer\s+|^tma\s+/i, '') ||
                   arg.body?.initData ||
                   arg.query?.initData ||
                   arg.initData;

  if (initData) {
    const validated = validateTelegramInitData(initData, BOT_TOKEN);
    if (validated && ADMIN_TELEGRAM_IDS.includes(validated.telegramId)) {
      return true;
    }
  }

  // Local development bypass
  if (process.env.NODE_ENV !== 'production' && (arg.body?.isLocalAdmin || arg.isLocalAdmin)) {
    return true;
  }

  return false;
}

module.exports = {
  BOT_TOKEN,
  ADMIN_TELEGRAM_IDS,
  validateTelegramInitData,
  authMiddleware,
  adminAuthMiddleware,
  checkIsAdmin
};
