import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables, NodeEnv } from '../../config/env.validation.js';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Envoi d'emails via l'API HTTP de Resend. Sans RESEND_API_KEY, rien n'est envoyé :
 * en développement le contenu (avec ses liens) s'affiche dans les logs ; en production
 * seul un avertissement est journalisé, pour ne jamais écrire un lien secret dans les logs.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string | undefined;
  private readonly from: string;
  private readonly isProduction: boolean;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.apiKey = config.get('RESEND_API_KEY', { infer: true });
    this.from = config.get('MAIL_FROM', { infer: true });
    this.isProduction = config.get('NODE_ENV', { infer: true }) === NodeEnv.Production;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.apiKey) {
      if (this.isProduction) {
        this.logger.warn(`RESEND_API_KEY absente : email « ${message.subject} » non envoyé`);
      } else {
        this.logger.log(`Email (non envoyé) à ${message.to} — ${message.subject}\n${message.text}`);
      }
      return;
    }

    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend a refusé l'email (${response.status}) : ${await response.text()}`);
    }
  }
}
