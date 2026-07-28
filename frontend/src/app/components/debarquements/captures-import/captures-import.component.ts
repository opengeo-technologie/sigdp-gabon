import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../../environments/environment";

declare var M: any;

interface RowError {
  immatriculation_pirogue: string;
  sitedebarquement: string;
  zone_de_peche: string;
  error_message: string;
}

interface UploadResult {
  total: number;
  inseres: number;
  echoues: number;
  erreurs: RowError[];
}

@Component({
  selector: "app-captures-import",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./captures-import.component.html",
  styleUrl: "./captures-import.component.scss",
})
export class CapturesImportComponent implements OnInit {
  selectedFile: File | null = null;
  isDragging = false;
  isUploading = false;
  result: UploadResult | null = null;

  private readonly maxSizeMo = 10;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // Rien à initialiser côté Materialize ici, mais garder le hook
    // si des selects/tooltips sont ajoutés plus tard :
    // setTimeout(() => M.AutoInit(), 0);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.setFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.setFile(input.files[0]);
      input.value = ""; // permet de re-sélectionner le même fichier
    }
  }

  private setFile(file: File): void {
    const validExtensions = [".xlsx", ".xls"];
    const isValid = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext),
    );
    if (!isValid) {
      M.toast({
        html: "Format invalide. Seuls les fichiers .xlsx et .xls sont acceptés.",
        classes: "red",
      });
      return;
    }
    if (file.size > this.maxSizeMo * 1024 * 1024) {
      M.toast({
        html: `Fichier trop volumineux (max ${this.maxSizeMo} Mo).`,
        classes: "red",
      });
      return;
    }
    this.selectedFile = file;
    this.result = null;
  }

  upload(): void {
    if (!this.selectedFile || this.isUploading) return;

    this.isUploading = true;
    this.result = null;

    const formData = new FormData();
    formData.append("file", this.selectedFile);

    this.http
      .post<UploadResult>(
        `${environment.apiUrl}/api/debarquements/upload-excel`,
        formData,
      )
      .subscribe({
        next: (res) => {
          this.isUploading = false;
          // console.log(res);
          this.result = res;
          // console.log(this.result);
          if (res.echoues === 0) {
            M.toast({
              html: `${res.inseres} captures importés avec succès.`,
              classes: "green",
            });
          } else {
            M.toast({
              html: `Import terminé : ${res.inseres} insérés, ${res.echoues} en échec.`,
              classes: "orange",
            });
          }
          this.selectedFile = null;
        },
        error: (err) => {
          this.isUploading = false;
          const message =
            err?.error?.detail || "Erreur lors de l'import du fichier.";
          M.toast({ html: message, classes: "red" });
        },
      });
  }

  reset(): void {
    this.selectedFile = null;
    this.result = null;
  }

  downloadTemplate(): void {
    this.http
      .post(
        `${environment.apiUrl}/bateaux/template`,
        {},
        { responseType: "blob" },
      )
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "modele_import_bateaux.xlsx";
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          M.toast({
            html: "Impossible de télécharger le modèle.",
            classes: "red",
          });
        },
      });
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }
}
