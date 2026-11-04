import express, { Request, Response } from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port') !== -1
    ? process.argv.indexOf('--port')
    : process.argv.indexOf('-p');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = Number(process.argv[portArgIndex + 1]);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (process.env.NODE_ENV === 'production' && process.env.PORT) {
    const envPort = Number(process.env.PORT);
    if (!isNaN(envPort) && envPort > 0) return envPort;
  }
  // AI Studio requires port 3000 in development
  return 3000;
}

function getHost(): string {
  const hostIndex = process.argv.indexOf('--host');
  if (hostIndex !== -1 && process.argv[hostIndex + 1]) {
    return process.argv[hostIndex + 1];
  }
  return '0.0.0.0';
}

async function startServer() {
  const app = express();
  const PORT = getPort();
  const HOST = getHost();

  // Enable HTTP compression (Gzip / Deflate) for all compressible text/JS/CSS/JSON responses
  app.use(compression());

  // Parse JSON bodies
  app.use(express.json());

  // Prevent spam / duplicate submissions
  const recentSubmissions = new Map<string, number>();

  // API Health Endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Secure Backend Contact Form Endpoint
  app.post('/api/contact', async (req: Request, res: Response) => {
    try {
      const { name, email, message } = req.body || {};

      // 1. Validation
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid name (at least 2 characters).',
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !emailRegex.test(cleanEmail)) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid email address.',
        });
      }

      const cleanMessage = String(message || '').trim();
      if (!cleanMessage || cleanMessage.length < 5) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a message with at least 5 characters.',
        });
      }

      // 2. Prevent duplicate submissions within 30 seconds
      const submissionKey = `${cleanEmail}_${cleanMessage.slice(0, 40)}`;
      const now = Date.now();
      const lastSent = recentSubmissions.get(submissionKey);
      if (lastSent && now - lastSent < 30000) {
        return res.status(429).json({
          success: false,
          error: 'You have already sent this message. Please wait a moment before sending another.',
        });
      }

      const recipientEmail = 'amanjabeen30@gmail.com';
      const cleanName = String(name).trim();

      // OPTION A: Configured SMTP (e.g. Gmail App Password, SendGrid, Amazon SES)
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: `"${cleanName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
          replyTo: cleanEmail,
          to: recipientEmail,
          subject: `Paid Media Campaign Inquiry from ${cleanName}`,
          text: `Name: ${cleanName}\nEmail: ${cleanEmail}\n\nMessage:\n${cleanMessage}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #17142D; max-width: 600px;">
              <h2 style="color: #7438F0; margin-top: 0;">New Campaign Inquiry</h2>
              <p style="margin: 8px 0;"><strong>Name:</strong> ${cleanName}</p>
              <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${cleanEmail}">${cleanEmail}</a></p>
              <p style="margin: 16px 0 8px 0;"><strong>Message:</strong></p>
              <div style="background: #F8F7FC; padding: 16px; border-radius: 12px; border-left: 4px solid #7438F0; line-height: 1.6; white-space: pre-wrap;">${cleanMessage}</div>
            </div>
          `,
        });

        recentSubmissions.set(submissionKey, now);
        return res.json({ success: true, message: 'Message sent successfully!' });
      }

      // OPTION B: Configured Resend API
      if (process.env.RESEND_API_KEY) {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || 'Portfolio Contact <onboarding@resend.dev>',
            to: [recipientEmail],
            reply_to: cleanEmail,
            subject: `Paid Media Campaign Inquiry from ${cleanName}`,
            text: `Name: ${cleanName}\nEmail: ${cleanEmail}\n\nMessage:\n${cleanMessage}`,
          }),
        });

        const resendData = (await resendRes.json().catch(() => ({}))) as { message?: string };
        if (!resendRes.ok) {
          throw new Error(resendData.message || 'Resend delivery failed');
        }

        recentSubmissions.set(submissionKey, now);
        return res.json({ success: true, message: 'Message sent successfully!' });
      }

      // OPTION C: Secure forwarding via FormSubmit to recipient email
      const appOrigin =
        process.env.APP_URL ||
        'https://ais-dev-53ix54ro7q4lunbhaq4edp-100796839063.asia-southeast1.run.app';

      const forwardRes = await fetch(`https://formsubmit.co/ajax/${recipientEmail}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Origin: appOrigin,
          Referer: `${appOrigin}/contact`,
        },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          message: cleanMessage,
          _subject: `Paid Media Campaign Inquiry from ${cleanName}`,
          _template: 'table',
        }),
      });

      const forwardData = (await forwardRes.json().catch(() => ({}))) as {
        success?: boolean | string;
        message?: string;
      };

      if (forwardData.success === 'true' || forwardData.success === true) {
        recentSubmissions.set(submissionKey, now);
        return res.json({ success: true, message: 'Message sent successfully!' });
      }

      // If FormSubmit requires the one-time inbox activation click:
      if (forwardData.message && forwardData.message.toLowerCase().includes('activation')) {
        recentSubmissions.set(submissionKey, now);
        return res.status(200).json({
          success: false,
          needsActivation: true,
          message:
            "A one-time activation email was sent to amanjabeen30@gmail.com. Please click 'Activate Form' in your inbox to enable direct submissions.",
        });
      }

      return res.status(502).json({
        success: false,
        error:
          forwardData.message ||
          'The email delivery service could not deliver your message at this time.',
      });
    } catch (err: any) {
      console.error('Contact form submission error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Server error while delivering message.',
      });
    }
  });

  // Mount Vite or static dist
  if (process.env.NODE_ENV === 'production') {
    // 1-year immutable cache for built assets (images, hashed JS, CSS)
    app.use(
      '/assets',
      express.static(path.resolve(__dirname, 'dist', 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );
    app.use(
      express.static(path.resolve(__dirname, 'dist'), {
        maxAge: '2h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            // HTML index must not be cached indefinitely so new deployments take effect
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req: Request, res: Response, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('Server error:', err);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
