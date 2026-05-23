import PixelBeatStudio from "./studio/PixelBeatStudio";
import { Toaster } from "@/components/ui/toaster";
import "./studio/studio.css";

export default function App() {
  return (
    <div className="studio-root dark">
      <PixelBeatStudio />
      <Toaster />
    </div>
  );
}
