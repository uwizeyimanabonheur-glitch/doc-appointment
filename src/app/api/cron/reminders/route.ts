import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyReminder } from "@/lib/appointment-events";

// Triggered by Vercel Cron (see vercel.json). Sends reminders for
// appointments happening within REMINDER_DAYS_BEFORE days that are not yet
// done and haven't already been reminded.
export async function GET(req: Request) {
  // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const daysBefore = Number(process.env.REMINDER_DAYS_BEFORE || "1");
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + daysBefore);

  const due = await prisma.appointment.findMany({
    where: {
      reminderSent: false,
      status: { in: ["PENDING", "CONFIRMED"] },
      date: { gte: now, lte: windowEnd },
    },
    select: { id: true },
  });

  for (const appt of due) {
    await notifyReminder(appt.id);
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { reminderSent: true },
    });
  }

  return NextResponse.json({ ok: true, reminded: due.length });
}
