import db from "../config/db.js";
import { AppError } from "../utils/AppError.js";

export const listNotifications = async (req, res, next) => {
  try {
    const uid = req.user.user_id;
    const unreadOnly = req.query.unreadOnly === "1" || req.query.unreadOnly === "true";
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

    const [result] = await db.execute("CALL construction_spNotificationsList(?,?,?)", [
      uid,
      unreadOnly ? 1 : 0,
      limit,
    ]);
    const rows = result?.[0] || [];
    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const uid = req.user.user_id;
    const [result] = await db.execute("CALL construction_spNotificationsUnreadCount(?)", [uid]);
    const count = Number(result?.[0]?.[0]?.unread_count ?? 0);
    return res.json({ success: true, data: { unread_count: count } });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const uid = req.user.user_id;
    const id = Number(req.params.id);
    if (!id) throw new AppError("Invalid id", 400);

    await db.execute("CALL construction_spNotificationMarkRead(?,?)", [id, uid]);
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    const uid = req.user.user_id;
    await db.execute(
      `UPDATE construction_notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL`,
      [uid]
    );
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
