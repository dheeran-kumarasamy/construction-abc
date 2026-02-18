export interface FlightDestination {
  id: string;
  name: string;
  country: string;
  flightCost: number;
  stayCost: number;
  otherExpenses: number;
  totalCost: number;
  airline: string;
  departureDate: string;
  returnDate: string;
  description: string;
}

export interface FlightMonitorConfig {
  flightBudget: number;
  stayBudget: number;
  travelStartDate: Date;
  travelEndDate: Date;
  reportingPeriodMonths: number;
  coupleTravel: boolean;
}

export interface FlightReport {
  id: string;
  generatedAt: Date;
  destinations: FlightDestination[];
  summary: string;
}
