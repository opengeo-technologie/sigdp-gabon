import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { lastValueFrom } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class ImageHelperService {
  constructor(private http: HttpClient) {}

  async getBase64ImageFromURL(url: string): Promise<string> {
    const data: Blob = await lastValueFrom(
      this.http.get(url, { responseType: "blob" }),
    );
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(data);
    });
  }
}
