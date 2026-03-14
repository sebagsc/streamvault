import { sendPushNotification } from '../lib/push';
import type { Env } from '../types';

interface EventRow {
  id: string;
  channel_id: string;
  title: string;
  event_datetime: string;
}

interface UserSubscription {
  user_id: string;
  notification_lead_time: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function runPushSender(env: Env): Promise<void> {
  const now = new Date();
  // Check a window: events starting between now and now+31 minutes
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getTime() + 31 * 60 * 1000).toISOString();

  // Get upcoming events in the window
  const events = await env.DB.prepare(
    `SELECT * FROM events
     WHERE event_datetime >= ? AND event_datetime <= ?`
  )
    .bind(windowStart, windowEnd)
    .all<EventRow>();

  if (events.results.length === 0) return;

  for (const event of events.results) {
    const eventTime = new Date(event.event_datetime).getTime();
    const minutesUntil = Math.round((eventTime - now.getTime()) / 60000);

    // Get all subscribed users with push subscriptions
    const subs = await env.DB.prepare(
      `SELECT es.user_id, u.notification_lead_time, ps.endpoint, ps.p256dh, ps.auth
       FROM event_subscriptions es
       JOIN users u ON es.user_id = u.id
       JOIN push_subscriptions ps ON es.user_id = ps.user_id
       WHERE es.event_id = ? AND u.active = 1`
    )
      .bind(event.id)
      .all<UserSubscription>();

    // Only notify users whose lead time matches current window
    const toNotify = subs.results.filter((s) => {
      // Send notification when the event is within [leadTime, leadTime+1) minutes away
      return minutesUntil <= s.notification_lead_time && minutesUntil > s.notification_lead_time - 2;
    });

    if (toNotify.length === 0) continue;

    // Get channel name from KV
    const channelsRaw = (await env.KV.get('channels', 'json')) as Array<{
      id: string;
      name: string;
    }> | null;
    const channel = channelsRaw?.find((ch) => ch.id === event.channel_id);
    const channelName = channel?.name ?? event.channel_id;

    const payload = {
      title: event.title,
      body: minutesUntil <= 1
        ? `${channelName} is starting now!`
        : `Starts in ${minutesUntil} minutes on ${channelName}`,
      url: `/?channel=${event.channel_id}`,
      eventId: event.id,
      channelName,
    };

    await Promise.allSettled(
      toNotify.map((sub) =>
        sendPushNotification(
          sub,
          payload,
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY,
          env.VAPID_SUBJECT
        )
      )
    );

    console.log(`[Push] Sent ${toNotify.length} notifications for event "${event.title}"`);
  }
}
