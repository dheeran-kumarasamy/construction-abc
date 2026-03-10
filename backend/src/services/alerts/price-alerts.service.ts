import pool from "../../db/pool";

export async function processPriceAlerts(materialId: string, districtId: string, newPrice: number) {
  const activeAlerts = await pool.query(
    `
      SELECT
        pa.id,
        pa.user_id,
        pa.condition,
        pa.threshold,
        m.name AS material_name,
        d.name AS district_name
      FROM price_alerts pa
      JOIN materials m ON m.id = pa.material_id
      JOIN districts d ON d.id = pa.district_id
      WHERE pa.material_id = $1
        AND pa.district_id = $2
        AND pa.is_active = true
    `,
    [materialId, districtId]
  );

  for (const alert of activeAlerts.rows) {
    const threshold = Number(alert.threshold);
    const matched =
      (alert.condition === "above" && newPrice > threshold) ||
      (alert.condition === "below" && newPrice < threshold);

    if (!matched) continue;

    await pool.query(
      `
        UPDATE price_alerts
        SET last_triggered_at = now(), updated_at = now()
        WHERE id = $1
      `,
      [alert.id]
    );

    const direction = alert.condition === "above" ? "above" : "below";
    const message = `${alert.material_name} in ${alert.district_name} is now ₹${newPrice.toFixed(2)}, ${direction} your threshold ₹${threshold.toFixed(2)}.`;

    await pool.query(
      `
        INSERT INTO notifications (user_id, message, is_read, metadata, created_at)
        VALUES ($1, $2, false, $3::jsonb, now())
      `,
      [
        alert.user_id,
        message,
        JSON.stringify({
          type: "price_alert",
          materialId,
          districtId,
          currentPrice: newPrice,
          threshold,
          condition: alert.condition,
        }),
      ]
    );
  }
}
