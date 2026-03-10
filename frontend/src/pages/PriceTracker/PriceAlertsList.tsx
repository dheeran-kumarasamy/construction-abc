import type { PriceAlert } from "./types";

interface Props {
  alerts: PriceAlert[];
  onDelete: (id: string) => Promise<void>;
}

export default function PriceAlertsList({ alerts, onDelete }: Props) {
  return (
    <div className="pt-card">
      <h3>Alerts</h3>
      {alerts.length === 0 ? <p>No alerts created yet.</p> : null}
      <div className="pt-alert-list">
        {alerts.map((alert) => (
          <div key={alert.id} className="pt-alert-item">
            <div>
              <strong>{alert.materialName}</strong> · {alert.districtName}
              <div>{alert.condition} ₹{alert.threshold.toFixed(2)}</div>
              <small>
                {alert.lastTriggeredAt
                  ? `Last triggered: ${new Date(alert.lastTriggeredAt).toLocaleString()}`
                  : "Not triggered yet"}
              </small>
            </div>
            <button type="button" onClick={() => onDelete(alert.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
