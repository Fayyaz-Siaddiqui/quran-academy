import * as Joi from 'joi';

/** Fail fast at boot if the environment is incomplete or malformed. */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(4000),
  TRUST_PROXY_HOPS: Joi.number().default(1),
  SWAGGER_ENABLED: Joi.boolean().default(false),

  APP_URL: Joi.string().uri().required(),
  PUBLIC_SITE_URL: Joi.string().uri().required(),
  CORS_ORIGINS: Joi.string().required(),
  COOKIE_DOMAIN: Joi.string().allow('').default(''),

  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_CHALLENGE_SECRET: Joi.string().min(32).required(),
  /** 32-byte base64 key (or any long secret, SHA-256 stretched) — encrypts TOTP secrets at rest */
  DATA_ENCRYPTION_KEY: Joi.string().min(32).required(),

  DEFAULT_ACADEMY_SLUG: Joi.string().default('main'),

  MAIL_FROM: Joi.string().default('Quran Academy <no-reply@example.com>'),
  SMTP_HOST: Joi.string().allow('').default(''),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASS: Joi.string().allow('').default(''),

  STORAGE_ENDPOINT: Joi.string().allow('').default(''),
  STORAGE_REGION: Joi.string().default('auto'),
  STORAGE_BUCKET: Joi.string().allow('').default(''),
  STORAGE_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  STORAGE_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),

  ZOOM_VIDEO_SDK_KEY: Joi.string().allow('').default(''),
  ZOOM_VIDEO_SDK_SECRET: Joi.string().allow('').default(''),
  ZOOM_WEBHOOK_SECRET_TOKEN: Joi.string().allow('').default(''),
  /**
   * Live classroom provider. "auto" = Zoom when SDK keys are set, otherwise Jitsi Meet.
   * Jitsi needs no keys (demo / fallback); Zoom gives webhooks, cloud recording and in-page video.
   */
  VIDEO_PROVIDER: Joi.string().valid('auto', 'zoom', 'jitsi').default('auto'),
  JITSI_DOMAIN: Joi.string().hostname().default('meet.jit.si'),
  /** Minutes before start time that participants may join */
  CLASS_JOIN_WINDOW_MINUTES: Joi.number().default(10),
});
