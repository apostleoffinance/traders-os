import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Trader OS · Journal · Discipline · Intelligence",
  description:
    "Trader OS turns your trading history into structured data, helping you understand performance, risk, discipline and behavior over time. No signals. No noise. Just your data.",
};

export default function Home() {
  return <LandingPage />;
}
