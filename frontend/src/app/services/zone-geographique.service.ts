import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable, of, shareReplay, tap } from "rxjs";

import { environment } from "../../environments/environment";
import type {
  CollectionZones,
  ReponseLocalisation,
  RequeteGeoJSON,
  StatistiqueCouche,
  TypeZone,
} from "../models/zone.model";

@Injectable({
  providedIn: "root",
})
export class ZoneGeographiqueService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/zones`;

  /**
   * Les frontières et la ZEE ne changent pas d'une session à l'autre :
   * on met le FeatureCollection en cache pour éviter de retélécharger
   * plusieurs mégaoctets à chaque bascule de couche.
   */
  private readonly cache = new Map<string, Observable<CollectionZones>>();

  chargerCouche(
    type: TypeZone,
    tolerance: number,
  ): Observable<CollectionZones> {
    const cle = `${type}:${tolerance}`;
    const enCache = this.cache.get(cle);
    if (enCache) {
      return enCache;
    }

    const requete: RequeteGeoJSON = {
      type_zone: type,
      tolerance,
      limite: 5000,
    };
    const flux = this.http
      .post<CollectionZones>(`${this.base}/geojson`, requete)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));

    this.cache.set(cle, flux);
    return flux;
  }

  /** À appeler après un import de shapefile pour forcer le rechargement. */
  viderCache(type?: TypeZone): void {
    if (!type) {
      this.cache.clear();
      return;
    }
    for (const cle of [...this.cache.keys()]) {
      if (cle.startsWith(`${type}:`)) {
        this.cache.delete(cle);
      }
    }
  }

  localiser(
    latitude: number,
    longitude: number,
    typesZone?: TypeZone[],
  ): Observable<ReponseLocalisation> {
    return this.http.post<ReponseLocalisation>(`${this.base}/localiser`, {
      latitude,
      longitude,
      types_zone: typesZone ?? null,
    });
  }

  statistiques(): Observable<{ couches: StatistiqueCouche[] }> {
    return this.http.post<{ couches: StatistiqueCouche[] }>(
      `${this.base}/statistiques`,
      {},
    );
  }
}
