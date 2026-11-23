import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import jwt from 'jsonwebtoken';
import { safeEqual } from '../../common/utils/crypto';

export interface VideoSdkJoinToken {
  token: string;
  sessionName: string;
  userName: string;
  userIdentity: string;
  role: 'host' | 'participant';
  expiresAt: string;
}

/**
 * Zoom Video SDK integration.
 * Docs: https://developers.zoom.us/docs/video-sdk/auth/
 *
 * The browser joins with @zoom/videosdk using the JWT we sign here. The
 * session name is unique per ClassSession, so tokens cannot be reused to
 * enter a different class.
 */
@Injectable()
export class ZoomService {
  constructor(private readonly config: ConfigService) {}

  get configured() {
    return !!this.config.get('ZOOM_VIDEO_SDK_KEY') && !!this.config.get('ZOOM_VIDEO_SDK_SECRET');
  }

  signJoinToken(params: {
    sessionName: string;
    userId: string;
    userName: string;
    role: 'host' | 'participant';
    validUntil: Date;
  }): VideoSdkJoinToken {
    const key = this.config.get<string>('ZOOM_VIDEO_SDK_KEY');
    const secret = this.config.get<string>('ZOOM_VIDEO_SDK_SECRET');
    if (!key || !secret) throw new ServiceUnavailableException('Live classroom is not configured');

    const iat = Math.floor(Date.now() / 1000) - 30;
    // Zoom allows 30 min – 48 h. Cover the class end plus a buffer.
    const exp = Math.min(Math.max(Math.floor(params.validUntil.getTime() / 1000) + 30 * 60, iat + 1800), iat + 48 * 3600);
    const payload = {
      app_key: key,
      version: 1,
      tpc: params.sessionName,
      role_type: params.role === 'host' ? 1 : 0,
      // Echoed back in webhooks as participant.user_key — used to mark attendance.
      user_key: params.userId.slice(0, 36),
      user_identity: params.userId.slice(0, 35),
      // Hosts start cloud recording; participants cannot.
      cloud_recording_option: params.role === 'host' ? 1 : 0,
      iat,
      exp,
    };
    const token = jwt.sign(payload, secret, { algorithm: 'HS256', header: { alg: 'HS256', typ: 'JWT' } });
    return {
      token,
      sessionName: params.sessionName,
      userName: params.userName,
      userIdentity: params.userId,
      role: params.role,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  /** Zoom webhook signature: x-zm-signature = "v0=" + HMAC_SHA256(secret, "v0:{ts}:{rawBody}") */
  verifyWebhook(rawBody: string, timestamp: string | undefined, signature: string | undefined) {
    const secret = this.config.get<string>('ZOOM_WEBHOOK_SECRET_TOKEN');
    if (!secret || !timestamp || !signature) return false;
    // Reject replays older than 5 minutes.
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
    const expected = 'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex');
    return safeEqual(expected, signature);
  }

  /** Response for Zoom's endpoint.url_validation challenge. */
  urlValidation(plainToken: string) {
    const secret = this.config.get<string>('ZOOM_WEBHOOK_SECRET_TOKEN', '');
    return { plainToken, encryptedToken: createHmac('sha256', secret).update(plainToken).digest('hex') };
  }
}
