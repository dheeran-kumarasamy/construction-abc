import type { PriceAlert } from "./types";
import { formatINR } from "../../services/currency";
import { formatDateTime } from "../../services/dateTime";

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
              <div>{alert.condition} {formatINR(alert.threshold, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <small>
                {alert.lastTriggeredAt
                  ? `Last triggered: ${formatDateTime(alert.lastTriggeredAt)}`
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
