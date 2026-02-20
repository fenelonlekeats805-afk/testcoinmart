import { Injectable } from '@nestjs/common';

@Injectable()
export class TelegramNotifierService {
  private getConfig() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      return null;
    }
    return { token, chatId };
  }

  async notify(message: string): Promise<void> {
    const cfg = this.getConfig();
    if (!cfg) {
      return;
    }

    try {
      await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: cfg.chatId,
          text: message,
        }),
      });
    } catch {
      // ignore notifier failures
    }
  }
}
