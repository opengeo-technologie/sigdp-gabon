import {
  Component,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  OnDestroy,
} from "@angular/core";
import { CommonModule } from "@angular/common";

declare var M: any;

@Component({
  selector: "app-photo-uploader",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./photo-uploader.component.html",
  styleUrls: ["./photo-uploader.component.scss"],
})
export class PhotoUploaderComponent implements OnDestroy {
  @Output() photoSelected = new EventEmitter<File>();
  @Output() photoRemoved = new EventEmitter<void>();

  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild("videoElement") videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild("canvasElement") canvasElement!: ElementRef<HTMLCanvasElement>;

  // Mode d'upload
  uploadMode: "file" | "camera" | null = null;

  // Aperçu de la photo
  photoPreview: string | null = null;
  photoFile: File | null = null;

  // Caméra
  cameraStream: MediaStream | null = null;
  cameraActive = false;
  cameraError = false;

  // Support
  hasCamera = false;

  constructor() {
    this.checkCameraSupport();
  }

  ngOnDestroy() {
    this.stopCamera();
  }

  private async checkCameraSupport() {
    if (navigator.mediaDevices) {
      this.hasCamera = true;

      // Vérifier si des caméras sont disponibles
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        this.hasCamera = devices.some((device) => device.kind === "videoinput");
      } catch (error) {
        console.error("Erreur vérification caméra:", error);
        this.hasCamera = false;
      }
    }
  }

  // ========================================
  // Upload depuis fichier
  // ========================================

  selectFromFile() {
    this.uploadMode = "file";
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Vérifier le type
      if (!file.type.startsWith("image/")) {
        this.showToast("Veuillez sélectionner une image", "orange");
        return;
      }

      // Vérifier la taille (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.showToast("Image trop grande (max 5MB)", "orange");
        return;
      }

      this.processImageFile(file);
    }
  }

  private processImageFile(file: File) {
    this.photoFile = file;

    // Créer l'aperçu
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.photoPreview = e.target.result;
    };
    reader.readAsDataURL(file);

    // Émettre l'événement
    this.photoSelected.emit(file);
    this.showToast("Photo sélectionnée", "green");
  }

  // ========================================
  // Capture depuis caméra
  // ========================================

  async openCamera() {
    this.uploadMode = "camera";

    if (!this.hasCamera) {
      this.showToast("Caméra non disponible sur cet appareil", "orange");
      return;
    }

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user", // Caméra frontale par défaut
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      this.cameraActive = true;
      setTimeout(() => {
        if (this.videoElement?.nativeElement) {
          this.videoElement.nativeElement.srcObject = this.cameraStream;

          this.cameraError = false;
        }
      }, 200);
    } catch (error) {
      console.error("Erreur accès caméra:", error);
      this.cameraError = true;
      this.cameraActive = false;
      this.showToast("Impossible d'accéder à la caméra", "red");
    }
  }

  capturePhoto() {
    if (!this.cameraStream || !this.videoElement || !this.canvasElement) {
      return;
    }

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Définir la taille du canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Dessiner l'image
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convertir en Blob puis File
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `photo_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });

          this.processImageFile(file);
          this.stopCamera();
          // this.showToast("Photo capturée", "green");
        }
      },
      "image/jpeg",
      0.9,
    );
  }

  switchCamera() {
    // Arrêter la caméra actuelle
    this.stopCamera();

    // Basculer entre caméra avant/arrière
    const currentFacingMode = this.cameraStream
      ?.getVideoTracks()[0]
      .getSettings().facingMode;

    const newFacingMode = currentFacingMode === "user" ? "environment" : "user";

    // Redémarrer avec la nouvelle caméra
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: newFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      .then((stream) => {
        this.cameraStream = stream;
        if (this.videoElement) {
          this.videoElement.nativeElement.srcObject = stream;
        }
      })
      .catch((error) => {
        console.error("Erreur changement caméra:", error);
        this.showToast("Impossible de changer de caméra", "orange");
        this.openCamera(); // Revenir à la caméra par défaut
      });
  }

  stopCamera() {
    this.cameraActive = false;

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }
  }

  cancelCamera() {
    this.stopCamera();
    this.uploadMode = null;
  }

  // ========================================
  // Gestion de la photo
  // ========================================

  removePhoto() {
    this.photoPreview = null;
    this.photoFile = null;
    this.uploadMode = null;

    // Réinitialiser l'input file
    if (this.fileInput) {
      this.fileInput.nativeElement.value = "";
    }

    this.photoRemoved.emit();
    this.showToast("Photo supprimée", "blue");
  }

  rotatePhoto() {
    if (!this.photoPreview) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      // Inverser largeur/hauteur pour rotation 90°
      canvas.width = img.height;
      canvas.height = img.width;

      // Rotation de 90° dans le sens horaire
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      // Convertir en Blob puis File
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File(
              [blob],
              this.photoFile?.name || `photo_${Date.now()}.jpg`,
              { type: "image/jpeg" },
            );
            this.processImageFile(file);
          }
        },
        "image/jpeg",
        0.9,
      );
    };
    img.src = this.photoPreview;
  }

  // ========================================
  // Utilitaires
  // ========================================

  getPhotoFile(): File | null {
    return this.photoFile;
  }

  hasPhoto(): boolean {
    return this.photoFile !== null;
  }

  private showToast(message: string, color: string = "blue") {
    if (typeof M !== "undefined" && M.toast) {
      M.toast({ html: message, classes: color });
    }
  }
}
