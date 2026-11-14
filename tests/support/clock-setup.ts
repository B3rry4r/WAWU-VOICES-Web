import { beforeEach } from "vitest";
import { resetServerClock } from "@/lib/api/server-clock";

// The page keeps its reading of the server clock in memory for as long as it lives. Every test starts with none, as a fresh page does.
beforeEach(() => resetServerClock());
