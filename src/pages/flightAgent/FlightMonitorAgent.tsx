import React, { useState } from "react";
import { flightMonitorService } from "../../services/flightMonitorService";
import type { FlightReport, FlightDestination } from "../../types/flightTypes";

export default function FlightMonitorAgent() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [flightBudget, setFlightBudget] = useState(50000);
  const [stayBudget, setStayBudget] = useState(100000);
  const [latestReport, setLatestReport] = useState<FlightReport | null>(() => 
    flightMonitorService.getLatestReport()
  );
  const [allReports, setAllReports] = useState<FlightReport[]>(() => 
    flightMonitorService.getAllReports()
  );
  const [selectedDestination, setSelectedDestination] = useState<FlightDestination | null>(null);

  const handleStartMonitoring = () => {
    const now = new Date();
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    const config = {
      flightBudget,
      stayBudget,
      travelStartDate: now,
      travelEndDate: oneMonthLater,
      reportingPeriodMonths: 2,
      coupleTravel: true
    };

    flightMonitorService.setConfig(config);
    flightMonitorService.startMonitoring((report) => {
      setLatestReport(report);
      setAllReports(flightMonitorService.getAllReports());
    });

    setIsMonitoring(true);
  };

  const handleStopMonitoring = () => {
    flightMonitorService.stopMonitoring();
    setIsMonitoring(false);
  };

  const handleReset = () => {
    flightMonitorService.reset();
    setIsMonitoring(false);
    setLatestReport(null);
    setAllReports([]);
    setSelectedDestination(null);
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>✈️ Flight Getaway Agent</h1>
        <p style={styles.subtitle}>
          Find the perfect couple getaway within your budget
        </p>
      </div>

      {/* Configuration Panel */}
      <div style={styles.configPanel}>
        <h2 style={styles.sectionTitle}>Budget Configuration</h2>
        <div style={styles.configGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Flight Budget (for 2 people)</label>
            <input
              type="number"
              value={flightBudget}
              onChange={(e) => setFlightBudget(Number(e.target.value))}
              disabled={isMonitoring}
              style={styles.input}
            />
            <span style={styles.inputHint}>₹50,000 recommended</span>
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Stay & Other Expenses Budget</label>
            <input
              type="number"
              value={stayBudget}
              onChange={(e) => setStayBudget(Number(e.target.value))}
              disabled={isMonitoring}
              style={styles.input}
            />
            <span style={styles.inputHint}>₹1,00,000 recommended</span>
          </div>
        </div>

        <div style={styles.infoBox}>
          <p><strong>Travel Period:</strong> Next 1 month</p>
          <p><strong>Reporting Period:</strong> 2 months (reports generated periodically)</p>
          <p><strong>Total Budget:</strong> {formatCurrency(flightBudget + stayBudget)}</p>
        </div>

        <div style={styles.buttonGroup}>
          {!isMonitoring ? (
            <button onClick={handleStartMonitoring} style={styles.primaryButton}>
              🚀 Start Monitoring
            </button>
          ) : (
            <button onClick={handleStopMonitoring} style={styles.secondaryButton}>
              ⏸️ Pause Monitoring
            </button>
          )}
          <button onClick={handleReset} style={styles.secondaryButton}>
            🔄 Reset
          </button>
        </div>

        {isMonitoring && (
          <div style={styles.statusBadge}>
            <span style={styles.statusDot}></span>
            Agent is actively monitoring flights...
          </div>
        )}
      </div>

      {/* Latest Report */}
      {latestReport && (
        <div style={styles.reportSection}>
          <h2 style={styles.sectionTitle}>📊 Latest Report</h2>
          <div style={styles.reportHeader}>
            <p style={styles.reportDate}>
              Generated: {latestReport.generatedAt.toLocaleString('en-IN')}
            </p>
            <p style={styles.reportSummary}>{latestReport.summary}</p>
          </div>

          <div style={styles.destinationsGrid}>
            {latestReport.destinations.map((destination) => (
              <div
                key={destination.id}
                style={styles.destinationCard}
                onClick={() => setSelectedDestination(destination)}
              >
                <h3 style={styles.destinationName}>
                  {destination.name}, {destination.country}
                </h3>
                <p style={styles.destinationDescription}>
                  {destination.description}
                </p>
                <div style={styles.costBreakdown}>
                  <div style={styles.costItem}>
                    <span>Flight ({destination.airline})</span>
                    <strong>{formatCurrency(destination.flightCost)}</strong>
                  </div>
                  <div style={styles.costItem}>
                    <span>Stay</span>
                    <strong>{formatCurrency(destination.stayCost)}</strong>
                  </div>
                  <div style={styles.costItem}>
                    <span>Other Expenses</span>
                    <strong>{formatCurrency(destination.otherExpenses)}</strong>
                  </div>
                  <div style={{...styles.costItem, ...styles.totalCost}}>
                    <span>Total Cost</span>
                    <strong>{formatCurrency(destination.totalCost)}</strong>
                  </div>
                </div>
                <div style={styles.dates}>
                  <span>📅 {formatDate(destination.departureDate)} - {formatDate(destination.returnDate)}</span>
                </div>
                <button style={styles.viewDetailsButton}>View Details</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report History */}
      {allReports.length > 0 && (
        <div style={styles.historySection}>
          <h2 style={styles.sectionTitle}>📜 Report History</h2>
          <div style={styles.historyList}>
            {allReports.slice().reverse().map((report, index) => (
              <div key={report.id} style={styles.historyItem}>
                <div style={styles.historyHeader}>
                  <strong>Report #{allReports.length - index}</strong>
                  <span>{report.generatedAt.toLocaleString('en-IN')}</span>
                </div>
                <p>{report.summary}</p>
                <p style={styles.historyDetails}>
                  {report.destinations.length} destinations found
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Destination Detail Modal */}
      {selectedDestination && (
        <div style={styles.modal} onClick={() => setSelectedDestination(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button
              style={styles.closeButton}
              onClick={() => setSelectedDestination(null)}
            >
              ✕
            </button>
            <h2 style={styles.modalTitle}>
              {selectedDestination.name}, {selectedDestination.country}
            </h2>
            <p style={styles.modalDescription}>
              {selectedDestination.description}
            </p>
            <div style={styles.modalDetails}>
              <div style={styles.detailRow}>
                <span>✈️ Airline:</span>
                <strong>{selectedDestination.airline}</strong>
              </div>
              <div style={styles.detailRow}>
                <span>📅 Travel Dates:</span>
                <strong>
                  {formatDate(selectedDestination.departureDate)} to{' '}
                  {formatDate(selectedDestination.returnDate)}
                </strong>
              </div>
              <div style={styles.detailRow}>
                <span>✈️ Flight Cost:</span>
                <strong>{formatCurrency(selectedDestination.flightCost)}</strong>
              </div>
              <div style={styles.detailRow}>
                <span>🏨 Stay Cost:</span>
                <strong>{formatCurrency(selectedDestination.stayCost)}</strong>
              </div>
              <div style={styles.detailRow}>
                <span>💰 Other Expenses:</span>
                <strong>{formatCurrency(selectedDestination.otherExpenses)}</strong>
              </div>
              <div style={{...styles.detailRow, ...styles.totalRow}}>
                <span>💵 Total Cost:</span>
                <strong>{formatCurrency(selectedDestination.totalCost)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "Inter, system-ui, sans-serif",
    backgroundColor: "#f8f9fa"
  },
  header: {
    textAlign: "center",
    marginBottom: "32px"
  },
  title: {
    fontSize: "36px",
    fontWeight: "700",
    color: "#1a1a1a",
    margin: "0 0 8px 0"
  },
  subtitle: {
    fontSize: "18px",
    color: "#666",
    margin: 0
  },
  configPanel: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "24px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
  },
  sectionTitle: {
    fontSize: "24px",
    fontWeight: "600",
    color: "#1a1a1a",
    marginTop: 0,
    marginBottom: "16px"
  },
  configGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
    marginBottom: "20px"
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  label: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#333"
  },
  input: {
    padding: "10px",
    fontSize: "16px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    outline: "none"
  },
  inputHint: {
    fontSize: "12px",
    color: "#999"
  },
  infoBox: {
    backgroundColor: "#f0f7ff",
    border: "1px solid #b3d9ff",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "20px"
  },
  buttonGroup: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap"
  },
  primaryButton: {
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.2s"
  },
  secondaryButton: {
    backgroundColor: "#6c757d",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer"
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "16px",
    padding: "12px",
    backgroundColor: "#d4edda",
    border: "1px solid #c3e6cb",
    borderRadius: "6px",
    color: "#155724",
    fontWeight: "600"
  },
  statusDot: {
    width: "8px",
    height: "8px",
    backgroundColor: "#28a745",
    borderRadius: "50%",
    animation: "pulse 2s infinite"
  },
  reportSection: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "24px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
  },
  reportHeader: {
    marginBottom: "24px"
  },
  reportDate: {
    fontSize: "14px",
    color: "#666",
    marginBottom: "8px"
  },
  reportSummary: {
    fontSize: "16px",
    color: "#333",
    fontWeight: "500"
  },
  destinationsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
    gap: "20px"
  },
  destinationCard: {
    border: "1px solid #e0e0e0",
    borderRadius: "10px",
    padding: "20px",
    cursor: "pointer",
    transition: "transform 0.2s, box-shadow 0.2s",
    backgroundColor: "#fafafa"
  },
  destinationName: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#1a1a1a",
    marginTop: 0,
    marginBottom: "8px"
  },
  destinationDescription: {
    fontSize: "14px",
    color: "#666",
    marginBottom: "16px"
  },
  costBreakdown: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "12px"
  },
  costItem: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px"
  },
  totalCost: {
    paddingTop: "8px",
    borderTop: "2px solid #e0e0e0",
    fontSize: "16px",
    fontWeight: "600",
    color: "#007bff"
  },
  dates: {
    fontSize: "13px",
    color: "#666",
    marginBottom: "12px"
  },
  viewDetailsButton: {
    width: "100%",
    padding: "8px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600"
  },
  historySection: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
  },
  historyList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  historyItem: {
    padding: "16px",
    backgroundColor: "#f8f9fa",
    borderRadius: "8px",
    border: "1px solid #e0e0e0"
  },
  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
    fontSize: "14px"
  },
  historyDetails: {
    fontSize: "13px",
    color: "#666",
    marginTop: "8px"
  },
  modal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "32px",
    maxWidth: "600px",
    width: "90%",
    maxHeight: "80vh",
    overflow: "auto",
    position: "relative"
  },
  closeButton: {
    position: "absolute",
    top: "16px",
    right: "16px",
    background: "none",
    border: "none",
    fontSize: "24px",
    cursor: "pointer",
    color: "#666"
  },
  modalTitle: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#1a1a1a",
    marginTop: 0,
    marginBottom: "12px"
  },
  modalDescription: {
    fontSize: "16px",
    color: "#666",
    marginBottom: "24px"
  },
  modalDetails: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px",
    backgroundColor: "#f8f9fa",
    borderRadius: "6px"
  },
  totalRow: {
    backgroundColor: "#e7f3ff",
    borderLeft: "4px solid #007bff",
    fontSize: "18px"
  }
};
