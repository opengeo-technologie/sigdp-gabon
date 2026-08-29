import { Injectable } from "@angular/core";
import html2canvas from "html2canvas";
import * as pdfMake from "pdfmake/build/pdfmake";
// import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import * as QRCode from "qrcode";
import { Pecheur } from "../models/pecheur.model";

// Configuration des polices pour pdfMake
// (pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

// Dimensions physiques de la carte (px @ ~300 DPI de travail)
const CARD_WIDTH = 1011;
const CARD_HEIGHT = 638;
const PX_TO_PT = 0.75; // px -> points (300 DPI -> 72 DPI)

@Injectable({
  providedIn: "root",
})
export class CardGeneratorService {
  constructor() {}

  /**
   * Génère le QR code en base64
   */
  async generateQRCode(pecheur: Pecheur): Promise<string> {
    const qrData = `CNP:${pecheur.numero_carte}|NOM:${pecheur.nom}|PRENOM:${pecheur.prenom}`;

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
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

  // =========================================================================
  //  RECTO
  // =========================================================================

  /**
   * Génère le HTML du recto de la carte
   */
  generateCardHTML(
    pecheur: Pecheur,
    qrCodeUrl: string,
    photoUrl?: string,
  ): string {
    return `
      <div id="pecheur-card" style="
        width: ${CARD_WIDTH}px;
        height: ${CARD_HEIGHT}px;
        background: linear-gradient(135deg, #ffffff 0%, #f5f6f9 100%);
        position: relative;
        font-family: Arial, sans-serif;
        color: black;
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
          <div style="font-size: 24px; font-weight: bold; letter-spacing: 2px; display: flex; align-items: center; justify-content: center; gap: 15px;">
            <span>RÉPUBLIQUE</span> <span><img src="../../assets/logo1.png" style="width: 80px; height: auto;"></span> <span>GABONAISE</span>
          </div>
          <div style="font-size: 18px; margin-top: 5px; font-weight: bold; letter-spacing: 2px;">
            <span style="color: #009E60;">Union</span> - <span style="color: #FCD116;">Travail</span> - <span style="color: #3A75C4;">Justice</span>
          </div>
          <div style="
          background: rgba(6, 93, 144, 0.9);
          padding: 15px 30px;
          text-align: center;
          border-bottom: 3px solid rgba(255,255,255,0.3);
          ">
            <div style="font-size: 20px; margin-top: 5px; letter-spacing: 1px; text-transform: uppercase; font-weight: bolder; color: #ffffff;">
              Ministère de la mer, de la Pêche et de l'Economie Bleue
            </div>
            <div style="font-size: 20px; font-weight: bold; margin-top: 10px; color: #ffffff;">
              DIRECTION GENERALE DES PECHES ET DE L'AQUACULTURE
            </div>
          </div>
        </div>

        <!-- Contenu principal -->
        <div style="display: flex; padding: 2px 30px 30px 30px; gap: 30px;">

          <!-- Informations -->
          <div style="flex: 1; display: flex; flex-direction: column; gap: 15px;">

            <div style="
              background: rgba(6, 93, 144, 0.06);
              padding: 2px 5px 5px 5px;
              border-radius: 8px;
            ">
              <div style="font-size: 26px; font-weight: bold; text-transform: uppercase;">
                ${pecheur.nom} ${pecheur.prenom}
              </div>
            </div>

            <div style="display: flex; gap: 15px;">
              <div style="
                flex: 1;
                background: rgba(6, 93, 144, 0.06);
                padding: 2px 5px 5px 5px;
                border-radius: 8px;
              ">
                <div style="font-size: 20px; opacity: 0.9;">Né le :
                  <span style="font-size: 22px; font-weight: bold; margin-top: 2px;">
                    ${new Date(pecheur.date_naissance).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </div>
            </div>
            <div style="
              background: rgba(6, 93, 144, 0.06);
              padding: 2px 5px 5px 5px;
              border-radius: 8px;
            ">
              <div style="font-size: 20px; opacity: 0.9;">Nationalité :
                <span style="font-size: 22px; font-weight: bold; margin-top: 2px;">${pecheur.nationalite}</span>
              </div>
            </div>
            <div style="
              background: rgba(6, 93, 144, 0.06);
              padding: 2px 5px 5px 5px;
              border-radius: 8px;
            ">
              <div style="font-size: 20px; opacity: 0.9;">Coopérative :
                <span style="font-size: 22px; font-weight: bold; margin-top: 2px;">${pecheur.cooperative_nom}</span>
              </div>
            </div>
            <div style="
              background: rgba(6, 93, 144, 0.06);
              padding: 2px 5px 5px 5px;
              border-radius: 8px;
            ">
              <div style="font-size: 20px; opacity: 0.9;">Nom/Imma :
                <span style="font-size: 22px; font-weight: bold; margin-top: 2px;"></span>
              </div>
            </div>
            <div style="
              background: rgba(6, 93, 144, 0.06);
              padding: 2px 5px 5px 5px;
              border-radius: 8px;
            ">
              <div style="font-size: 20px; opacity: 0.9;">IDC :
                <span style="font-size: 22px; font-weight: bold; margin-top: 2px;">${pecheur.type_carte} - ${pecheur.numero_piece_identite}</span>
              </div>
            </div>
            <div style="
              background: rgba(6, 93, 144, 0.9);
              padding: 12px 20px;
              border-radius: 8px;
              border-left: 4px solid #ffd54f;
            ">
              <div style="font-size: 24px; font-weight: bold; color: #ffffff;">CARTE DE PECHEUR N°
                <span style="font-size: 24px; font-weight: bold; margin-top: 2px;">${pecheur.numero_carte}</span>
              </div>
            </div>

          </div>

          <!-- Photo + QR -->
          <div style="flex-shrink: 0;">
            <div style="
              width: 220px;
              height: 280px;
              background: white;
              border-radius: 10px;
              overflow: hidden;
              border: 4px solid rgba(6, 93, 144, 0.3);
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
            <div style="
              width: 90px;
              height: 90px;
              background: white;
              border-radius: 10px;
              padding: 6px;
              margin-top: 12px;
              margin-left: 65px;
              box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            ">
              <img src="${qrCodeUrl}" style="width: 100%; height: 100%;" alt="QR Code">
            </div>
            <div style="
              text-align: center;
              margin-top: 8px;
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
          background: rgba(6, 93, 144, 0.9);
          padding: 10px 30px;
          font-size: 12px;
          text-align: center;
          color: #ffffff;
        ">
          <div>Émise par la Direction Générale des Pêches et de l'Aquaculture (DGPA)</div>
          <div style="margin-top: 5px;">
            Cette carte est la propriété de la République Gabonaise • Document officiel
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  //  VERSO
  // =========================================================================

  /**
   * Génère le HTML du verso de la carte
   */
  generateVersoHTML(pecheur: Pecheur, qrCodeUrl: string): string {
    const p = pecheur as any;

    const dateEmission = p.date_emission
      ? new Date(p.date_emission).toLocaleDateString("fr-FR")
      : new Date().toLocaleDateString("fr-FR");

    const dateExpiration = p.date_expiration
      ? new Date(p.date_expiration).toLocaleDateString("fr-FR")
      : this.addYears(p.date_emission, 3);

    const lieuDelivrance = p.lieu_delivrance || "Libreville";
    const portAttache = p.debarcadere_habituel_nom || "—";
    const typePeche = p.type_peche || "Pêche artisanale";
    const zonePeche = p.zone_peche || "Eaux territoriales gabonaises";

    const infoRow = (label: string, value: string) => `
      <div style="
        background: #eef1f6;
        border-left: 4px solid #065d90;
        border-radius: 6px;
        padding: 8px 12px;
      ">
        <div style="font-size: 13px; color: #4a5a6a; text-transform: uppercase; letter-spacing: 0.5px;">${label}</div>
        <div style="font-size: 19px; font-weight: bold; color: #0d1b2a; margin-top: 2px;">${value}</div>
      </div>
    `;

    const condition = (text: string) => `
      <div style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 6px;">
        <span style="color: #065d90; font-weight: bold; line-height: 1.3;">•</span>
        <span style="font-size: 14px; color: #2b3a48; line-height: 1.35;">${text}</span>
      </div>
    `;

    return `
      <div id="pecheur-card-verso" style="
        width: ${CARD_WIDTH}px;
        height: ${CARD_HEIGHT}px;
        background: linear-gradient(135deg, #ffffff 0%, #f5f6f9 100%);
        position: relative;
        font-family: Arial, sans-serif;
        color: black;
        box-shadow: 0 8px 16px rgba(0,0,0,0.3);
        border-radius: 20px;
        overflow: hidden;
      ">
        <!-- Bande supérieure -->
        <div style="
          background: rgba(6, 93, 144, 0.95);
          padding: 14px 30px;
          text-align: center;
          color: #ffffff;
          border-bottom: 4px solid #ffd54f;
        ">
          <div style="font-size: 20px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
            Informations officielles
          </div>
          <div style="font-size: 14px; margin-top: 4px; opacity: 0.9;">
            Direction Générale des Pêches et de l'Aquaculture
          </div>
        </div>

        <!-- Corps -->
        <div style="display: flex; gap: 24px; padding: 20px 30px 0 30px;">

          <!-- Colonne gauche : infos + conditions -->
          <div style="flex: 1.5; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              ${infoRow("Date d'émission", dateEmission)}
              ${infoRow("Date d'expiration", dateExpiration)}
              ${infoRow("Lieu de délivrance", lieuDelivrance)}
              ${infoRow("Port d'attache", portAttache)}
              ${infoRow("Type de pêche", typePeche)}
              ${infoRow("Zone autorisée", zonePeche)}
            </div>

            <div style="
              background: #ffffff;
              border: 1px solid #d7dee7;
              border-radius: 8px;
              padding: 12px 14px;
              margin-top: 4px;
            ">
              <div style="font-size: 15px; font-weight: bold; color: #065d90; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                Conditions d'utilisation
              </div>
              ${condition("Cette carte est strictement personnelle et incessible.")}
              ${condition("Elle doit être présentée à toute réquisition des agents assermentés.")}
              ${condition("Toute perte ou vol doit être immédiatement déclaré à la DGPA.")}
              ${condition("Sa validité est subordonnée au paiement des redevances en vigueur.")}
              ${condition("Toute falsification est punie par la loi.")}
            </div>
          </div>

          <!-- Colonne droite : QR + signature -->
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <div style="
              width: 190px;
              height: 190px;
              background: white;
              border-radius: 12px;
              padding: 10px;
              border: 2px solid #065d90;
              box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            ">
              <img src="${qrCodeUrl}" style="width: 100%; height: 100%;" alt="QR Code">
            </div>
            <div style="font-size: 13px; color: #4a5a6a; text-align: center;">
              Scanner pour vérifier l'authenticité
            </div>

            <div style="
              width: 100%;
              background: rgba(6, 93, 144, 0.06);
              border-radius: 8px;
              padding: 10px 12px;
              text-align: center;
              margin-top: 4px;
            ">
              <div style="font-size: 13px; color: #4a5a6a;">Carte N°</div>
              <div style="font-size: 20px; font-weight: bold; color: #0d1b2a; letter-spacing: 1px;">
                ${pecheur.numero_carte}
              </div>
            </div>

            <div style="
              width: 100%;
              text-align: center;
              margin-top: 6px;
              padding-top: 6px;
              border-top: 1px dashed #b9c4d0;
            ">
              <div style="font-size: 13px; color: #4a5a6a;">Le Directeur Général</div>
              <div style="height: 34px;"></div>
              <div style="font-size: 12px; color: #8a97a4; font-style: italic;">Signature et cachet</div>
            </div>
          </div>
        </div>

        <!-- Pied de page -->
        <div style="
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(6, 93, 144, 0.95);
          padding: 10px 30px;
          font-size: 12px;
          text-align: center;
          color: #ffffff;
        ">
          <div>Document officiel de la République Gabonaise — Ministère de la Mer, de la Pêche et de l'Économie Bleue</div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  //  RENDU IMAGE (helper commun)
  // =========================================================================

  /**
   * Rend un HTML de carte en Blob PNG via html2canvas
   */
  private async renderHTMLtoBlob(
    html: string,
    elementId: string,
  ): Promise<Blob | null> {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.style.top = "0";
    document.body.appendChild(tempDiv);

    try {
      const cardElement = tempDiv.querySelector(`#${elementId}`) as HTMLElement;

      const canvas = await html2canvas(cardElement, {
        scale: 2,
        backgroundColor: null,
        logging: false,
        useCORS: true,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      });

      return await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/png");
      });
    } catch (error) {
      console.error(`Erreur rendu ${elementId}:`, error);
      return null;
    } finally {
      document.body.removeChild(tempDiv);
    }
  }

  /**
   * Génère le recto en PNG
   */
  async generateCardPNG(
    pecheur: Pecheur,
    photoUrl?: string,
  ): Promise<Blob | null> {
    const qrCodeUrl = await this.generateQRCode(pecheur);
    const html = this.generateCardHTML(pecheur, qrCodeUrl, photoUrl);
    return this.renderHTMLtoBlob(html, "pecheur-card");
  }

  /**
   * Génère le verso en PNG
   */
  async generateVersoPNG(pecheur: Pecheur): Promise<Blob | null> {
    const qrCodeUrl = await this.generateQRCode(pecheur);
    const html = this.generateVersoHTML(pecheur, qrCodeUrl);
    return this.renderHTMLtoBlob(html, "pecheur-card-verso");
  }

  // =========================================================================
  //  PDF (recto + verso = 2 pages)
  // =========================================================================

  /**
   * Génère la carte en PDF recto/verso (2 pages)
   */
  async generateCardPDF(pecheur: Pecheur, photoUrl?: string): Promise<void> {
    try {
      const [rectoBlob, versoBlob] = await Promise.all([
        this.generateCardPNG(pecheur, photoUrl),
        this.generateVersoPNG(pecheur),
      ]);

      if (!rectoBlob || !versoBlob) {
        throw new Error("Échec de génération des images (recto/verso)");
      }

      const [rectoBase64, versoBase64] = await Promise.all([
        this.blobToBase64(rectoBlob),
        this.blobToBase64(versoBlob),
      ]);

      const docDefinition: any = {
        pageSize: {
          width: CARD_WIDTH * PX_TO_PT,
          height: CARD_HEIGHT * PX_TO_PT,
        },
        pageMargins: [0, 0, 0, 0],
        content: [
          {
            image: rectoBase64,
            width: CARD_WIDTH * PX_TO_PT,
            height: CARD_HEIGHT * PX_TO_PT,
          },
          {
            image: versoBase64,
            width: CARD_WIDTH * PX_TO_PT,
            height: CARD_HEIGHT * PX_TO_PT,
            pageBreak: "before",
          },
        ],
      };

      pdfMake
        .createPdf(docDefinition)
        .download(`carte_pecheur_${pecheur.numero_carte}.pdf`);
    } catch (error) {
      console.error("Erreur génération PDF:", error);
      throw error;
    }
  }

  // =========================================================================
  //  TÉLÉCHARGEMENT PNG
  // =========================================================================

  /**
   * Télécharge le recto en PNG
   */
  async downloadCardPNG(pecheur: Pecheur, photoUrl?: string): Promise<void> {
    const blob = await this.generateCardPNG(pecheur, photoUrl);
    if (!blob) throw new Error("Échec de génération du recto");
    this.triggerDownload(
      blob,
      `carte_pecheur_${pecheur.numero_carte}_recto.png`,
    );
  }

  /**
   * Télécharge le verso en PNG
   */
  async downloadVersoPNG(pecheur: Pecheur): Promise<void> {
    const blob = await this.generateVersoPNG(pecheur);
    if (!blob) throw new Error("Échec de génération du verso");
    this.triggerDownload(
      blob,
      `carte_pecheur_${pecheur.numero_carte}_verso.png`,
    );
  }

  /**
   * Télécharge recto ET verso (2 fichiers PNG)
   */
  async downloadCardImages(pecheur: Pecheur, photoUrl?: string): Promise<void> {
    await this.downloadCardPNG(pecheur, photoUrl);
    await this.downloadVersoPNG(pecheur);
  }

  // =========================================================================
  //  IMPRESSION (recto + verso)
  // =========================================================================

  /**
   * Imprime la carte recto/verso (2 pages)
   */
  async printCard(pecheur: Pecheur, photoUrl?: string): Promise<void> {
    try {
      const qrCodeUrl = await this.generateQRCode(pecheur);
      const rectoHTML = this.generateCardHTML(pecheur, qrCodeUrl, photoUrl);
      const versoHTML = this.generateVersoHTML(pecheur, qrCodeUrl);

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
              size: ${CARD_WIDTH}px ${CARD_HEIGHT}px;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .card-page {
              page-break-after: always;
            }
            .card-page:last-child {
              page-break-after: auto;
            }
            @media print {
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="card-page">${rectoHTML}</div>
          <div class="card-page">${versoHTML}</div>
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

  // =========================================================================
  //  UTILITAIRES
  // =========================================================================

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private addYears(dateStr: string | undefined, years: number): string {
    const base = dateStr ? new Date(dateStr) : new Date();
    base.setFullYear(base.getFullYear() + years);
    return base.toLocaleDateString("fr-FR");
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
