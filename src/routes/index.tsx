import { createFileRoute } from "@tanstack/react-router";
import { NightOven } from "@/components/game/night-oven";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <NightOven />;
}
