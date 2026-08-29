// duration.pipe.ts  (standalone)
import { Pipe, PipeTransform } from "@angular/core";

@Pipe({ name: "duration", standalone: true })
export class DurationPipe implements PipeTransform {
  transform(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return h > 0
      ? `${h}h ${pad(m)} m ${pad(sec)}s`
      : `${pad(m)} m ${pad(sec)}s`;
  }
}
