import { Injectable } from "@angular/core";
import html2canvas from "html2canvas";
import * as pdfMake from "pdfmake/build/pdfmake";
// import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import * as QRCode from "qrcode";
import { Pecheur } from "../models/pecheur.model";

// Configuration des polices pour pdfMake
// (pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

@Injectable({
  providedIn: "root",
})
export class CardGeneratorService {
  constructor() {}

  /**
   * Génère le QR code en base64
   */
  async generateQRCode(pecheur: Pecheur): Promise<string> {
    const qrData = `CNP:${pecheur.numero_carte}|NOM:${pecheur.nom}|PRENOM:${pecheur.prenom}|ID:${pecheur.id}`;

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
      return qrCodeDataUrl;
    } catch (error) {
      console.error("Erreur génération QR code:", error);
      return "";
    }
  }

  /**
   * Génère le HTML de la carte
   */
  generateCardHTML(
    pecheur: Pecheur,
    qrCodeUrl: string,
    photoUrl?: string,
  ): string {
    const age = pecheur.age || this.calculateAge(pecheur.date_naissance);
    const licenceStatus = pecheur.licence_active ? "VALIDE" : "EXPIRÉE";
    const licenceColor = pecheur.licence_active ? "#4caf50" : "#f44336";

    return `
      <div id="pecheur-card" style="
        width: 1011px;
        height: 638px;
        background: linear-gradient(135deg, #1976d2 0%, #0d47a1 100%);
        position: relative;
        font-family: Arial, sans-serif;
        color: white;
        box-shadow: 0 8px 16px rgba(0,0,0,0.3);
        border-radius: 20px;
        overflow: hidden;
      ">
        <!-- En-tête -->
        <div style="
          background: rgba(255,255,255,0.1);
          padding: 15px 30px;
          text-align: center;
          border-bottom: 3px solid rgba(255,255,255,0.3);
        ">
          <div style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">
            RÉPUBLIQUE GABONAISE
          </div>
          <div style="font-size: 18px; margin-top: 5px; letter-spacing: 1px;">
            Ministère de la mer, de la Pêche et de l'Economie Bleue
          </div>
          <div style="font-size: 28px; font-weight: bold; margin-top: 10px; color: #ffd54f;">
            CARTE NATIONALE DE PÊCHEUR
          </div>
        </div>

        <!-- Contenu principal -->
        <div style="display: flex; padding: 30px; gap: 30px;">
          <!-- Photo -->
          <div style="flex-shrink: 0;">
            <div style="
              width: 220px;
              height: 280px;
              background: white;
              border-radius: 10px;
              overflow: hidden;
              border: 4px solid rgba(255,255,255,0.3);
              box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            ">
              ${
                photoUrl
                  ? `<img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Photo">`
                  : `<div style="
                  width: 100%;
                  height: 100%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background: #e0e0e0;
                  color: #757575;
                  font-size: 48px;
                ">
                  <i class="material-icons" style="font-size: 80px;">person</i>
                </div>`
              }
            </div>
          </div>

          <!-- Informations -->
          <div style="flex: 1; display: flex; flex-direction: column; gap: 15px;">
            <div style="
              background: rgba(255,255,255,0.15);
              padding: 12px 20px;
              border-radius: 8px;
              border-left: 4px solid #ffd54f;
            ">
              <div style="font-size: 14px; opacity: 0.9;">N° CNP</div>
              <div style="font-size: 24px; font-weight: bold; margin-top: 5px;">
                ${pecheur.numero_carte}
              </div>
            </div>

            <div style="
              background: rgba(255,255,255,0.15);
              padding: 12px 20px;
              border-radius: 8px;
            ">
              <div style="font-size: 14px; opacity: 0.9;">Nom et Prénom</div>
              <div style="font-size: 26px; font-weight: bold; margin-top: 5px; text-transform: uppercase;">
                ${pecheur.nom} ${pecheur.prenom}
              </div>
            </div>

            <div style="display: flex; gap: 15px;">
              <div style="
                flex: 1;
                background: rgba(255,255,255,0.15);
                padding: 12px 20px;
                border-radius: 8px;
              ">
                <div style="font-size: 14px; opacity: 0.9;">Date de naissance</div>
                <div style="font-size: 18px; font-weight: bold; margin-top: 5px;">
                  ${new Date(pecheur.date_naissance).toLocaleDateString("fr-FR")}
                </div>
                <div style="font-size: 16px; margin-top: 5px; color: #ffd54f;">
                  ${age} ans
                </div>
              </div>

              <div style="
                flex: 1;
                background: rgba(255,255,255,0.15);
                padding: 12px 20px;
                border-radius: 8px;
              ">
                <div style="font-size: 14px; opacity: 0.9;">Catégorie</div>
                <div style="font-size: 16px; font-weight: bold; margin-top: 5px;">
                  ${pecheur.categorie}
                </div>
                <div style="font-size: 14px; margin-top: 5px;">
                  ${pecheur.type_peche}
                </div>
              </div>
            </div>

            <div style="
              background: rgba(255,255,255,0.15);
              padding: 12px 20px;
              border-radius: 8px;
              border-left: 4px solid ${licenceColor};
            ">
              <div style="font-size: 14px; opacity: 0.9;">Licence de pêche</div>
              <div style="font-size: 18px; font-weight: bold; margin-top: 5px;">
                ${pecheur.licence_numero || "N/A"}
              </div>
              <div style="font-size: 14px; margin-top: 5px;">
                Expire le: ${
                  pecheur.licence_date_expiration
                    ? new Date(
                        pecheur.licence_date_expiration,
                      ).toLocaleDateString("fr-FR")
                    : "N/A"
                }
                <span style="
                  background: ${licenceColor};
                  padding: 2px 8px;
                  border-radius: 4px;
                  margin-left: 10px;
                  font-size: 12px;
                  font-weight: bold;
                ">${licenceStatus}</span>
              </div>
            </div>
          </div>

          <!-- QR Code -->
          <div style="flex-shrink: 0;">
            <div style="
              width: 200px;
              height: 200px;
              background: white;
              border-radius: 10px;
              padding: 10px;
              box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            ">
              <img src="${qrCodeUrl}" style="width: 100%; height: 100%;" alt="QR Code">
            </div>
            <div style="
              text-align: center;
              margin-top: 10px;
              font-size: 12px;
              opacity: 0.8;
            ">
              Scanner pour vérifier
            </div>
          </div>
        </div>

        <!-- Pied de page -->
        <div style="
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0,0,0,0.3);
          padding: 10px 30px;
          font-size: 12px;
          text-align: center;
          opacity: 0.9;
        ">
          <div>Émise par la Direction des Pêches et de l'Aquaculture (DPA)</div>
          <div style="margin-top: 5px;">
            Cette carte est la propriété de la République Gabonaise • Document officiel
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Génère la carte en PNG
   */
  async generateCardPNG(
    pecheur: Pecheur,
    photoUrl?: string,
  ): Promise<Blob | null> {
    try {
      // Générer le QR code
      const qrCodeUrl = await this.generateQRCode(pecheur);

      // Créer un élément temporaire avec le HTML de la carte
      const cardHTML = this.generateCardHTML(pecheur, qrCodeUrl, photoUrl);
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = cardHTML;
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      document.body.appendChild(tempDiv);

      const cardElement = tempDiv.querySelector("#pecheur-card") as HTMLElement;

      // Générer l'image avec html2canvas
      const canvas = await html2canvas(cardElement, {
        scale: 2,
        backgroundColor: null,
        logging: false,
        width: 1011,
        height: 638,
      });

      // Nettoyer
      document.body.removeChild(tempDiv);

      // Convertir en blob
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, "image/png");
      });
    } catch (error) {
      console.error("Erreur génération carte PNG:", error);
      return null;
    }
  }

  /**
   * Génère la carte en PDF
   */
  async generateCardPDF(pecheur: Pecheur, photoUrl?: string): Promise<void> {
    try {
      // Générer d'abord l'image PNG
      const pngBlob = await this.generateCardPNG(pecheur, photoUrl);

      if (!pngBlob) {
        throw new Error("Échec de génération de l'image");
      }

      // Convertir le blob en base64
      const reader = new FileReader();
      reader.readAsDataURL(pngBlob);

      reader.onloadend = () => {
        const base64data = reader.result as string;

        // Créer le document PDF
        const docDefinition: any = {
          pageSize: {
            width: 1011 * 0.75, // Conversion pixels vers points (300 DPI -> 72 DPI)
            height: 638 * 0.75,
          },
          pageMargins: [0, 0, 0, 0],
          content: [
            {
              image: base64data,
              width: 1011 * 0.75,
              height: 638 * 0.75,
            },
          ],
        };

        // Générer et télécharger le PDF
        pdfMake
          .createPdf(docDefinition)
          .download(`carte_pecheur_${pecheur.numero_carte}.pdf`);
      };
    } catch (error) {
      console.error("Erreur génération PDF:", error);
      throw error;
    }
  }

  /**
   * Télécharge la carte en PNG
   */
  async downloadCardPNG(pecheur: Pecheur, photoUrl?: string): Promise<void> {
    try {
      const blob = await this.generateCardPNG(pecheur, photoUrl);

      if (!blob) {
        throw new Error("Échec de génération de la carte");
      }

      // Créer un lien de téléchargement
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `carte_pecheur_${pecheur.numero_carte}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erreur téléchargement PNG:", error);
      throw error;
    }
  }

  /**
   * Imprime la carte
   */
  async printCard(pecheur: Pecheur, photoUrl?: string): Promise<void> {
    try {
      const qrCodeUrl = await this.generateQRCode(pecheur);
      const cardHTML = this.generateCardHTML(pecheur, qrCodeUrl, photoUrl);

      // Créer une nouvelle fenêtre pour l'impression
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        throw new Error("Impossible d'ouvrir la fenêtre d'impression");
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Carte de pêcheur - ${pecheur.nom} ${pecheur.prenom}</title>
          <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
          <style>
            @page {
              size: 1011px 638px;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          ${cardHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
        </html>
      `);

      printWindow.document.close();
    } catch (error) {
      console.error("Erreur impression:", error);
      throw error;
    }
  }

  /**
   * Calcule l'âge à partir de la date de naissance
   */
  private calculateAge(dateNaissance: string): number {
    const today = new Date();
    const birthDate = new Date(dateNaissance);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }
}
