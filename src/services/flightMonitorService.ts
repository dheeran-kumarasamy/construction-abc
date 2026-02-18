import type { FlightDestination, FlightMonitorConfig, FlightReport } from "../types/flightTypes";

// Mock flight data for demonstration
const mockDestinations: Omit<FlightDestination, 'departureDate' | 'returnDate' | 'id'>[] = [
  {
    name: "Goa",
    country: "India",
    flightCost: 12000,
    stayCost: 35000,
    otherExpenses: 25000,
    totalCost: 72000,
    airline: "IndiGo",
    description: "Beautiful beaches, vibrant nightlife, Portuguese heritage"
  },
  {
    name: "Bali",
    country: "Indonesia",
    flightCost: 45000,
    stayCost: 40000,
    otherExpenses: 30000,
    totalCost: 115000,
    airline: "Air India",
    description: "Tropical paradise, temples, rice terraces, and surfing"
  },
  {
    name: "Dubai",
    country: "UAE",
    flightCost: 25000,
    stayCost: 55000,
    otherExpenses: 40000,
    totalCost: 120000,
    airline: "Emirates",
    description: "Luxury shopping, ultramodern architecture, and desert safaris"
  },
  {
    name: "Thailand (Phuket)",
    country: "Thailand",
    flightCost: 35000,
    stayCost: 35000,
    otherExpenses: 25000,
    totalCost: 95000,
    airline: "Thai Airways",
    description: "Stunning beaches, island hopping, Thai cuisine, and culture"
  },
  {
    name: "Maldives",
    country: "Maldives",
    flightCost: 48000,
    stayCost: 70000,
    otherExpenses: 30000,
    totalCost: 148000,
    airline: "IndiGo",
    description: "Overwater bungalows, pristine beaches, and world-class diving"
  },
  {
    name: "Nepal (Pokhara)",
    country: "Nepal",
    flightCost: 18000,
    stayCost: 25000,
    otherExpenses: 20000,
    totalCost: 63000,
    airline: "Air India",
    description: "Mountain views, trekking, lakes, and peaceful scenery"
  },
  {
    name: "Sri Lanka",
    country: "Sri Lanka",
    flightCost: 22000,
    stayCost: 30000,
    otherExpenses: 22000,
    totalCost: 74000,
    airline: "SriLankan Airlines",
    description: "Tea plantations, ancient temples, wildlife, and beaches"
  },
  {
    name: "Singapore",
    country: "Singapore",
    flightCost: 32000,
    stayCost: 50000,
    otherExpenses: 35000,
    totalCost: 117000,
    airline: "Singapore Airlines",
    description: "Modern city, gardens, shopping, and diverse cuisine"
  },
  {
    name: "Jaipur",
    country: "India",
    flightCost: 8000,
    stayCost: 20000,
    otherExpenses: 15000,
    totalCost: 43000,
    airline: "IndiGo",
    description: "Pink City, royal palaces, forts, and Rajasthani culture"
  },
  {
    name: "Udaipur",
    country: "India",
    flightCost: 10000,
    stayCost: 25000,
    otherExpenses: 18000,
    totalCost: 53000,
    airline: "Air India",
    description: "City of Lakes, romantic palaces, and heritage hotels"
  }
];

class FlightMonitorService {
  private config: FlightMonitorConfig | null = null;
  private reports: FlightReport[] = [];
  private monitoringInterval: number | null = null;

  setConfig(config: FlightMonitorConfig): void {
    this.config = config;
  }

  getConfig(): FlightMonitorConfig | null {
    return this.config;
  }

  // Search for destinations within budget
  searchDestinations(startDate: Date): FlightDestination[] {
    if (!this.config) {
      throw new Error("Flight monitor not configured");
    }

    const totalBudget = this.config.flightBudget + this.config.stayBudget;
    
    // Filter destinations within budget
    const affordableDestinations = mockDestinations.filter(
      dest => dest.flightCost <= this.config!.flightBudget && dest.totalCost <= totalBudget
    );

    // Add dates to destinations
    return affordableDestinations.map((dest, index) => {
      const daysOffset = Math.floor(Math.random() * 30); // Random day within a month
      const departure = new Date(startDate);
      departure.setDate(departure.getDate() + daysOffset);
      
      const returnDate = new Date(departure);
      returnDate.setDate(returnDate.getDate() + 5 + Math.floor(Math.random() * 5)); // 5-10 day trip

      return {
        ...dest,
        id: `dest-${Date.now()}-${index}`,
        departureDate: departure.toISOString().split('T')[0],
        returnDate: returnDate.toISOString().split('T')[0]
      };
    });
  }

  // Generate a report with current available destinations
  generateReport(): FlightReport {
    if (!this.config) {
      throw new Error("Flight monitor not configured");
    }

    const now = new Date();
    const travelStart = this.config.travelStartDate;

    const destinations = this.searchDestinations(travelStart);

    const report: FlightReport = {
      id: `report-${Date.now()}`,
      generatedAt: now,
      destinations: destinations.sort((a, b) => a.totalCost - b.totalCost),
      summary: this.generateSummary(destinations)
    };

    this.reports.push(report);
    return report;
  }

  private generateSummary(destinations: FlightDestination[]): string {
    const count = destinations.length;
    if (count === 0) {
      return "No destinations found within your budget at this time.";
    }

    const cheapest = destinations[0];
    const avgCost = destinations.reduce((sum, d) => sum + d.totalCost, 0) / count;

    return `Found ${count} destinations within budget. Cheapest option: ${cheapest.name} at ₹${cheapest.totalCost.toLocaleString()}. Average cost: ₹${Math.round(avgCost).toLocaleString()}.`;
  }

  // Get all generated reports
  getAllReports(): FlightReport[] {
    return [...this.reports];
  }

  // Get the latest report
  getLatestReport(): FlightReport | null {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : null;
  }

  // Start monitoring (simulated)
  startMonitoring(onNewReport: (report: FlightReport) => void): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    // Generate initial report
    const initialReport = this.generateReport();
    onNewReport(initialReport);

    // Set up periodic monitoring (every 24 hours in production, 60 seconds for demo)
    this.monitoringInterval = setInterval(() => {
      const report = this.generateReport();
      onNewReport(report);
    }, 60000); // 60 seconds for demo purposes
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  // Clear all data
  reset(): void {
    this.stopMonitoring();
    this.config = null;
    this.reports = [];
  }
}

// Singleton instance
export const flightMonitorService = new FlightMonitorService();
