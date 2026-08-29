// // presence.service.ts
// import { Injectable, inject, HostListener } from "@angular/core";
// import { HttpClient } from "@angular/common/http";
// import { interval, switchMap, startWith, Observable, Subscription } from "rxjs";
// import { environment } from "../../environments/environment";

// export interface ConnectedUser {
//   session_id: string;
//   user_id: number;
//   username: string;
//   role: string | null;
//   ip_address: string | null;
//   login_at: string;
//   duration_seconds: number;
// }

// @Injectable({ providedIn: "root" })
// export class PresenceService {
//   private http = inject(HttpClient);
//   private api = `${environment.apiUrl}/api/sessions`;
//   // private sessionId = localStorage.getItem("sigpa_session_id");

//   private heartbeatSub?: Subscription;
//   private unloadBound = false;

//   private get sid(): string | null {
//     return localStorage.getItem("sigpa_session_id");
//   }

//   /** Call once, right after login stores sigpa_session_id. */
//   start(): void {
//     this.startHeartbeat();
//     this.bindTabClose();
//   }

//   private startHeartbeat(): void {
//     this.stopHeartbeat();
//     this.heartbeatSub = interval(30_000)
//       .pipe(startWith(0))
//       .subscribe(() => {
//         const sid = this.sid;
//         if (sid) this.http.post(`${this.api}/heartbeat/${sid}`, {}).subscribe();
//       });
//   }

//   private stopHeartbeat(): void {
//     this.heartbeatSub?.unsubscribe();
//     this.heartbeatSub = undefined;
//   }

//   /** Fire logout when the tab is closed / navigated away / backgrounded. */
//   private bindTabClose(): void {
//     if (this.unloadBound) return;
//     this.unloadBound = true;

//     const closeBeacon = () => {
//       const sid = this.sid;
//       // sendBeacon survives page unload; a normal http.post would be cancelled.
//       if (sid) navigator.sendBeacon(`${this.api}/logout/${sid}`);
//     };

//     // pagehide: close, reload, back/forward nav (works on mobile too)
//     window.addEventListener("pagehide", closeBeacon);

//     // visibilitychange: catches mobile tab-switch / app-background where
//     // pagehide may not fire. Remove these 3 lines if you want a backgrounded
//     // tab to STAY connected (recommended for a back-office dashboard).
//     document.addEventListener("visibilitychange", () => {
//       if (document.visibilityState === "hidden") closeBeacon();
//     });
//   }

//   /** Explicit "Se déconnecter" button. */
//   logout(): void {
//     const sid = this.sid;
//     // console.log(sid);
//     this.stopHeartbeat();
//     if (sid) {
//       this.http.post(`${this.api}/logout/${sid}`, {}).subscribe({
//         complete: () => localStorage.removeItem("sigpa_session_id"),
//         error: () => localStorage.removeItem("sigpa_session_id"),
//       });
//     }
//   }

//   /** Dashboard poll: current connected users + live duration. */
//   connected$(): Observable<ConnectedUser[]> {
//     return interval(10_000).pipe(
//       startWith(0),
//       switchMap(() => this.http.get<ConnectedUser[]>(`${this.api}/connected`)),
//     );
//   }
// }
// presence.service.ts
import { Injectable, OnDestroy, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";
import {
  BehaviorSubject,
  Subscription,
  timer,
  switchMap,
  catchError,
  of,
} from "rxjs";

export interface OnlineUser {
  user_id: number;
  username: string;
  full_name: string;
  role: string;
  status: "online" | "idle";
  connected_at: number;
  duration_seconds: number;
  last_seen_seconds: number;
}

const HEARTBEAT_MS = 15000,
  REFRESH_MS = 15000;

@Injectable({ providedIn: "root" })
export class PresenceService implements OnDestroy {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/api/presence`; // adjust to your base URL
  private interacted = false;
  private heartbeat?: Subscription;
  private poll?: Subscription;
  readonly onlineUsers$ = new BehaviorSubject<OnlineUser[]>([]);

  constructor() {
    ["mousemove", "keydown", "click", "scroll"].forEach((ev) =>
      window.addEventListener(ev, () => (this.interacted = true), {
        passive: true,
      }),
    );
    window.addEventListener("beforeunload", () =>
      navigator.sendBeacon?.(`${this.api}/disconnect`),
    );
  }

  getToken(): string | null {
    return localStorage.getItem("access_token");
  }

  // call once, right after login succeeds
  start(): void {
    this.heartbeat = timer(0, HEARTBEAT_MS)
      .pipe(
        switchMap(() => {
          const active = this.interacted;
          this.interacted = false;
          return this.http
            .post(`${this.api}/ping`, null, {
              params: { active },
              headers: {
                Authorization: `Bearer ${this.getToken()}`,
              },
            })
            .pipe(catchError(() => of(null)));
        }),
      )
      .subscribe();
  }

  // call from the dashboard component
  startDashboardFeed(): void {
    this.poll = timer(0, REFRESH_MS)
      .pipe(
        switchMap(() =>
          this.http
            .get<OnlineUser[]>(`${this.api}/online`, {
              headers: {
                Authorization: `Bearer ${this.getToken()}`,
              },
            })
            .pipe(catchError(() => of([] as OnlineUser[]))),
        ),
      )
      .subscribe((u) => this.onlineUsers$.next(u));
  }

  ngOnDestroy(): void {
    this.heartbeat?.unsubscribe();
    this.poll?.unsubscribe();
  }
}
