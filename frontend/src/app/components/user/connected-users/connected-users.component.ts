// connected-users.component.ts
import { Component, OnInit, OnDestroy, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subscription, interval, timer } from "rxjs";
import {
  PresenceService,
  OnlineUser,
} from "../../../services/presence.service";
import { DurationPipe } from "../../../pipes/duration.pipe";

@Component({
  selector: "app-connected-users",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./connected-users.component.html",
  styleUrls: [],
})
export class ConnectedUsersComponent implements OnInit, OnDestroy {
  private presence = inject(PresenceService);
  users = signal<OnlineUser[]>([]);
  private now = signal<number>(Date.now());
  private fetchedAt = Date.now();
  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.presence.startDashboardFeed();
    this.subs.push(
      this.presence.onlineUsers$.subscribe((u) => {
        this.users.set(u);
        this.fetchedAt = Date.now();
      }),
      timer(0, 1000).subscribe(() => this.now.set(Date.now())), // smooth local tick
    );
  }

  // counts up locally between the 15s server refreshes
  elapsed(u: OnlineUser): string {
    const s =
      u.duration_seconds + Math.floor((this.now() - this.fetchedAt) / 1000);
    const h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60),
      sec = s % 60;
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
