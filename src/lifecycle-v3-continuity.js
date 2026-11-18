import { lifecycleV3Unsubscribe, lifecycleV3Webhook } from './lifecycle-v3.js';

export default {
  fetch(request, env) {
    switch (new URL(request.url).pathname) {
      case '/member-emails/unsubscribe':
        return lifecycleV3Unsubscribe(request, env);
      case '/webhooks/member-emails':
        return lifecycleV3Webhook(request, env);
      default:
        return new Response('Not found', { status: 404 });
    }
  }
};
